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
, initialized_(false)
, running_(false)
, active_(false)
, missed_metric_calls_(0)
, metric_queue_max_size_(1000)
, metric_queue_notify_size_(10)
{}

artdaq::MetricManager::~MetricManager()
{
	shutdown();
}

void artdaq::MetricManager::initialize(fhicl::ParameterSet const& pset, std::string prefix)
{
	prefix_ = prefix;
	if (initialized_)
	{
		shutdown();
	}
	TLOG_INFO("MetricManager") << "Configuring metrics with parameter set:\n" << pset.to_string() << TLOG_ENDL;

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
		else
		{
			try
			{
				TLOG_DEBUG("MetricManager") << "Constructing metric plugin with name " << name << TLOG_ENDL;
				fhicl::ParameterSet plugin_pset = pset.get<fhicl::ParameterSet>(name);
				metric_plugins_.push_back(makeMetricPlugin(
					plugin_pset.get<std::string>("metricPluginType", ""), plugin_pset));
			}
			catch (const cet::exception& e)
			{
				TLOG_ERROR("MetricManager") << "Exception caught in MetricManager::initialize, error loading plugin with name " << name <<
					", cet::exception object caught:" << e.explain_self() << TLOG_ENDL;
			}
			catch (const boost::exception& e)
			{
				TLOG_ERROR("MetricManager") << "Exception caught in MetricManager::initialize, error loading plugin with name " << name <<
					", boost::exception object caught: " << boost::diagnostic_information(e) << TLOG_ENDL;
			}
			catch (const std::exception& e)
			{
				TLOG_ERROR("MetricManager") << "Exception caught in MetricManager::initialize, error loading plugin with name " << name <<
					", std::exception caught: " << e.what() << TLOG_ENDL;
			}
			catch (...)
			{
				TLOG_ERROR("MetricManager") << "Unknown Exception caught in MetricManager::initialize, error loading plugin with name " << name << TLOG_ENDL;
			}
		}
	}

	initialized_ = true;
}

void artdaq::MetricManager::do_start()
{
	if (!running_)
	{
		TLOG_DEBUG("MetricManager") << "Starting MetricManager" << TLOG_ENDL;
		for (auto& metric : metric_plugins_)
		{
			try
			{
				metric->startMetrics();
				TLOG_INFO("MetricManager") << "Metric Plugin " << metric->getLibName() << " started." << TLOG_ENDL;
				active_ = true;
			}
			catch (...)
			{
				TLOG_ERROR("MetricManager") <<
					"Exception caught in MetricManager::do_start(), error starting plugin with name " <<
					metric->getLibName() << TLOG_ENDL;
			}
		}
		running_ = true;
		startMetricLoop_();
	}
}

void artdaq::MetricManager::do_stop()
{
	TLOG_DEBUG("MetricManager") << "Stopping Metrics" << TLOG_ENDL;
	running_ = false;
	metric_cv_.notify_all();
	TLOG_DEBUG("MetricManager") << "Joining Metric-Sending thread" << TLOG_ENDL;
	if (metric_sending_thread_.joinable()) metric_sending_thread_.join();
	TLOG_DEBUG("MetricManager") << "do_stop Complete" << TLOG_ENDL;
}

void artdaq::MetricManager::do_pause() { /*do_stop();*/ }
void artdaq::MetricManager::do_resume() { /*do_start();*/ }

void artdaq::MetricManager::reinitialize(fhicl::ParameterSet const& pset, std::string prefix)
{
	shutdown();
	initialize(pset, prefix);
}

void artdaq::MetricManager::shutdown()
{
	TLOG_DEBUG("MetricManager") << "MetricManager is shutting down..." << TLOG_ENDL;
	do_stop();

	if (initialized_)
	{
		for (auto& i : metric_plugins_)
		{
			try
			{
				std::string name = i->getLibName();
				i.reset(nullptr);
				TLOG_DEBUG("MetricManager") << "Metric Plugin " << name << " shutdown." << TLOG_ENDL;
			}
			catch (...)
			{
				TLOG_ERROR("MetricManager") <<
					"Exception caught in MetricManager::shutdown(), error shutting down metric with name " <<
					i->getLibName() << TLOG_ENDL;
			}
		}
		initialized_ = false;
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, std::string const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!" << TLOG_ENDL; }
	else if (!running_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager stopped!" << TLOG_ENDL; }
	else if (active_)
	{
		auto size = metric_queue_[name].size();
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG_ARB(9, "MetricManager") << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." << TLOG_ENDL;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				metric_queue_[name].emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG_ARB(10, "MetricManager") << "Rejecting metric because queue full" << TLOG_ENDL;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!" << TLOG_ENDL; }
	else if (!running_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager stopped!" << TLOG_ENDL; }
	else if (active_)
	{
		auto size = metric_queue_[name].size();
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG_ARB(9, "MetricManager") << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." << TLOG_ENDL;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				metric_queue_[name].emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG_ARB(10, "MetricManager") << "Rejecting metric because queue full" << TLOG_ENDL;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, double const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!" << TLOG_ENDL; }
	else if (!running_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager stopped!" << TLOG_ENDL; }
	else if (active_)
	{
		auto size = metric_queue_[name].size();
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG_ARB(9, "MetricManager") << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." << TLOG_ENDL;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				metric_queue_[name].emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG_ARB(10, "MetricManager") << "Rejecting metric because queue full" << TLOG_ENDL;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, float const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!" << TLOG_ENDL; }
	else if (!running_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager stopped!" << TLOG_ENDL; }
	else if (active_)
	{
		auto size = metric_queue_[name].size();
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG_ARB(9, "MetricManager") << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." << TLOG_ENDL;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				metric_queue_[name].emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG_ARB(10, "MetricManager") << "Rejecting metric because queue full" << TLOG_ENDL;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::sendMetric(std::string const& name, long unsigned int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
{
	if (!initialized_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!" << TLOG_ENDL; }
	else if (!running_) { TLOG_WARNING("MetricManager") << "Attempted to send metric when MetricManager stopped!" << TLOG_ENDL; }
	else if (active_)
	{
		auto size = metric_queue_[name].size();
		if (size < metric_queue_max_size_)
		{
			if (size >= metric_queue_notify_size_) TLOG_ARB(9, "MetricManager") << "Metric queue is at size " << size << " of " << metric_queue_max_size_ << "." << TLOG_ENDL;
			std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, mode, metricPrefix, useNameOverride));
			{
				std::unique_lock<std::mutex> lk(metric_queue_mutex_);
				metric_queue_[name].emplace_back(std::move(metric));
			}
		}
		else
		{
			TLOG_ARB(10, "MetricManager") << "Rejecting metric because queue full" << TLOG_ENDL;
			missed_metric_calls_++;
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::startMetricLoop_()
{
	if (metric_sending_thread_.joinable()) metric_sending_thread_.join();
	TLOG_INFO("MetricManager") << "Starting Metric Sending Thread" << TLOG_ENDL;
	boost::thread::attributes attrs;
	attrs.set_stack_size(4096 * 200); // 800 KB
	metric_sending_thread_ = boost::thread(attrs, boost::bind(&MetricManager::sendMetricLoop_, this));
}

bool artdaq::MetricManager::metricQueueEmpty_()
{
	for (auto& q : metric_queue_)
	{
		if (!q.second.empty()) return false;
	}
	return true;
}

void artdaq::MetricManager::sendMetricLoop_()
{
	auto last_send_time = std::chrono::steady_clock::time_point();
	while (running_)
	{
		while (metricQueueEmpty_() && running_)
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

		auto temp_list = std::list<std::unique_ptr<MetricData>>();
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);

			for (auto& q : metric_queue_)
			{
				temp_list.splice(temp_list.end(), q.second);
			}
			metric_queue_.clear();

			temp_list.emplace_back(new MetricData("Metric Calls", temp_list.size(), "metrics", 4, MetricMode::Accumulate, "", false));
			auto missed = missed_metric_calls_.exchange(0);

			temp_list.emplace_back(new MetricData("Missed Metric Calls", missed, "metrics", 4, MetricMode::Accumulate, "", false));
			TLOG_TRACE("MetricManager") << "There are " << temp_list.size() << " Metric Calls to process (missed " << missed << ")" << TLOG_ENDL;
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
						TLOG_ERROR("MetricManager") <<
							"Error in MetricManager::sendMetric: error sending value to metric plugin with name "
							<< metric->getLibName() << TLOG_ENDL;
					}
				}
			}
		}

		for (auto& metric : metric_plugins_)
		{
			metric->sendMetrics();
		}
	}

	for (auto& metric : metric_plugins_)
	{
		try
		{
			metric->stopMetrics();
			TLOG_DEBUG("MetricManager") << "Metric Plugin " << metric->getLibName() << " stopped." << TLOG_ENDL;
		}
		catch (...)
		{
			TLOG_ERROR("MetricManager") <<
				"Exception caught in MetricManager::do_stop(), error stopping plugin with name " <<
				metric->getLibName() << TLOG_ENDL;
		}
	}
	TLOG_DEBUG("MetricManager") << "MetricManager has been stopped." << TLOG_ENDL;
}
