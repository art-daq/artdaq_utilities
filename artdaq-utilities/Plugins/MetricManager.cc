// MetricManager.cc: MetricManager class implementation file
// Author: Eric Flumerfelt
// Last Modified: 11/14/2014
//
// MetricManager loads a user-specified set of plugins, sends them their configuration,
// and sends them data as it is recieved. It also maintains the state of the plugins
// relative to the application state.

#include "TRACE/tracemf.h"
#define TRACE_NAME "MetricManager"

#include "artdaq-utilities/Plugins/MetricManager.hh"
#include "artdaq-utilities/Plugins/makeMetricPlugin.hh"
#include "fhiclcpp/ParameterSet.h"

#include <pthread.h>
#include <boost/exception/all.hpp>
#include <chrono>
#include <memory>

artdaq::MetricManager::MetricManager()
    : metric_plugins_(0)
    , system_metric_collector_(nullptr)
    , initialized_(false)
    , running_(false)
    , active_(false)
    , busy_(false)
    , missed_metric_calls_(0)
    , metric_calls_(0)
{
	TLOG(TLVL_INFO) << "MetricManager CONSTRUCTOR";
}

artdaq::MetricManager::~MetricManager() noexcept { shutdown(); }

void artdaq::MetricManager::initialize(fhicl::ParameterSet const& pset, std::string const& prefix)
{
	prefix_ = prefix;
	if (initialized_)
	{
		shutdown();
	}
	TLOG(TLVL_INFO) << "Configuring metrics with parameter set: " << pset.to_string();

	std::vector<std::string> names = pset.get_names();

	metric_plugins_.clear();
	bool send_system_metrics = false;
	bool send_process_metrics = false;

	for (const auto& name : names)
	{
		if (name == "metric_queue_size")
		{
			metric_cache_max_size_ = pset.get<size_t>("metric_queue_size");
		}
		else if (name == "metric_queue_notify_size")
		{
			metric_cache_notify_size_ = pset.get<size_t>("metric_queue_notify_size");
		}
		else if (name == "metric_cache_size")
		{
			metric_cache_max_size_ = pset.get<size_t>("metric_cache_size");
		}
		else if (name == "metric_cache_notify_size")
		{
			metric_cache_notify_size_ = pset.get<size_t>("metric_cache_notify_size");
		}
		else if (name == "metric_send_maximum_delay_ms")
		{
			TLOG(TLVL_INFO) << "Setting metric_send_interval_ms_ to " << pset.get<int>("metric_send_maximum_delay_ms");
			metric_send_interval_ms_ = pset.get<int>("metric_send_maximum_delay_ms");
		}
		else if (name == "metric_holdoff_us")
		{
			TLOG(TLVL_INFO) << "Setting metric_holdoff_us_ to " << pset.get<int>("metric_holdoff_us");
			metric_holdoff_us_ = pset.get<int>("metric_holdoff_us");
		}
		else if (name == "send_system_metrics")
		{
			send_system_metrics = pset.get<bool>("send_system_metrics");
		}
		else if (name == "send_process_metrics")
		{
			send_process_metrics = pset.get<bool>("send_process_metrics");
		}
		else
		{
			try
			{
				TLOG(TLVL_DEBUG + 32) << "Constructing metric plugin with name " << name;
				auto plugin_pset = pset.get<fhicl::ParameterSet>(name);
				metric_plugins_.push_back(
				    makeMetricPlugin(plugin_pset.get<std::string>("metricPluginType", ""), plugin_pset, prefix_, name));
			}
			catch (const cet::exception& e)
			{
				TLOG(TLVL_ERROR) << "Exception caught in MetricManager::initialize, error loading plugin with name " << name
				                 << ", cet::exception object caught:" << e.explain_self();
			}
			catch (const boost::exception& e)
			{
				TLOG(TLVL_ERROR) << "Exception caught in MetricManager::initialize, error loading plugin with name " << name
				                 << ", boost::exception object caught: " << boost::diagnostic_information(e);
			}
			catch (const std::exception& e)
			{
				TLOG(TLVL_ERROR) << "Exception caught in MetricManager::initialize, error loading plugin with name " << name
				                 << ", std::exception caught: " << e.what();
			}
			catch (...)
			{
				TLOG(TLVL_ERROR) << "Unknown Exception caught in MetricManager::initialize, error loading plugin with name "
				                 << name;
			}
		}
	}

	if (send_system_metrics || send_process_metrics)
	{
		system_metric_collector_ = std::make_unique<SystemMetricCollector>(send_process_metrics, send_system_metrics);
	}

	initialized_ = true;
}

void artdaq::MetricManager::do_start()
{
	std::lock_guard<std::mutex> lk(metric_mutex_);
	if (!running_)
	{
		TLOG(TLVL_DEBUG + 32) << "Starting MetricManager";
		for (auto& metric : metric_plugins_)
		{
			if (!metric)
			{
				continue;
			}
			try
			{
				metric->startMetrics();
				TLOG(TLVL_INFO) << "Metric Plugin " << metric->getLibName() << " started.";
				active_ = true;
			}
			catch (...)
			{
				TLOG(TLVL_ERROR) << "Exception caught in MetricManager::do_start(), error starting plugin with name "
				                 << metric->getLibName();
			}
		}
		running_ = true;
		startMetricLoop_();
	}
}

void artdaq::MetricManager::do_stop()
{
	std::unique_lock<std::mutex> lk(metric_mutex_);
	TLOG(TLVL_DEBUG + 32) << "Stopping Metrics";
	running_ = false;
	metric_cv_.notify_all();
	TLOG(TLVL_DEBUG + 32) << "Joining Metric-Sending thread";
	lk.unlock();
	try
	{
		if (metric_sending_thread_.joinable())
		{
			metric_sending_thread_.join();
		}
	}
	catch (...)
	{
		// IGNORED
	}
	TLOG(TLVL_DEBUG + 32) << "do_stop Complete";
}

void artdaq::MetricManager::do_pause()
{ /*do_stop();*/
}
void artdaq::MetricManager::do_resume()
{ /*do_start();*/
}

void artdaq::MetricManager::reinitialize(fhicl::ParameterSet const& pset, std::string const& prefix)
{
	shutdown();
	initialize(pset, prefix);
}

void artdaq::MetricManager::shutdown()
{
	TRACE_STREAMER(TLVL_DEBUG + 32, TLOG2("MetricManager", 0), 0) << "MetricManager is shutting down...";  // Using TRACE_STREAMER in case MessageFacility is already gone
	do_stop();

	std::lock_guard<std::mutex> lk(metric_mutex_);
	if (initialized_)
	{
		TRACE_STREAMER(TLVL_DEBUG + 32, TLOG2("MetricManager", 0), 0) << "MetricManager is initialized shutting down...";
		initialized_ = false;
		for (auto& i : metric_plugins_)
		{
			try
			{
				std::string name = i->getLibName();
				i.reset(nullptr);
				TRACE_STREAMER(TLVL_DEBUG + 32, TLOG2("MetricManager", 0), 0) << "Metric Plugin " << name << " shutdown.";
			}
			catch (...)
			{
				TRACE_STREAMER(TLVL_ERROR, TLOG2("MetricManager", 0), 0) << "Exception caught in MetricManager::shutdown(), error shutting down metric with name "
				                                                         << i->getLibName();
			}
		}
		metric_plugins_.clear();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, std::string const& value, std::string const& unit,
                                       int level, MetricMode mode, std::string const& metricPrefix,
                                       bool useNameOverride)
{
	if (!initialized_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_WARNING) << "Attempted to send metric " << name << " when MetricManager has not yet been initialized!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (!running_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_INFO) << "Attempted to send metric when MetricManager stopped!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (active_)
	{
		{
			std::lock_guard<std::mutex> lk(metric_cache_mutex_);
			metric_calls_++;
			last_metric_received_ = std::chrono::steady_clock::now();
			auto& cached = metric_cache_[name];
			if (cached == nullptr)
			{
				metric_cache_[name] = std::make_unique<MetricData>(name, value, unit, level, mode, metricPrefix, useNameOverride);
			}
			else
			{
				auto size = cached->DataPointCount;
				if (size < metric_cache_max_size_)
				{
					if (size >= metric_cache_notify_size_)
					{
						TLOG(TLVL_DEBUG + 35) << "Metric cache is at size " << size << " of " << metric_cache_max_size_ << " for metric " << name
						                      << ".";
					}
					if (mode == MetricMode::LastPoint)
					{
						cached->StringValue = value;
						cached->DataPointCount = 1;
					}
					else
					{
						cached->StringValue += " " + value;
						cached->DataPointCount++;
					}
				}
				else
				{
					TLOG(TLVL_DEBUG + 36) << "Rejecting metric because queue full";
					missed_metric_calls_++;
				}
			}
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, int const& value, std::string const& unit, int level,
                                       MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_WARNING) << "Attempted to send metric " << name << " when MetricManager has not yet been initialized!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (!running_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_INFO) << "Attempted to send metric when MetricManager stopped!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (active_)
	{
		{
			std::lock_guard<std::mutex> lk(metric_cache_mutex_);
			metric_calls_++;
			last_metric_received_ = std::chrono::steady_clock::now();
			auto& cached = metric_cache_[name];
			if (cached == nullptr)
			{
				metric_cache_[name] = std::make_unique<MetricData>(name, value, unit, level, mode, metricPrefix, useNameOverride);
			}
			else
			{
				auto size = cached->DataPointCount;
				if (size < metric_cache_max_size_)
				{
					if (size >= metric_cache_notify_size_)
					{
						TLOG(TLVL_DEBUG + 35) << "Metric cache is at size " << size << " of " << metric_cache_max_size_ << " for metric " << name
						                      << ".";
					}
					cached->AddPoint(value);
				}
				else
				{
					TLOG(TLVL_DEBUG + 36) << "Rejecting metric because queue full";
					missed_metric_calls_++;
				}
			}
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, double const& value, std::string const& unit, int level,
                                       MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_WARNING) << "Attempted to send metric " << name << " when MetricManager has not yet been initialized!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (!running_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_INFO) << "Attempted to send metric when MetricManager stopped!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (active_)
	{
		{
			std::lock_guard<std::mutex> lk(metric_cache_mutex_);
			metric_calls_++;
			last_metric_received_ = std::chrono::steady_clock::now();
			auto& cached = metric_cache_[name];
			if (cached == nullptr)
			{
				metric_cache_[name] = std::make_unique<MetricData>(name, value, unit, level, mode, metricPrefix, useNameOverride);
			}
			else
			{
				auto size = cached->DataPointCount;
				if (size < metric_cache_max_size_)
				{
					if (size >= metric_cache_notify_size_)
					{
						TLOG(TLVL_DEBUG + 35) << "Metric cache is at size " << size << " of " << metric_cache_max_size_ << " for metric " << name
						                      << ".";
					}
					cached->AddPoint(value);
				}
				else
				{
					TLOG(TLVL_DEBUG + 36) << "Rejecting metric because queue full";
					missed_metric_calls_++;
				}
			}
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, float const& value, std::string const& unit, int level,
                                       MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_WARNING) << "Attempted to send metric " << name << " when MetricManager has not yet been initialized!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (!running_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_INFO) << "Attempted to send metric when MetricManager stopped!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (active_)
	{
		{
			std::lock_guard<std::mutex> lk(metric_cache_mutex_);
			metric_calls_++;
			last_metric_received_ = std::chrono::steady_clock::now();
			auto& cached = metric_cache_[name];
			if (cached == nullptr)
			{
				metric_cache_[name] = std::make_unique<MetricData>(name, value, unit, level, mode, metricPrefix, useNameOverride);
			}
			else
			{
				auto size = cached->DataPointCount;
				if (size < metric_cache_max_size_)
				{
					if (size >= metric_cache_notify_size_)
					{
						TLOG(TLVL_DEBUG + 35) << "Metric cache is at size " << size << " of " << metric_cache_max_size_ << " for metric " << name
						                      << ".";
					}
					cached->AddPoint(value);
				}
				else
				{
					TLOG(TLVL_DEBUG + 36) << "Rejecting metric because queue full";
					missed_metric_calls_++;
				}
			}
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, uint64_t const& value, std::string const& unit,
                                       int level, MetricMode mode, std::string const& metricPrefix,
                                       bool useNameOverride)
{
	if (!initialized_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_WARNING) << "Attempted to send metric " << name << " when MetricManager has not yet been initialized!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (!running_)
	{
		if (std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_failure_).count() > 1000)
		{
			TLOG(TLVL_INFO) << "Attempted to send metric when MetricManager stopped!";
			last_failure_ = std::chrono::steady_clock::now();
		}
	}
	else if (active_)
	{
		{
			std::lock_guard<std::mutex> lk(metric_cache_mutex_);
			metric_calls_++;
			last_metric_received_ = std::chrono::steady_clock::now();
			auto& cached = metric_cache_[name];
			if (cached == nullptr)
			{
				metric_cache_[name] = std::make_unique<MetricData>(name, value, unit, level, mode, metricPrefix, useNameOverride);
			}
			else
			{
				auto size = cached->DataPointCount;
				if (size < metric_cache_max_size_)
				{
					if (size >= metric_cache_notify_size_)
					{
						TLOG(TLVL_DEBUG + 35) << "Metric cache is at size " << size << " of " << metric_cache_max_size_ << " for metric " << name
						                      << ".";
					}
					cached->AddPoint(value);
				}
				else
				{
					TLOG(TLVL_DEBUG + 36) << "Rejecting metric because queue full";
					missed_metric_calls_++;
				}
			}
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::startMetricLoop_()
{
	if (metric_sending_thread_.joinable())
	{
		metric_sending_thread_.join();
	}
	boost::thread::attributes attrs;
	attrs.set_stack_size(4096 * 2000);  // 8000 KB
	TLOG(TLVL_INFO) << "Starting Metric Sending Thread";
	try
	{
		metric_sending_thread_ = boost::thread(attrs, boost::bind(&MetricManager::sendMetricLoop_, this));

		char tname[16];                                          // Size 16 - see man page pthread_setname_np(3) and/or prctl(2)
		snprintf(tname, sizeof(tname) - 1, "%s", "MetricSend");  // NOLINT
		tname[sizeof(tname) - 1] = '\0';                         // assure term. snprintf is not too evil :)
		auto handle = metric_sending_thread_.native_handle();
		pthread_setname_np(handle, tname);
	}
	catch (const boost::exception& e)
	{
		TLOG(TLVL_ERROR) << "Caught boost::exception starting Metric Sending thread: " << boost::diagnostic_information(e)
		                 << ", errno=" << errno;
		std::cerr << "Caught boost::exception starting Metric Sending thread: " << boost::diagnostic_information(e)
		          << ", errno=" << errno << std::endl;
		exit(5);
	}
	TLOG(TLVL_INFO) << "Metric Sending thread started";
}

bool artdaq::MetricManager::metricQueueEmpty()
{
	std::lock_guard<std::mutex> lk(metric_cache_mutex_);
	for (auto& cache_entry : metric_cache_)
	{
		if (cache_entry.second->DataPointCount > 0)
		{
			return false;
		}
	}

	return true;
}

bool artdaq::MetricManager::metricManagerBusy()
{
	bool pluginsBusy = false;

	for (auto& p : metric_plugins_)
	{
		if (p->metricsPending())
		{
			pluginsBusy = true;
			break;
		}
	}

	TLOG(TLVL_DEBUG + 33) << "Metric queue empty: " << metricQueueEmpty() << ", busy_: " << busy_ << ", Plugins busy: " << pluginsBusy;
	return !metricQueueEmpty() || busy_ || pluginsBusy;
}

size_t artdaq::MetricManager::metricQueueSize(std::string const& name)
{
	std::lock_guard<std::mutex> lk(metric_cache_mutex_);
	size_t size = 0;
	if (name.empty())
	{
		for (auto& q : metric_cache_)
		{
			size += q.second->DataPointCount;
		}
	}
	else
	{
		if (metric_cache_.count(name) != 0u)
		{
			size = metric_cache_[name]->DataPointCount;
		}
	}

	return size;
}

void artdaq::MetricManager::sendMetricLoop_()
{
	TLOG(TLVL_INFO) << "sendMetricLoop_ START";
	auto last_send_time = std::chrono::steady_clock::time_point();
	while (running_)
	{
		TLOG(TLVL_DEBUG + 34) << "sendMetricLoop_: Entering Metric input wait loop";
		while (metricQueueEmpty() && running_)
		{
			std::unique_lock<std::mutex> lk(metric_mutex_);
			metric_cv_.wait_for(lk, std::chrono::milliseconds(100));
			auto now = std::chrono::steady_clock::now();
			if (std::chrono::duration_cast<std::chrono::milliseconds>(now - last_send_time).count() >
			    metric_send_interval_ms_)
			{
				TLOG(TLVL_DEBUG + 34) << "sendMetricLoop_: Metric send interval exceeded: Sending metrics";
				{
					std::unique_lock<std::mutex> lk(metric_cache_mutex_);  // last_metric_received_ is protected by metric_cache_mutex_
					if (std::chrono::duration_cast<std::chrono::microseconds>(now - last_metric_received_).count() < metric_holdoff_us_)
					{
						lk.unlock();
						usleep(metric_holdoff_us_);
					}
				}
				for (auto& metric : metric_plugins_)
				{
					if (metric)
					{
						metric->sendMetrics();
					}
				}
				last_send_time = now;
			}
		}
		{
			std::unique_lock<std::mutex> lk(metric_cache_mutex_);  // last_metric_received_ is protected by metric_cache_mutex_
			if (std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - last_metric_received_).count() < metric_holdoff_us_)
			{
				lk.unlock();
				usleep(metric_holdoff_us_);
			}
		}

		TLOG(TLVL_DEBUG + 34) << "sendMetricLoop_: After Metric input wait loop";
		busy_ = true;
		auto processing_start = std::chrono::steady_clock::now();
		auto temp_list = std::list<std::unique_ptr<MetricData>>();
		{
			std::lock_guard<std::mutex> lk(metric_cache_mutex_);

			for (auto& q : metric_cache_)
			{
				if (q.second != nullptr && q.second->DataPointCount > 0)
				{
					temp_list.emplace_back(new MetricData(*q.second));
					q.second->Reset();
				}
			}
		}

		auto calls = metric_calls_.exchange(0);
		temp_list.emplace_back(
		    new MetricData("Metric Calls", calls, "metrics", 4, MetricMode::Accumulate | MetricMode::Rate, "", false));

		auto missed = missed_metric_calls_.exchange(0);
		temp_list.emplace_back(
		    new MetricData("Missed Metric Calls", missed, "metrics", 4, MetricMode::Accumulate | MetricMode::Rate, "", false));

		TLOG(TLVL_DEBUG + 33) << "There are " << temp_list.size() << " Metrics to process (" << calls << " calls, " << missed
		                      << " missed)";

		if (system_metric_collector_ != nullptr)
		{
			TLOG(TLVL_DEBUG + 33) << "Collecting System metrics (CPU, RAM, Network)";
			auto systemMetrics = system_metric_collector_->SendMetrics();
			for (auto& m : systemMetrics) { temp_list.emplace_back(std::move(m)); }
		}

		TLOG(TLVL_DEBUG + 34) << "sendMetricLoop_: Before processing temp_list";
		while (!temp_list.empty())
		{
			auto data_ = std::move(temp_list.front());
			temp_list.pop_front();
			if (data_->Type == MetricType::InvalidMetric)
			{
				continue;
			}
			if (!data_->UseNameOverride)
			{
				if (!data_->MetricPrefix.empty())
				{
					data_->Name = prefix_ + "." + data_->MetricPrefix + "." + data_->Name;
				}
				else
				{
					data_->Name = prefix_ + "." + data_->Name;
				}
			}

			for (auto& metric : metric_plugins_)
			{
				if (!metric)
				{
					continue;
				}
				if (metric->IsLevelEnabled(data_->Level))
				{
					try
					{
						metric->addMetricData(data_);
						last_send_time = std::chrono::steady_clock::now();
					}
					catch (...)
					{
						TLOG(TLVL_ERROR) << "Error in MetricManager::sendMetric: error sending value to metric plugin with name "
						                 << metric->getLibName();
					}
				}
			}
		}

		TLOG(TLVL_DEBUG + 34) << "sendMetricLoop_: Before sending metrics";
		for (auto& metric : metric_plugins_)
		{
			if (!metric)
			{
				continue;
			}
			metric->sendMetrics(false, processing_start);
		}

		// Limit rate of metrics going to plugins
		TLOG(TLVL_DEBUG + 34) << "sendMetricLoop_: End of working loop";
		busy_ = false;
		usleep(10000);
	}

	busy_ = true;
	auto temp_list = std::list<std::unique_ptr<MetricData>>();
	{
		std::lock_guard<std::mutex> lk(metric_cache_mutex_);

		for (auto& q : metric_cache_)
		{
			if (q.second != nullptr && q.second->DataPointCount > 0)
			{
				temp_list.emplace_back(new MetricData(*q.second));
				q.second->Reset();
			}
		}
		// metric_cache_.clear();
	}

	auto calls = metric_calls_.exchange(0);
	temp_list.emplace_back(
	    new MetricData("Metric Calls", calls, "metrics", 4, MetricMode::Accumulate | MetricMode::Rate, "", false));

	auto missed = missed_metric_calls_.exchange(0);
	temp_list.emplace_back(
	    new MetricData("Missed Metric Calls", missed, "metrics", 4, MetricMode::Accumulate | MetricMode::Rate, "", false));

	TLOG(TLVL_DEBUG + 33) << "There are " << temp_list.size() << " Metrics to process (" << calls << " calls, " << missed
	                      << " missed)";

	while (!temp_list.empty())
	{
		auto data_ = std::move(temp_list.front());
		temp_list.pop_front();
		if (data_->Type == MetricType::InvalidMetric)
		{
			continue;
		}
		if (!data_->UseNameOverride)
		{
			if (!data_->MetricPrefix.empty())
			{
				data_->Name = prefix_ + "." + data_->MetricPrefix + "." + data_->Name;
			}
			else
			{
				data_->Name = prefix_ + "." + data_->Name;
			}
		}

		for (auto& metric : metric_plugins_)
		{
			if (!metric)
			{
				continue;
			}
			if (metric->IsLevelEnabled(data_->Level))
			{
				try
				{
					metric->addMetricData(data_);
					last_send_time = std::chrono::steady_clock::now();
				}
				catch (...)
				{
					TLOG(TLVL_ERROR) << "Error in MetricManager::sendMetric: error sending value to metric plugin with name "
					                 << metric->getLibName();
				}
			}
		}
	}

	for (auto& metric : metric_plugins_)
	{
		if (!metric)
		{
			continue;
		}
		try
		{
			metric->stopMetrics();
			TLOG(TLVL_DEBUG + 32) << "Metric Plugin " << metric->getLibName() << " stopped.";
		}
		catch (...)
		{
			TLOG(TLVL_ERROR) << "Exception caught in MetricManager::do_stop(), error stopping plugin with name "
			                 << metric->getLibName();
		}
	}
	busy_ = false;
	TLOG(TLVL_DEBUG + 32) << "MetricManager has been stopped.";
}
