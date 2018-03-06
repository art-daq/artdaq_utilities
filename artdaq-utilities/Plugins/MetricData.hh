#ifndef ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH
#define ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH

#include "fhiclcpp/fwd.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <sstream>
#include <list>
#include <condition_variable>
#include <atomic>

namespace artdaq
{
	/// <summary>
	/// This enumeration is used to identify the type of the metric instance (which value should be extraced from the union)
	/// </summary>
	enum class MetricType
	{
		InvalidMetric, ///< Default, invalid value
		StringMetric, ///< Metric is a std::string (not in union)
		IntMetric, ///< Metric is an int
		DoubleMetric, ///< Metric is a double
		FloatMetric, ///< Metric is a float
		UnsignedMetric ///< Metric is a long unsigned int
	};

	/// <summary>
	/// The Mode of the metric indicates how multiple metric values should be combined within a reporting interval
	/// </summary>
	enum class MetricMode
	{
		LastPoint, ///< Report only the last value recorded. Useful for event counters, run numbers, etc.
		Accumulate, ///< Report the sum of all values. Use for counters to report accurate results.
		Average, ///< Report the average of all values. Use for rates to report accurate results.
		Rate, ///< Reports the sum of all values, divided by the length of the time interval they were accumulated over. Use to create rates from counters.
		AccumulateAndRate, ///< Sends both the Accumulate mode and Rate mode metric. (Rate mode metric will append "/s" to metric units.)
	};

	/// <summary>
	/// Small structure used to hold a metric data point before sending to the metric plugins
	/// </summary>
	struct MetricData
	{
		/// <summary>
		/// Default copy constructor
		/// </summary>
		/// <param name="r">MetricData to copy</param>
		MetricData(const MetricData& r) = default;

		/// <summary>
		/// Default move constructor
		/// </summary>
		/// <param name="r">MetricData to move</param>
		MetricData(MetricData&& r) noexcept = default;

		/// <summary>
		/// Default copy assignment operator
		/// </summary>
		/// <param name="r">MetricData to copy</param>
		/// <returns>MetricData copy</returns>
		MetricData& operator=(const MetricData& r) = default;

		/// <summary>
		/// Default move assignment operator
		/// </summary>
		/// <param name="r">MetricData to move</param>
		/// <returns>MetricData reference</returns>
		MetricData& operator=(MetricData&& r) noexcept = default;

		/// <summary>
		/// Name of the metric
		/// </summary>
		std::string Name;
		/// <summary>
		/// Value of the metric, if it is a MetricType::StringMetric
		/// </summary>
		std::string StringValue;

		/// <summary>
		/// This union holds the values for all other metric types
		/// </summary>
		union
		{
			int IntValue; ///< Value of the metric, if it is a MetricType::IntMetric
			double DoubleValue; ///< Value of the metric, if it is a MetricType::DoubleMetric
			float FloatValue; ///< Value of the metric, if it is a MetricType::FloatMetric
			long unsigned int UnsignedValue; ///< Value of the metric, if it is a MetricType::UnsignedMetric
		};

		/// <summary>
		/// Type of the metric
		/// </summary>
		MetricType Type;
		/// <summary>
		/// Units of the metric
		/// </summary>
		std::string Unit;
		/// <summary>
		/// Reporting level of the metric
		/// </summary>
		int Level;
		/// <summary>
		/// Accumulation mode of the metric
		/// </summary>
		MetricMode Mode;
		/// <summary>
		/// Name prefix for the metric
		/// </summary>
		std::string MetricPrefix;
		/// <summary>
		/// Whether to override the default naming convention for this metric
		/// </summary>
		bool UseNameOverride;

		/// <summary>
		/// Construct a MetricData point using a string value
		/// </summary>
		/// <param name="name">Name of the metric</param>
		/// <param name="value">Value of the metric</param>
		/// <param name="unit">Units of the metric</param>
		/// <param name="level">Reporting level of the metric</param>
		/// <param name="mode">Accumulation mode of the metric</param>
		/// <param name="metricPrefix">Name prefix for the metric</param>
		/// <param name="useNameOverride">Whether to override the default name</param>
		MetricData(std::string const& name, std::string const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
			: Name(name)
			, StringValue(value)
			, Type(MetricType::StringMetric)
			, Unit(unit)
			, Level(level)
			, Mode(mode)
			, MetricPrefix(metricPrefix)
			, UseNameOverride(useNameOverride) {}

		/// <summary>
		/// Construct a MetricData point using a int value
		/// </summary>
		/// <param name="name">Name of the metric</param>
		/// <param name="value">Value of the metric</param>
		/// <param name="unit">Units of the metric</param>
		/// <param name="level">Reporting level of the metric</param>
		/// <param name="mode">Accumulation mode of the metric</param>
		/// <param name="metricPrefix">Name prefix for the metric</param>
		/// <param name="useNameOverride">Whether to override the default name</param>
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

		/// <summary>
		/// Construct a MetricData point using a double value
		/// </summary>
		/// <param name="name">Name of the metric</param>
		/// <param name="value">Value of the metric</param>
		/// <param name="unit">Units of the metric</param>
		/// <param name="level">Reporting level of the metric</param>
		/// <param name="mode">Accumulation mode of the metric</param>
		/// <param name="metricPrefix">Name prefix for the metric</param>
		/// <param name="useNameOverride">Whether to override the default name</param>
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

		/// <summary>
		/// Construct a MetricData point using a float value
		/// </summary>
		/// <param name="name">Name of the metric</param>
		/// <param name="value">Value of the metric</param>
		/// <param name="unit">Units of the metric</param>
		/// <param name="level">Reporting level of the metric</param>
		/// <param name="mode">Accumulation mode of the metric</param>
		/// <param name="metricPrefix">Name prefix for the metric</param>
		/// <param name="useNameOverride">Whether to override the default name</param>
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

		/// <summary>
		/// Construct a MetricData point using a unsigned long int value
		/// </summary>
		/// <param name="name">Name of the metric</param>
		/// <param name="value">Value of the metric</param>
		/// <param name="unit">Units of the metric</param>
		/// <param name="level">Reporting level of the metric</param>
		/// <param name="mode">Accumulation mode of the metric</param>
		/// <param name="metricPrefix">Name prefix for the metric</param>
		/// <param name="useNameOverride">Whether to override the default name</param>
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

		/// <summary>
		/// Default constructor, constructs an MetricType::InvalidMetric
		/// </summary>
		MetricData() : Name("")
		             , Type(MetricType::InvalidMetric) {}
	};
}

#endif /* ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH */
