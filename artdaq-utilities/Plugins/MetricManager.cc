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

#include <sstream>

artdaq::MetricManager::
MetricManager() : metric_plugins_(0), initialized_(false), running_(false) { }

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
		if(metric_sending_thread_.joinable()) metric_sending_thread_.join();
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

void  artdaq::MetricManager::sendMetric(std::string const& name, std::string const& value, std::string const& unit, int level, bool accumulate, std::string metricPrefix, bool useNameOverride) {
	if (initialized_ && !running_) {
		mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	}
	else if (running_ && initialized_) {
		metric_queue_.emplace_back(name, value, unit, level, accumulate, metricPrefix, useNameOverride);
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, int const& value, std::string const& unit, int level, bool accumulate, std::string metricPrefix, bool useNameOverride) {
	if (initialized_ && !running_) {
		mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	}
	else if (running_ && initialized_) {
		metric_queue_.emplace_back(name, value, unit, level, accumulate, metricPrefix, useNameOverride);
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, double const& value, std::string const& unit, int level, bool accumulate, std::string metricPrefix, bool useNameOverride) {
	if (initialized_ && !running_) {
		mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	}
	else if (running_ && initialized_) {
		metric_queue_.emplace_back(name, value, unit, level, accumulate, metricPrefix, useNameOverride);
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, float const& value, std::string const& unit, int level, bool accumulate, std::string metricPrefix, bool useNameOverride) {
	if (initialized_ && !running_) {
		mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	}
	else if (running_ && initialized_) {
		metric_queue_.emplace_back(name, value, unit, level, accumulate, metricPrefix, useNameOverride);
	}
}
void  artdaq::MetricManager::sendMetric(std::string const& name, long unsigned int const& value, std::string const& unit, int level, bool accumulate, std::string metricPrefix, bool useNameOverride) {
	if (initialized_ && !running_) {
		mf::LogWarning("MetricManager") << "Attempted to send metric when MetricManager stopped!";
	}
	else if(running_ && initialized_) {
		metric_queue_.emplace_back(name, value, unit, level, accumulate, metricPrefix, useNameOverride);
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
		if (metric_queue_.size() > 0) {
			std::string nameTemp = metric_queue_.front().name_;
			if (!metric_queue_.front().useNameOverride_) {
				if (metric_queue_.front().metricPrefix_.size() > 0) {
					nameTemp = prefix_ + "." + metric_queue_.front().metricPrefix_ + "." + metric_queue_.front().name_;
				}
				else {
					nameTemp = prefix_ + "." + metric_queue_.front().name_;
				}
			}

			for (auto & metric : metric_plugins_)
			{
				if (metric->getRunLevel() >= metric_queue_.front().level_) {
					try {
						switch (metric_queue_.front().type_) {
						case MetricData::StringMetric:
							metric->sendMetric(nameTemp, metric_queue_.front().stringValue_, metric_queue_.front().unit_, metric_queue_.front().accumulate_);
							break;
						case MetricData::IntMetric:
							metric->sendMetric(nameTemp, metric_queue_.front().intValue_, metric_queue_.front().unit_, metric_queue_.front().accumulate_);
							break;
						case MetricData::DoubleMetric:
							metric->sendMetric(nameTemp, metric_queue_.front().doubleValue_, metric_queue_.front().unit_, metric_queue_.front().accumulate_);
							break;
						case MetricData::FloatMetric:
							metric->sendMetric(nameTemp, metric_queue_.front().floatValue_, metric_queue_.front().unit_, metric_queue_.front().accumulate_);
							break;
						case MetricData::UnsignedMetric:
							metric->sendMetric(nameTemp, metric_queue_.front().unsignedValue_, metric_queue_.front().unit_, metric_queue_.front().accumulate_);
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
			metric_queue_.pop_front();
		}
		else {
			usleep(10000);
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