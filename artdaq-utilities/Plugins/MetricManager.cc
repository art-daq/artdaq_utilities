// MetricManager.cc: MetricManager class implementation file
// Author: Eric Flumerfelt
// Last Modified: 11/14/2014
//
// MetricManager loads a user-specified set of plugins, sends them their configuration,
// and sends them data as it is recieved. It also maintains the state of the plugins
// relative to the application state.

#define TRACE_NAME "MetricManager"
#include "tracemf.h"
#include "artdaq-utilities/Plugins/MetricManager.hh"
#include "artdaq-utilities/Plugins/makeMetricPlugin.hh"
#include "fhiclcpp/ParameterSet.h"

#include <chrono>
#include <boost/exception/all.hpp>

artdaq::MetricManager::
MetricManager() : metric_plugins_(0)
, metric_send_interval_ms_(15000)
, initialized_(false)
, running_(false)
, active_(false)
, missed_metric_calls_(0)
, metric_queue_max_size_(1000)
, metric_queue_notify_size_(10)
{}

artdaq::MetricManager::~MetricManager() noexcept
{
	shutdown();
}

void artdaq::MetricManager::initialize(fhicl::ParameterSet const& pset, std::string const& prefix)
{
	prefix_ = prefix;
	if (initialized_)
	{
		shutdown();
	}
	TLOG(TLVL_INFO) << "Configuring metrics with parameter set: " << pset.to_string() ;

	std::vector<std::string> names = pset.get_pset_names();

	for (auto name : names)
	{
		if (name == "metric_queue_size")
		{
			metric_queue_max_size_ = pset.get<size_t>("metric_queue_size");
		}
		else if (name == "metric_queue_notify_size")
		{
			metric_queue_notify_size_ = pset.get<size_t>("metric_queue_notify_size");
		}
		else if (name == "metric_send_maximum_delay_ms")
		{
			metric_send_interval_ms_ = pset.get<int>("metric_send_maximum_delay_ms");
		}
		else
		{
			try
			{
				TLOG(TLVL_DEBUG) << "Constructing metric plugin with name " << name ;
				fhicl::ParameterSet plugin_pset = pset.get<fhicl::ParameterSet>(name);
				metric_plugins_.push_back(makeMetricPlugin(
					plugin_pset.get<std::string>("metricPluginType", ""), plugin_pset, prefix_));
			}
			catch (const cet::exception& e)
			{
				TLOG(TLVL_ERROR) << "Exception caught in MetricManager::initialize, error loading plugin with name " << name <<
					", cet::exception object caught:" << e.explain_self() ;
			}
			catch (const boost::exception& e)
			{
				TLOG(TLVL_ERROR) << "Exception caught in MetricManager::initialize, error loading plugin with name " << name <<
					", boost::exception object caught: " << boost::diagnostic_information(e) ;
			}
			catch (const std::exception& e)
			{
				TLOG(TLVL_ERROR) << "Exception caught in MetricManager::initialize, error loading plugin with name " << name <<
					", std::exception caught: " << e.what() ;
			}
			catch (...)
			{
				TLOG(TLVL_ERROR) << "Unknown Exception caught in MetricManager::initialize, error loading plugin with name " << name ;
			}
		}
	}

	initialized_ = true;
}

void artdaq::MetricManager::do_start()
{
	if (!running_)
	{
		TLOG(TLVL_DEBUG) << "Starting MetricManager" ;
		for (auto& metric : metric_plugins_)
		{
			try
			{
				metric->startMetrics();
				TLOG(TLVL_INFO) << "Metric Plugin " << metric->getLibName() << " started." ;
				active_ = true;
			}
			catch (...)
			{
				TLOG(TLVL_ERROR) <<
					"Exception caught in MetricManager::do_start(), error starting plugin with name " <<
					metric->getLibName() ;
			}
		}
		running_ = true;
		startMetricLoop_();
	}
}

void artdaq::MetricManager::do_stop()
{
	TLOG(TLVL_DEBUG) << "Stopping Metrics" ;
	running_ = false;
	metric_cv_.notify_all();
	TLOG(TLVL_DEBUG) << "Joining Metric-Sending thread" ;
	if (metric_sending_thread_.joinable()) metric_sending_thread_.join();
	TLOG(TLVL_DEBUG) << "do_stop Complete" ;
}

void artdaq::MetricManager::do_pause() { /*do_stop();*/ }
void artdaq::MetricManager::do_resume() { /*do_start();*/ }

void artdaq::MetricManager::reinitialize(fhicl::ParameterSet const& pset, std::string const& prefix)
{
	shutdown();
	initialize(pset, prefix);
}

void artdaq::MetricManager::shutdown()
{
	TLOG(TLVL_DEBUG) << "MetricManager is shutting down..." ;
	do_stop();

	if (initialized_)
	{
		for (auto& i : metric_plugins_)
		{
			try
			{
				std::string name = i->getLibName();
				i.reset(nullptr);
				TLOG(TLVL_DEBUG) << "Metric Plugin " << name << " shutdown." ;
			}
			catch (...)
			{
				TLOG(TLVL_ERROR) <<
					"Exception caught in MetricManager::shutdown(), error shutting down metric with name " <<
					i->getLibName() ;
			}
		}
		initialized_ = false;
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, std::string const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager has not yet been initialized!" ; }
	else if (!running_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager stopped!" ; }
	else if (active_)
	{
		if (!metric_queue_.count(name)) {
			metric_queue_[name] = std::make_pair<size_t, std::list<metric_data_ptr>>(0, std::list<metric_data_ptr>());
		}
		auto entry = &(metric_queue_[name]);

		auto size = entry->first;
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG(9) << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." ;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				entry->first++;
				entry->second.emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG(10) << "Rejecting metric because queue full" ;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager has not yet been initialized!" ; }
	else if (!running_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager stopped!" ; }
	else if (active_)
	{
		if (!metric_queue_.count(name)) {
			metric_queue_[name] = std::make_pair<size_t, std::list<metric_data_ptr>>(0, std::list<metric_data_ptr>());
		}
		auto entry = &(metric_queue_[name]);

		auto size = entry->first;
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG(9) << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." ;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				entry->first++;
				entry->second.emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG(10) << "Rejecting metric because queue full" ;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, double const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager has not yet been initialized!" ; }
	else if (!running_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager stopped!" ; }
	else if (active_)
	{
		if (!metric_queue_.count(name)) {
			metric_queue_[name] = std::make_pair<size_t, std::list<metric_data_ptr>>(0, std::list<metric_data_ptr>());
		}
		auto entry = &(metric_queue_[name]);

		auto size = entry->first;
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG(9) << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." ;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				entry->first++;
				entry->second.emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG(10) << "Rejecting metric because queue full" ;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, float const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager has not yet been initialized!" ; }
	else if (!running_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager stopped!" ; }
	else if (active_)
	{
		if (!metric_queue_.count(name)) {
			metric_queue_[name] = std::make_pair<size_t, std::list<metric_data_ptr>>(0, std::list<metric_data_ptr>());
		}
		auto entry = &(metric_queue_[name]);

		auto size = entry->first;
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG(9) << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." ;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				entry->first++;
				entry->second.emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG(10) << "Rejecting metric because queue full" ;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, long unsigned int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager has not yet been initialized!" ; }
	else if (!running_) { TLOG(TLVL_WARNING) << "Attempted to send metric when MetricManager stopped!" ; }
	else if (active_)
	{
		if (!metric_queue_.count(name)) {
			metric_queue_[name] = std::make_pair<size_t, std::list<metric_data_ptr>>(0, std::list<metric_data_ptr>());
		}
		auto entry = &(metric_queue_[name]);

		auto size = entry->first;
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG(9) << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." ;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				entry->first++;
				entry->second.emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG(10) << "Rejecting metric because queue full" ;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::startMetricLoop_()
{
	if (metric_sending_thread_.joinable()) metric_sending_thread_.join();
	boost::thread::attributes attrs;
	attrs.set_stack_size(4096 * 2000); // 8000 KB
	TLOG(TLVL_INFO) << "Starting Metric Sending Thread" ;
	try {
		metric_sending_thread_ = boost::thread(attrs, boost::bind(&MetricManager::sendMetricLoop_, this));
	}
	catch (const boost::exception& e)
	{
		TLOG(TLVL_ERROR) << "Caught boost::exception starting Metric Sending thread: " << boost::diagnostic_information(e) << ", errno=" << errno;
		std::cerr << "Caught boost::exception starting Metric Sending thread: " << boost::diagnostic_information(e) << ", errno=" << errno << std::endl;
		exit(5);
	}
	TLOG(TLVL_INFO) << "Metric Sending thread started";
}

bool artdaq::MetricManager::metricQueueEmpty()
{
	for (auto& q : metric_queue_)
	{
		if (q.second.first != 0) return false;
	}
	return true;
}

size_t artdaq::MetricManager::metricQueueSize(std::string const& name)
{
	std::unique_lock<std::mutex> lk(metric_queue_mutex_);
	size_t size = 0;
	if (name == "") {
		for (auto& q : metric_queue_)
		{
			size += q.second.first;
		}
	}
	else {
		if (metric_queue_.count(name)) size = metric_queue_[name].first;
	}

	return size;
}

void artdaq::MetricManager::sendMetricLoop_()
{
	TLOG(TLVL_INFO) << "sendMetricLoop_ START";
	auto last_send_time = std::chrono::steady_clock::time_point();
	while (running_)
	{
		while (metricQueueEmpty() && running_)
		{
			std::unique_lock<std::mutex> lk(metric_mutex_);
			metric_cv_.wait_for(lk, std::chrono::milliseconds(100));
			auto now = std::chrono::steady_clock::now();
			if (std::chrono::duration_cast<std::chrono::milliseconds>(now - last_send_time).count() > metric_send_interval_ms_)
			{
				for (auto& metric : metric_plugins_) { metric->sendMetrics(); }
				last_send_time = now;
			}
		}

		auto processing_start = std::chrono::steady_clock::now();
		auto temp_list = std::list<std::unique_ptr<MetricData>>();
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);

			for (auto& q : metric_queue_)
			{
				temp_list.splice(temp_list.end(), q.second.second);
				q.second.first = 0;
			}

			temp_list.emplace_back(new MetricData("Metric Calls", temp_list.size(), "metrics", 4, MetricMode::AccumulateAndRate, "", false));
			auto missed = missed_metric_calls_.exchange(0);

			temp_list.emplace_back(new MetricData("Missed Metric Calls", missed, "metrics", 4, MetricMode::AccumulateAndRate, "", false));
			TLOG(TLVL_TRACE) << "There are " << temp_list.size() << " Metric Calls to process (missed " << missed << ")" ;
		}

		while (temp_list.size() > 0)
		{
			auto data_ = std::move(temp_list.front());
			temp_list.pop_front();
			if (data_->Type == MetricType::InvalidMetric) continue;
			if (!data_->UseNameOverride)
			{
				if (data_->MetricPrefix.size() > 0)
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
				if (metric->getRunLevel() >= data_->Level)
				{
					try
					{
						metric->addMetricData(*data_);
						last_send_time = std::chrono::steady_clock::now();
					}
					catch (...)
					{
						TLOG(TLVL_ERROR) <<
							"Error in MetricManager::sendMetric: error sending value to metric plugin with name "
							<< metric->getLibName() ;
					}
				}
			}
		}

		for (auto& metric : metric_plugins_)
		{
			metric->sendMetrics(false, processing_start);
		}
	}

	auto temp_list = std::list<std::unique_ptr<MetricData>>();
	{
		std::unique_lock<std::mutex> lk(metric_queue_mutex_);

		for (auto& q : metric_queue_)
		{
			temp_list.splice(temp_list.end(), q.second.second);
		}
		metric_queue_.clear();

		temp_list.emplace_back(new MetricData("Metric Calls", temp_list.size(), "metrics", 4, MetricMode::AccumulateAndRate, "", false));
		auto missed = missed_metric_calls_.exchange(0);

		temp_list.emplace_back(new MetricData("Missed Metric Calls", missed, "metrics", 4, MetricMode::AccumulateAndRate, "", false));
		TLOG(TLVL_TRACE) << "There are " << temp_list.size() << " Metric Calls to process (missed " << missed << ")" ;
	}

	while (temp_list.size() > 0)
	{
		auto data_ = std::move(temp_list.front());
		temp_list.pop_front();
		if (data_->Type == MetricType::InvalidMetric) continue;
		if (!data_->UseNameOverride)
		{
			if (data_->MetricPrefix.size() > 0)
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
			if (metric->getRunLevel() >= data_->Level)
			{
				try
				{
					metric->addMetricData(*data_);
					last_send_time = std::chrono::steady_clock::now();
				}
				catch (...)
				{
					TLOG(TLVL_ERROR) <<
						"Error in MetricManager::sendMetric: error sending value to metric plugin with name "
						<< metric->getLibName() ;
				}
			}
		}
	}

	for (auto& metric : metric_plugins_)
	{
		try
		{
			metric->stopMetrics();
			TLOG(TLVL_DEBUG) << "Metric Plugin " << metric->getLibName() << " stopped." ;
		}
		catch (...)
		{
			TLOG(TLVL_ERROR) <<
				"Exception caught in MetricManager::do_stop(), error stopping plugin with name " <<
				metric->getLibName() ;
		}
	}
	TLOG(TLVL_DEBUG) << "MetricManager has been stopped." ;
}
