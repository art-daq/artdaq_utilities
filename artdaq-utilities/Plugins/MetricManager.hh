#ifndef artdaq_DAQrate_MetricManager_hh
#define artdaq_DAQrate_MetricManager_hh

// MetricManager class definition file
// Author: Eric Flumerfelt
// Last Modified: 11/14/2014
//
// MetricManager loads a user-specified set of plugins, sends them their configuration,
// and sends them data as it is recieved. It also maintains the state of the plugins
// relative to the application state.

#include "artdaq-utilities/Plugins/MetricPlugin.hh"
#include "fhiclcpp/fwd.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <sstream>
#include <list>
#include <thread>
#include <condition_variable>
#include <atomic>

namespace artdaq
{
	class MetricManager;
}

class artdaq::MetricManager
{
public:
	MetricManager();

	MetricManager(MetricManager const&) = delete;

	virtual ~MetricManager() noexcept;

	MetricManager& operator=(MetricManager const&) = delete;

	void initialize(fhicl::ParameterSet const&, std::string prefix = "");

	void do_start();

	void do_stop();

	void do_pause();

	void do_resume();

	void reinitialize(fhicl::ParameterSet const&, std::string prefix = "");

	void shutdown();

	void sendMetric(std::string const& name, std::string const& value, std::string const& unit, int level, bool accumulate = true, std::string const& metricPrefix = "", bool useNameOverride = false);

	void sendMetric(std::string const& name, int const& value, std::string const& unit, int level, bool accumulate = true, std::string const& metricPrefix = "", bool useNameOverride = false);

	void sendMetric(std::string const& name, double const& value, std::string const& unit, int level, bool accumulate = true, std::string const& metricPrefix = "", bool useNameOverride = false);

	void sendMetric(std::string const& name, float const& value, std::string const& unit, int level, bool accumulate = true, std::string const& metricPrefix = "", bool useNameOverride = false);

	void sendMetric(std::string const& name, long unsigned int const& value, std::string const& unit, int level, bool accumulate = true, std::string const& metricPrefix = "", bool useNameOverride = false);

	void setPrefix(std::string prefix) { prefix_ = prefix; }

private:
	void sendMetricLoop_();

	void startMetricLoop_();

	std::vector<std::unique_ptr<artdaq::MetricPlugin>> metric_plugins_;
	std::thread metric_sending_thread_;
	std::mutex metric_mutex_;
	std::condition_variable metric_cv_;

	bool initialized_;
	bool running_;
	bool active_;
	std::string prefix_;


	struct MetricData
	{
		MetricData(const MetricData&) = default;

		MetricData(MetricData&&) noexcept = default;

		MetricData& operator=(const MetricData&) = default;

		MetricData& operator=(MetricData&&) noexcept = default;

		std::string name_;
		std::string stringValue_;

		union
		{
			int intValue_;
			double doubleValue_;
			float floatValue_;
			long unsigned int unsignedValue_;
		};

		enum MetricType
		{
			InvalidMetric,
			StringMetric,
			IntMetric,
			DoubleMetric,
			FloatMetric,
			UnsignedMetric
		};

		MetricType type_;
		std::string unit_;
		int level_;
		bool accumulate_;
		std::string metricPrefix_;
		bool useNameOverride_;

		MetricData(std::string const& name, std::string const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride)
			: name_(name)
			, stringValue_(value)
			, type_(StringMetric)
			, unit_(unit)
			, level_(level)
			, accumulate_(accumulate)
			, metricPrefix_(metricPrefix)
			, useNameOverride_(useNameOverride) {}

		MetricData(std::string const& name, int const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride)
			: name_(name)
			, intValue_(value)
			, type_(IntMetric)
			, unit_(unit)
			, level_(level)
			, accumulate_(accumulate)
			, metricPrefix_(metricPrefix)
			, useNameOverride_(useNameOverride) {}

		MetricData(std::string const& name, double const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride)
			: name_(name)
			, doubleValue_(value)
			, type_(DoubleMetric)
			, unit_(unit)
			, level_(level)
			, accumulate_(accumulate)
			, metricPrefix_(metricPrefix)
			, useNameOverride_(useNameOverride) {}

		MetricData(std::string const& name, float const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride)
			: name_(name)
			, floatValue_(value)
			, type_(FloatMetric)
			, unit_(unit)
			, level_(level)
			, accumulate_(accumulate)
			, metricPrefix_(metricPrefix)
			, useNameOverride_(useNameOverride) {}

		MetricData(std::string const& name, long unsigned int const& value, std::string const& unit, int level, bool accumulate, std::string const& metricPrefix, bool useNameOverride)
			: name_(name)
			, unsignedValue_(value)
			, type_(UnsignedMetric)
			, unit_(unit)
			, level_(level)
			, accumulate_(accumulate)
			, metricPrefix_(metricPrefix)
			, useNameOverride_(useNameOverride) {}

		MetricData() : name_("")
		             , type_(InvalidMetric) {}
	};

	std::list<std::unique_ptr<MetricData>> metric_queue_;
	std::mutex metric_queue_mutex_;
};

#endif /* artdaq_DAQrate_MetricManager_hh */
