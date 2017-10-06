#ifndef ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH
#define ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH

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
	enum class MetricType
	{
		InvalidMetric,
		StringMetric,
		IntMetric,
		DoubleMetric,
		FloatMetric,
		UnsignedMetric
	};

	enum class MetricMode
	{
		LastPoint,
		Accumulate,
		Average
	};

	struct MetricData
	{
		MetricData(const MetricData&) = default;

		MetricData(MetricData&&) noexcept = default;

		MetricData& operator=(const MetricData&) = default;

		MetricData& operator=(MetricData&&) noexcept = default;

		std::string Name;
		std::string StringValue;

		union
		{
			int IntValue;
			double DoubleValue;
			float FloatValue;
			long unsigned int UnsignedValue;
		};


		MetricType Type;
		std::string Unit;
		int Level;
		MetricMode Mode;
		std::string MetricPrefix;
		bool UseNameOverride;

		MetricData(std::string const& name, std::string const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
			: Name(name)
			, StringValue(value)
			, Type(MetricType::StringMetric)
			, Unit(unit)
			, Level(level)
			, Mode(mode)
			, MetricPrefix(metricPrefix)
			, UseNameOverride(useNameOverride) {}

		MetricData(std::string const& name, int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
			: Name(name)
			, IntValue(value)
			, Type(MetricType::IntMetric)
			, Unit(unit)
			, Level(level)
			, Mode(mode)
			, MetricPrefix(metricPrefix)
			, UseNameOverride(useNameOverride)
		{}

		MetricData(std::string const& name, double const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
			: Name(name)
			, DoubleValue(value)
			, Type(MetricType::DoubleMetric)
			, Unit(unit)
			, Level(level)
			, Mode(mode)
			, MetricPrefix(metricPrefix)
			, UseNameOverride(useNameOverride)
		{}

		MetricData(std::string const& name, float const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
			: Name(name)
			, FloatValue(value)
			, Type(MetricType::FloatMetric)
			, Unit(unit)
			, Level(level)
			, Mode(mode)
			, MetricPrefix(metricPrefix)
			, UseNameOverride(useNameOverride)
		{}

		MetricData(std::string const& name, long unsigned int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
			: Name(name)
			, UnsignedValue(value)
			, Type(MetricType::UnsignedMetric)
			, Unit(unit)
			, Level(level)
			, Mode(mode)
			, MetricPrefix(metricPrefix)
			, UseNameOverride(useNameOverride)
		{}

		MetricData() : Name("")
		             , Type(MetricType::InvalidMetric) {}
	};
}

#endif /* ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH */
