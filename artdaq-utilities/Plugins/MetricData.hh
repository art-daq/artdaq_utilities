#ifndef ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH
#define ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH

#include "fhiclcpp/fwd.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <atomic>
#include <condition_variable>
#include <list>
#include <sstream>

namespace artdaq {
/// <summary>
/// This enumeration is used to identify the type of the metric instance (which value should be extraced from the union)
/// </summary>
enum class MetricType
{
	InvalidMetric,  ///< Default, invalid value
	StringMetric,   ///< Metric is a std::string (not in union)
	IntMetric,      ///< Metric is an int
	DoubleMetric,   ///< Metric is a double
	FloatMetric,    ///< Metric is a float
	UnsignedMetric  ///< Metric is a long unsigned int
};

/// <summary>
/// The Mode of the metric indicates how multiple metric values should be combined within a reporting interval
/// </summary>
enum class MetricMode : uint32_t
{
	None = 0x0,
	LastPoint = 0x1,   ///< Report only the last value recorded. Useful for event counters, run numbers, etc.
	Accumulate = 0x2,  ///< Report the sum of all values. Use for counters to report accurate results.
	Average = 0x4,     ///< Report the average of all values. Use for rates to report accurate results.
	Rate = 0x8,        ///< Reports the sum of all values, divided by the length of the time interval they were accumulated
	///< over. Use to create rates from counters.
	Minimum = 0x10,  ///< Reports the minimum value recorded.
	Maximum = 0x20,  ///< Repots the maximum value recorded.
};
/// <summary>
/// Bitwise OR operator for MetricMode
/// </summary>
/// <param name="a">LHS of OR</param>
/// <param name="b">RHS of OR</param>
/// <returns>Logical OR of two MetricMode instances</returns>
constexpr MetricMode operator|(MetricMode a, MetricMode b)
{
	return static_cast<MetricMode>(static_cast<uint32_t>(a) | static_cast<uint32_t>(b));
}
/// <summary>
/// Bitwise AND operator for MetricMode
/// </summary>
/// <param name="a">LHS of AND</param>
/// <param name="b">RHS of AND</param>
/// <returns>Logical AND of two MetricMode instances</returns>
constexpr MetricMode operator&(MetricMode a, MetricMode b)
{
	return static_cast<MetricMode>(static_cast<uint32_t>(a) & static_cast<uint32_t>(b));
}

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
	union MetricDataValue
	{
		int i;                ///< Value of the metric, if it is a MetricType::IntMetric
		double d;             ///< Value of the metric, if it is a MetricType::DoubleMetric
		float f;              ///< Value of the metric, if it is a MetricType::FloatMetric
		long unsigned int u;  ///< Value of the metric, if it is a MetricType::UnsignedMetric

		/// <summary>
		/// Construct a MetricDataValue
		/// </summary>
		MetricDataValue()
		    : i(0) {}
		/// <summary>
		/// Construct a MetricDataValue as integer
		/// </summary>
		/// <param name="v">Integer to store</param>
		MetricDataValue(int v)
		    : i(v) {}
		/// <summary>
		/// Construct a MetricDataValue as double
		/// </summary>
		/// <param name="v">Double to store</param>
		MetricDataValue(double v)
		    : d(v) {}
		/// <summary>
		/// Construct a MetricDataValue as fload
		/// </summary>
		/// <param name="v">Float to store</param>
		MetricDataValue(float v)
		    : f(v) {}
		/// <summary>
		/// Construct a MetricDataValue as unsigned int
		/// </summary>
		/// <param name="v">Unsigned int to store</param>
		MetricDataValue(long unsigned int v)
		    : u(v) {}
	};

	/// <summary>
	/// Accumulated value of this MetricData
	/// </summary>
	MetricDataValue Value;
	MetricDataValue Last;  ///< Last value of this MetricData
	MetricDataValue Min;   ///< Minimum recorded value of this MetricData
	MetricDataValue Max;   ///< Maximum recorded vaule of this MetricData

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
	/// Number of data points accumulated in this MetricData
	/// </summary>
	size_t DataPointCount;

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
	MetricData(std::string const& name, std::string const& value, std::string const& unit, int level, MetricMode mode,
	           std::string const& metricPrefix, bool useNameOverride)
	    : Name(name), StringValue(value), Type(MetricType::StringMetric), Unit(unit), Level(level), Mode(mode), MetricPrefix(metricPrefix), UseNameOverride(useNameOverride), DataPointCount(1) {}

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
	MetricData(std::string const& name, int const& value, std::string const& unit, int level, MetricMode mode,
	           std::string const& metricPrefix, bool useNameOverride)
	    : Name(name), Value(value), Last(value), Min(value), Max(value), Type(MetricType::IntMetric), Unit(unit), Level(level), Mode(mode), MetricPrefix(metricPrefix), UseNameOverride(useNameOverride), DataPointCount(1) {}

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
	MetricData(std::string const& name, double const& value, std::string const& unit, int level, MetricMode mode,
	           std::string const& metricPrefix, bool useNameOverride)
	    : Name(name), Value(value), Last(value), Min(value), Max(value), Type(MetricType::DoubleMetric), Unit(unit), Level(level), Mode(mode), MetricPrefix(metricPrefix), UseNameOverride(useNameOverride), DataPointCount(1) {}

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
	MetricData(std::string const& name, float const& value, std::string const& unit, int level, MetricMode mode,
	           std::string const& metricPrefix, bool useNameOverride)
	    : Name(name), Value(value), Last(value), Min(value), Max(value), Type(MetricType::FloatMetric), Unit(unit), Level(level), Mode(mode), MetricPrefix(metricPrefix), UseNameOverride(useNameOverride), DataPointCount(1) {}

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
	MetricData(std::string const& name, long unsigned int const& value, std::string const& unit, int level,
	           MetricMode mode, std::string const& metricPrefix, bool useNameOverride)
	    : Name(name), Value(value), Last(value), Min(value), Max(value), Type(MetricType::UnsignedMetric), Unit(unit), Level(level), Mode(mode), MetricPrefix(metricPrefix), UseNameOverride(useNameOverride), DataPointCount(1) {}

	/// <summary>
	/// Default constructor, constructs an MetricType::InvalidMetric
	/// </summary>
	MetricData()
	    : Name(""), Type(MetricType::InvalidMetric), DataPointCount(0) {}

	/// <summary>
	/// Add two MetricData instances together
	/// </summary>
	/// <param name="other">MetricData to add to this one</param>
	/// <returns>True if the other MetricData is compatible and was added, false otherwise</returns>
	bool Add(MetricData other)
	{
		if (other.Name == Name && other.Type == Type && other.Unit == Unit && other.Level == Level)
		{
			if (other.DataPointCount == 0) return true;
			if (DataPointCount == 0)
			{
				switch (Type)
				{
					case MetricType::StringMetric:
						StringValue = other.StringValue;
						break;
					case MetricType::IntMetric:
						Value.i = other.Value.i;
						Last.i = other.Last.i;
						Min.i = other.Min.i;
						Max.i = other.Max.i;
						break;
					case MetricType::DoubleMetric:
						Value.d = other.Value.d;
						Last.d = other.Last.d;
						Min.d = other.Min.d;
						Max.d = other.Max.d;
						break;
					case MetricType::FloatMetric:
						Value.f = other.Value.f;
						Last.f = other.Last.f;
						Min.f = other.Min.f;
						Max.f = other.Max.f;
						break;
					case MetricType::UnsignedMetric:
						Value.u = other.Value.u;
						Last.u = other.Last.u;
						Min.u = other.Min.u;
						Max.u = other.Max.u;
						break;
					case MetricType::InvalidMetric:
						break;
				}
				DataPointCount = other.DataPointCount;
				return true;
			}
			else
			{
				switch (Type)
				{
					case MetricType::StringMetric:
						StringValue += " " + other.StringValue;
						break;
					case MetricType::IntMetric:
						Value.i += other.Value.i;
						Last.i = other.Last.i;
						if (other.Min.i < Min.i) Min.i = other.Min.i;
						if (other.Max.i > Max.i) Max.i = other.Max.i;
						break;
					case MetricType::DoubleMetric:
						Value.d += other.Value.d;
						Last.d = other.Last.d;
						if (other.Min.d < Min.d) Min.d = other.Min.d;
						if (other.Max.d > Max.d) Max.d = other.Max.d;
						break;
					case MetricType::FloatMetric:
						Value.f += other.Value.f;
						Last.f = other.Last.f;
						if (other.Min.f < Min.f) Min.f = other.Min.f;
						if (other.Max.f > Max.f) Max.f = other.Max.f;
						break;
					case MetricType::UnsignedMetric:
						Value.u += other.Value.u;
						Last.u = other.Last.u;
						if (other.Min.u < Min.u) Min.u = other.Min.u;
						if (other.Max.u > Max.u) Max.u = other.Max.u;
						break;
					case MetricType::InvalidMetric:
						break;
				}
				DataPointCount += other.DataPointCount;
				return true;
			}
		}
		return false;
	}

	/// <summary>
	/// Add an integer point to this MetricData
	/// </summary>
	/// <param name="point">Int value to add</param>
	void AddPoint(int point)
	{
		Last.i = point;
		Value.i += point;
		DataPointCount++;
		if (point > Max.i) Max.i = point;
		if (point < Min.i) Min.i = point;
	}
	/// <summary>
	/// Add a double point to this MetricData
	/// </summary>
	/// <param name="point">Double value to add</param>
	void AddPoint(double point)
	{
		Last.d = point;
		Value.d += point;
		DataPointCount++;
		if (point > Max.d) Max.d = point;
		if (point < Min.d) Min.d = point;
	}
	/// <summary>
	/// Add a float point to this MetricData
	/// </summary>
	/// <param name="point">Float value to add</param>
	void AddPoint(float point)
	{
		Last.f = point;
		Value.f += point;
		DataPointCount++;
		if (point > Max.f) Max.f = point;
		if (point < Min.f) Min.f = point;
	}
	/// <summary>
	/// Add an unsigned int point to this MetricData
	/// </summary>
	/// <param name="point">Unsigned int value to add</param>
	void AddPoint(unsigned long int point)
	{
		Last.u = point;
		Value.u += point;
		DataPointCount++;
		if (point > Max.u) Max.u = point;
		if (point < Min.u) Min.u = point;
	}

    /// <summary>
    /// Reset this MetricData instance to the initial state
    /// 
    /// Sets the value, last and count fields to 0, the min to the maximum for the datatype and the max to the minimum for the datatype
    /// </summary>
	void Reset()
	{
		switch (Type)
		{
			case MetricType::StringMetric:
				StringValue = "";
				break;
			case MetricType::IntMetric:
				Value.i = 0;
				Last.i = 0;
				Min.i = std::numeric_limits<int>::max();
				Max.i = std::numeric_limits<int>::min();
				break;
			case MetricType::DoubleMetric:
				Value.d = 0;
				Last.d = 0;
				Min.d = std::numeric_limits<double>::max();
				Max.d = std::numeric_limits<double>::min();
				break;
			case MetricType::FloatMetric:
				Value.f = 0;
				Last.f = 0;
				Min.f = std::numeric_limits<float>::max();
				Max.f = std::numeric_limits<float>::min();
				break;
			case MetricType::UnsignedMetric:
				Value.u = 0;
				Last.u = 0;
				Min.u = std::numeric_limits<unsigned>::max();
				Max.u = std::numeric_limits<unsigned>::min();
				break;
			case MetricType::InvalidMetric:
				break;
		}
		DataPointCount = 0;
	}
};
}  // namespace artdaq

#endif /* ARTDAQ_UTILITIES_PLUGINS_METRICDATA_HH */
