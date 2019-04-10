// MetricPlugin.hh: Metric Plugin Interface
// Author: Eric Flumerfelt
// Last Modified: 11/05/2014 (Created)
//
// Defines the interface that any ARTDAQ metric plugin must implement

#ifndef __METRIC_INTERFACE__
#define __METRIC_INTERFACE__

#include <chrono>
#include <string>
#include <unordered_map>
#include "fhiclcpp/ParameterSet.h"
#include "fhiclcpp/types/Atom.h"
#include "fhiclcpp/types/ConfigurationTable.h"
#include "fhiclcpp/types/Sequence.h"

#include "artdaq-utilities/Plugins/MetricData.hh"
#include "cetlib/compiler_macros.h"
#ifndef FALLTHROUGH
#define FALLTHROUGH while (0)
#endif

namespace artdaq {
/**
	 * \brief The MetricPlugin class defines the interface that MetricManager uses to send metric data
	 * to the various metric plugins.
	 */
class MetricPlugin
{
public:
	/**
		* \brief The Config struct defines the accepted configuration parameters for this class
		*/
	struct Config
	{
		/// The name of the metric plugin to load (may have additional configuration parameters
		fhicl::Atom<std::string> metricPluginType{fhicl::Name{"metricPluginType"}, fhicl::Comment{"The name of the metric plugin to load (may have additional configuration parameters"}};
		/// "level" (OPTIONAL): The verbosity level threshold for this plugin. sendMetric calls with verbosity level greater than this will not be sent to the plugin.
		fhicl::Atom<size_t> level{fhicl::Name{"level"}, fhicl::Comment{"The verbosity level threshold for this plugin. sendMetric calls with verbosity level greater than this will not be sent to the plugin. OPTIONAL"}, 0};
		/// "metric_levels" (OPTIONAL): A list of levels that should be enabled for this plugin.
		fhicl::Sequence<size_t> metric_levels{fhicl::Name{"metric_levels"}, fhicl::Comment{"A list of levels that should be enabled for this plugin. OPTIONAL"}, std::vector<size_t>()};
		/// "level_string" (OPTIONAL): A string containing a comma-separated list of levels to enable. Ranges are supported. Example: "1,2,4-10,11"
		fhicl::Atom<std::string> level_string{fhicl::Name{"level_string"}, fhicl::Comment{"A string containing a comma-separated list of levels to enable. Ranges are supported. Example: \"1,2,4-10,11\" OPTIONAL"}, ""};
		/// "reporting_interval" (Default: 15.0): The interval, in seconds, which the metric plugin will accumulate values for.
		fhicl::Atom<double> reporting_interval{fhicl::Name{"reporting_interval"}, fhicl::Comment{"How often recorded metrics are sent to the underlying metric storage"}, 15.0};
	};
	/// Used for ParameterSet validation (if desired)
	using Parameters = fhicl::WrappedTable<Config>;

	/**
		 * \brief MetricPlugin Constructor
		 * \param ps The ParameterSet used to configure this MetricPlugin instance
		 * \param app_name The Application name which can be used by the Metric Plugin for identification
		 *
		 *  Calling sendMetric with the accumulate parameter set to false will bypass this accumulation and directly send the
		 *  metric. String metrics cannot be accumulated.
		 */
	explicit MetricPlugin(fhicl::ParameterSet const& ps, std::string const& app_name)
	    : pset(ps)
	    , app_name_(app_name)
	    , inhibit_(false)
	    , level_mask_(0ULL)
	{
		if (pset.has_key("level"))
		{
			for (size_t ii = 0; ii <= pset.get<size_t>("level"); ++ii)
			{
				level_mask_[ii] = true;
			}
		}
		if (pset.has_key("metric_levels"))
		{
			auto levels = pset.get<std::vector<size_t>>("metric_levels");
			for (auto& l : levels)
			{
				level_mask_[l] = true;
			}
		}
		if (pset.has_key("level_string"))
		{
			auto string = pset.get<std::string>("level_string");
			std::stringstream ss(string);
			std::string token;
			while (std::getline(ss, token, ','))
			{
				auto it = token.find("-");
				if (it == 0 || it == token.size() - 1) continue;

				if (it != std::string::npos)
				{
					auto minStr = token.substr(0, it);
					auto maxStr = token.substr(it + 1);
					auto min = std::stoi(minStr);
					auto max = std::stoi(maxStr);

					if (min > max) std::swap(min, max);
					if (min > 63) min = 63;
					if (max > 63) max = 63;

					for (int ii = min; ii <= max; ++ii)
					{
						level_mask_[ii] = true;
					}
				}
				else
				{
					auto level = std::stoi(token);
					if (level >= 0 && level < 63) level_mask_[level] = true;
				}
			}
		}
		if (level_mask_.to_ullong() == 0)
		{
			throw cet::exception("Configuration Error") << "No levels were enabled for this plugin! Please specify at least one of the following Parameters: \"level\", \"metric_levels\", or \"level_string\"!";
		}
		accumulationTime_ = pset.get<double>("reporting_interval", 15.0);
	}

	/**
		 * \brief Default virtual Desctructor
		 */
	virtual ~MetricPlugin() = default;

	///////////////////////////////////////////////////////////////////////////
	//
	// Interface Functions: These should be reimplemented in plugin classes!
	//
	///////////////////////////////////////////////////////////////////////////

	/**
		 * \brief Return the name of the current MetricPlugin instance
		 */
	virtual std::string getLibName() const { return "ERROR"; }

protected:
	/**
		 * \brief Send a metric to the underlying metric storage (file, Graphite, Ganglia, etc.)
		 * \param name Name of the metric
		 * \param value Value of the metric
		 * \param unit Units for the metric
		 *
		 * Note this is a pure virtual function, it should be overridden by implementation plugins
		 */
	virtual void sendMetric_(const std::string& name, const std::string& value, const std::string& unit) = 0;

	/**
		* \brief Send a metric to the underlying metric storage (file, Graphite, Ganglia, etc.)
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units for the metric
		*
		* Note this is a pure virtual function, it should be overridden by implementation plugins
		*/
	virtual void sendMetric_(const std::string& name, const int& value, const std::string& unit) = 0;

	/**
		* \brief Send a metric to the underlying metric storage (file, Graphite, Ganglia, etc.)
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units for the metric
		*
		* Note this is a pure virtual function, it should be overridden by implementation plugins
		*/
	virtual void sendMetric_(const std::string& name, const double& value, const std::string& unit) = 0;

	/**
		* \brief Send a metric to the underlying metric storage (file, Graphite, Ganglia, etc.)
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units for the metric
		*
		* Note this is a pure virtual function, it should be overridden by implementation plugins
		*/
	virtual void sendMetric_(const std::string& name, const float& value, const std::string& unit) = 0;

	/**
		* \brief Send a metric to the underlying metric storage (file, Graphite, Ganglia, etc.)
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units for the metric
		*
		* Note this is a pure virtual function, it should be overridden by implementation plugins
		*/
	virtual void sendMetric_(const std::string& name, const long unsigned int& value, const std::string& unit) = 0;

	/**
		 * \brief Perform any start-up actions necessary for the metric plugin
		 *
		 * This is a pure virtual function, it should be overridden by implementation plugins
		 */
	virtual void startMetrics_() = 0;

	/**
		* \brief Perform any shutdown actions necessary for the metric plugin
		*
		* This is a pure virtual function, it should be overridden by implementation plugins
		*/
	virtual void stopMetrics_() = 0;

	/////////////////////////////////////////////////////////////////////////////////
	//
	// Implementation Functions: These should be called from ARTDAQ code!
	//
	/////////////////////////////////////////////////////////////////////////////////
public:
	/**
		* \brief Send a metric value to the MetricPlugin
		* \param data A MetricData struct containing the metric value
		*/
	void addMetricData(std::unique_ptr<MetricData> const& data)
	{
		if (data->Type == MetricType::StringMetric)
		{
			sendMetric_(data->Name, data->StringValue, data->Unit);
		}
		else
		{
			if (!metricRegistry_.count(data->Name))
			{
				metricRegistry_[data->Name] = *data;
			}
			metricData_[data->Name].push_back(*data);
			//sendMetrics();
		}
	}

	/**
   * \brief For each known metric, determine whether the reporting interval has elapsed, and if so, report a value to
   * the underlying metric storage 
   * \param forceSend (Default = false): Force sending metrics, even if reporting interval
   * has not elapsed 
   * \param interval_end (Default = now): For calculating rates, when the current reporting interval
   * ended (interval began at last value of interval_end)
		 */
	void sendMetrics(bool forceSend = false,
	                 std::chrono::steady_clock::time_point interval_end = std::chrono::steady_clock::now())
	{
		double ds;
		float fs;
		int is;
		unsigned long us;
		size_t count;

		for (auto metric : metricData_)
		{
			auto* metricName = &metric.first;
			count = 0;
			if (readyToSend_(*metricName) || forceSend)
			{
				if (metricData_[*metricName].size() == 0 && metricRegistry_.count(*metricName))
				{
					sendZero_(metricRegistry_[*metricName]);
				}
				else if (metricData_[*metricName].size() > 0)
				{
					auto metricMode = &metricData_[*metricName].back().Mode;
					auto metricUnits = &metricData_[*metricName].back().Unit;
					auto metricType = &metricData_[*metricName].back().Type;

					if (*metricMode == MetricMode::LastPoint)
					{
						if (metricData_[*metricName].size() > 1)
						{
							metricData_[*metricName].erase(metricData_[*metricName].begin(),
							                               std::prev(metricData_[*metricName].end()));
						}
						sendMetric_(metricData_[*metricName].back());
					}
					else
					{
						switch (*metricType)
						{
							case MetricType::DoubleMetric:
							{
								ds = 0.0;
								for (auto& mv : metricData_[*metricName])
								{
									ds += mv.DoubleValue;
									count += mv.DataPointCount;
								}
								switch (*metricMode)
								{
									case MetricMode::Average:
										ds /= static_cast<double>(count);
										break;
									case MetricMode::Rate:
										ds /= std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										          interval_end - interval_start_[*metricName])
										          .count();
										break;
									case MetricMode::AccumulateAndRate:
										sendMetric_(*metricName + " - Rate",
										            ds / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										                     interval_end - interval_start_[*metricName])
										                     .count(),
										            *metricUnits + "/s");
										break;
									default:
										break;
								}
								sendMetric_(*metricName, ds, *metricUnits);
							}
							break;
							case MetricType::FloatMetric:
							{
								fs = 0.0;
								for (auto& mv : metricData_[*metricName])
								{
									fs += mv.FloatValue;
									count += mv.DataPointCount;
								}

								switch (*metricMode)
								{
									case MetricMode::Average:
										ds = fs / static_cast<double>(count);
										sendMetric_(*metricName, ds, *metricUnits);
										break;
									case MetricMode::Rate:
										ds = fs / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										              interval_end - interval_start_[*metricName])
										              .count();
										sendMetric_(*metricName, ds, *metricUnits);
										break;
									case MetricMode::AccumulateAndRate:
										sendMetric_(*metricName + " - Rate",
										            fs / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										                     interval_end - interval_start_[*metricName])
										                     .count(),
										            *metricUnits + "/s");
										FALLTHROUGH;
									case MetricMode::Accumulate:
									default:
										sendMetric_(*metricName, fs, *metricUnits);
										break;
								}
							}
							break;
							case MetricType::IntMetric:
							{
								is = 0;
								for (auto& mv : metricData_[*metricName])
								{
									is += mv.IntValue;
									count += mv.DataPointCount;
								}

								switch (*metricMode)
								{
									case MetricMode::Average:
										ds = is / static_cast<double>(count);
										sendMetric_(*metricName, ds, *metricUnits);
										break;
									case MetricMode::Rate:
										ds = is / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										              interval_end - interval_start_[*metricName])
										              .count();
										sendMetric_(*metricName, ds, *metricUnits);
										break;
									case MetricMode::AccumulateAndRate:
										sendMetric_(*metricName + " - Rate",
										            is / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										                     interval_end - interval_start_[*metricName])
										                     .count(),
										            *metricUnits + "/s");
										FALLTHROUGH;
									case MetricMode::Accumulate:
									default:
										sendMetric_(*metricName, is, *metricUnits);
										break;
								}
							}
							break;
							case MetricType::UnsignedMetric:
							{
								us = 0UL;
								for (auto& mv : metricData_[*metricName])
								{
									us += mv.UnsignedValue;
									count += mv.DataPointCount;
								}

								switch (*metricMode)
								{
									case MetricMode::Average:
										ds = us / static_cast<double>(count);
										sendMetric_(*metricName, ds, *metricUnits);
										break;
									case MetricMode::Rate:
										ds = us / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										              interval_end - interval_start_[*metricName])
										              .count();
										sendMetric_(*metricName, ds, *metricUnits);
										break;
									case MetricMode::AccumulateAndRate:
										sendMetric_(*metricName + " - Rate",
										            us / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
										                     interval_end - interval_start_[*metricName])
										                     .count(),
										            *metricUnits + "/s");
										FALLTHROUGH;
									case MetricMode::Accumulate:
									default:
										sendMetric_(*metricName, us, *metricUnits);
										break;
								}
							}
							break;
							default:
								break;
						}
						metricData_[*metricName].clear();
					}
				}
				interval_start_[*metricName] = interval_end;
			}
		}
	}

	/**
		 * \brief Perform startup actions. Simply calls the virtual startMetrics_ function
		 */
	void startMetrics() { startMetrics_(); }

	/**
		 * \brief Perform shutdown actions. Zeroes out all accumulators, and sends zeros for each metric.
		 * Calls stopMetrics_() for any plugin-defined shutdown actions.
		 */
	void stopMetrics()
	{
		inhibit_ = true;
		sendMetrics(true);
		for (auto metric : metricRegistry_)
		{
			sendZero_(metric.second);
		}
		stopMetrics_();
		inhibit_ = false;
	}

	bool IsLevelEnabled(int level)
	{
		if (level > 63) level = 63;
		if (level < 0) return true;
		return level_mask_[level];
	}

protected:
	fhicl::ParameterSet pset;     ///< The ParameterSet used to configure the MetricPlugin
	double accumulationTime_;     ///< The amount of time to average metric values; except for accumulate=false metrics, will be the interval at which each metric is sent.
	std::string app_name_;        ///< Name of the application which is sending metrics to this plugin
	bool inhibit_;                ///< Whether to inhibit all metric sending
	std::bitset<64> level_mask_;  ///< Bitset indicating for each possible metric level, whether this plugin will receive those metrics

private:
	std::unordered_map<std::string, std::list<MetricData>> metricData_;
	std::unordered_map<std::string, MetricData> metricRegistry_;
	std::unordered_map<std::string, std::chrono::steady_clock::time_point> lastSendTime_;
	std::unordered_map<std::string, std::chrono::steady_clock::time_point> interval_start_;

	bool readyToSend_(std::string name)
	{
		auto now = std::chrono::steady_clock::now();
		if (std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(now - lastSendTime_[name]).count() >=
		    accumulationTime_)
		{
			lastSendTime_[name] = now;
			return true;
		}

		return false;
	}

	void sendZero_(MetricData data)
	{
		switch (data.Type)
		{
			case MetricType::DoubleMetric:
				sendMetric_(data.Name, static_cast<double>(0.0), data.Unit);
				break;
			case MetricType::FloatMetric:
				sendMetric_(data.Name, static_cast<float>(0.0), data.Unit);
				break;
			case MetricType::IntMetric:
				sendMetric_(data.Name, static_cast<int>(0), data.Unit);
				break;
			case MetricType::UnsignedMetric:
				sendMetric_(data.Name, static_cast<unsigned long>(0), data.Unit);
				break;
			default:
				break;
		}

		if (data.Mode == MetricMode::AccumulateAndRate)
		{
			sendMetric_(data.Name + " - Rate", static_cast<double>(0.0), data.Unit + "/s");
		}
	}

	void sendMetric_(MetricData data)
	{
		switch (data.Type)
		{
			case MetricType::DoubleMetric:
				sendMetric_(data.Name, data.DoubleValue, data.Unit);
				break;
			case MetricType::FloatMetric:
				sendMetric_(data.Name, data.FloatValue, data.Unit);
				break;
			case MetricType::IntMetric:
				sendMetric_(data.Name, data.IntValue, data.Unit);
				break;
			case MetricType::UnsignedMetric:
				sendMetric_(data.Name, data.UnsignedValue, data.Unit);
				break;
			default:
				break;
		}
	}
};
}  //End namespace artdaq

#endif  //End ifndef __METRIC_INTERFACE__
