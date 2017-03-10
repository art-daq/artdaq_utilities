// MetricManager.cc: MetricManager class implementation file
// Author: Eric Flumerfelt
// Last Modified: 11/14/2014
//
// MetricManager loads a user-specified set of plugins, sends them their configuration,
// and sends them data as it is recieved. It also maintains the state of the plugins
// relative to the application state.

#include "artdaq-utilities/Plugins/MetricManager.hh"
#include "artdaq-utilities/Plugins/makeMetricPlugin.hh"
#include "messagefacility/MessageLogger/MessageLogger.h"
#include "fhiclcpp/ParameterSet.h"

#include <chrono>

artdaq::MetricManager::
MetricManager() : metric_plugins_(0), initialized_(false), running_(false), active_(false) { }

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
	mf::LogDebug("MetricManager") << "Configuring metrics with parameter set:\n" << pset.to_string();

	std::vector<std::string> names = pset.get_pset_names();

	for (auto name : names)
	{
		try {
			mf::LogDebug("MetricManager") << "Constructing metric plugin with name " << name;
			fhicl::ParameterSet plugin_pset = pset.get<fhicl::ParameterSet>(name);
			metric_plugins_.push_back(makeMetricPlugin(
				plugin_pset.get<std::string>("metricPluginType", ""), plugin_pset));
		}
		catch (...) {
			mf::LogError("MetricManager") << "Exception caught in MetricManager::initialize, error loading plugin with name " << name;
		}
	}

	initialized_ = true;
}

void artdaq::MetricManager::do_start()
{
	if (!running_) {
		mf::LogDebug("MetricManager") << "Starting MetricManager";
		for (auto & metric : metric_plugins_)
		{
			try {
				metric->startMetrics();
				mf::LogDebug("MetricManager") << "Metric Plugin " << metric->getLibName() << " started.";
				active_ = true;
			}
			catch (...) {
				mf::LogError("MetricManager") <<
					"Exception caught in MetricManager::do_start(), error starting plugin with name " <<
					metric->getLibName();
			}
		}
		running_ = true;
		startMetricLoop_();
	}
}

void artdaq::MetricManager::do_stop()
{
	running_ = false;
	metric_cv_.notify_all();
	if (metric_sending_thread_.joinable()) metric_sending_thread_.join();
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
	mf::LogDebug("MetricManager") << "MetricManager is shutting down...";
	do_stop();

	if (initialized_)
	{
		for (auto & i : metric_plugins_)
		{
			try {
				std::string name = i->getLibName();
				i.reset(nullptr);
				mf::LogDebug("MetricManager") << "Metric Plugin " << name << " shutdown.";
			}
			catch (...) {
				mf::LogError("MetricManager") <<
					"Exception caught in MetricManager::shutdown(), error shutting down metric with name " <<
					i->getLibName();
			}
		}
		initialized_ = false;
	}
}

void  artdaq::MetricManager::sendMetric(std::string const& name, std::string const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride) {
	if (!initialized_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!";
	else if (!running_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	else if (active_) {
		std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, accumulate, metricPrefix, useNameOverride));
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);
			metric_queue_.push_back(std::move(metric));
		}
		metric_cv_.notify_all();
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, int const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride) {
	if (!initialized_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!";
	else if (!running_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	else if (active_) {
		std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, accumulate, metricPrefix, useNameOverride));
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);
			metric_queue_.push_back(std::move(metric));
		}
		metric_cv_.notify_all();
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, double const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride) {
	if (!initialized_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!";
	else if (!running_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	else if (active_) {
		std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, accumulate, metricPrefix, useNameOverride));
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);
			metric_queue_.push_back(std::move(metric));
		}
		metric_cv_.notify_all();
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, float const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride) {
	if (!initialized_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!";
	else if (!running_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	else if (active_) {
		std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, accumulate, metricPrefix, useNameOverride));
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);
			metric_queue_.push_back(std::move(metric));
		}
		metric_cv_.notify_all();
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, long unsigned int const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride) {
	if (!initialized_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager has not yet been initialized!";
	else if (!running_) mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	else if (active_) {
		std::unique_ptr<MetricData> metric(new MetricData(name, value, unit, level, accumulate, metricPrefix, useNameOverride));
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);
			metric_queue_.push_back(std::move(metric));
		}
		metric_cv_.notify_all();
	}
}

void artdaq::MetricManager::startMetricLoop_()
{
	if (metric_sending_thread_.joinable()) metric_sending_thread_.join();
	mf::LogInfo("MetricManager") << "Starting Metric Sending Thread" << std::endl;
	metric_sending_thread_ = std::thread(&MetricManager::sendMetricLoop_, this);
}

void  artdaq::MetricManager::sendMetricLoop_()
{
	while (running_) {
		while (metric_queue_.size() == 0 && running_) {
			std::unique_lock<std::mutex> lk(metric_mutex_);
			metric_cv_.wait_for(lk, std::chrono::milliseconds(100));
		}

		auto temp_list = std::list<std::unique_ptr<MetricData>>();
		{
			std::unique_lock<std::mutex> lk(metric_queue_mutex_);
			temp_list.swap(metric_queue_);
		}

		while (temp_list.size() > 0) {
			auto data_ = std::move(temp_list.front());
			temp_list.pop_front();
			if (data_->type_ == MetricData::InvalidMetric) continue;
			std::string nameTemp = data_->name_;
			if (!data_->useNameOverride_) {
				if (data_->metricPrefix_.size() > 0) {
					nameTemp = prefix_ + "." + data_->metricPrefix_ + "." + data_->name_;
				}
				else {
					nameTemp = prefix_ + "." + data_->name_;
				}
			}

			for (auto & metric : metric_plugins_)
			{
				if (metric->getRunLevel() >= data_->level_) {
					try {
						switch (data_->type_) {
						case MetricData::StringMetric:
							metric->sendMetric(nameTemp, data_->stringValue_, data_->unit_, data_->accumulate_);
							break;
						case MetricData::IntMetric:
							metric->sendMetric(nameTemp, data_->intValue_, data_->unit_, data_->accumulate_);
							break;
						case MetricData::DoubleMetric:
							metric->sendMetric(nameTemp, data_->doubleValue_, data_->unit_, data_->accumulate_);
							break;
						case MetricData::FloatMetric:
							metric->sendMetric(nameTemp, data_->floatValue_, data_->unit_, data_->accumulate_);
							break;
						case MetricData::UnsignedMetric:
							metric->sendMetric(nameTemp, data_->unsignedValue_, data_->unit_, data_->accumulate_);
							break;
						case MetricData::InvalidMetric:
							break;
						}
					}
					catch (...) {
						mf::LogError("MetricManager") <<
							"Error in MetricManager::sendMetric: error sending value to metric plugin with name "
							<< metric->getLibName();
					}
				}
			}
		}
	}

	for (auto & metric : metric_plugins_)
	{
		try {
			metric->stopMetrics();
			mf::LogDebug("MetricManager") << "Metric Plugin " << metric->getLibName() << " stopped.";
		}
		catch (...) {
			mf::LogError("MetricManager") <<
				"Exception caught in MetricManager::do_stop(), error stopping plugin with name " <<
				metric->getLibName();
		}
	}
	mf::LogDebug("MetricManager") << "MetricManager has been stopped.";
}