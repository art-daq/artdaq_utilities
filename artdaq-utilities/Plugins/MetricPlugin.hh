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
		/// "metricPluginType": The name of the metric plugin to load (may have additional configuration parameters)
		fhicl::Atom<std::string> metricPluginType{fhicl::Name{"metricPluginType"}, fhicl::Comment{"The name of the metric plugin to load (may have additional configuration parameters)"}};
		/// "level" (Default: 0): The verbosity level of the metric plugin. Higher number = fewer metrics sent to the metric storage
		fhicl::Atom<int> level{fhicl::Name{"level"}, fhicl::Comment{"The verbosity level threshold for this plugin. Metrics with verbosity level greater than this will not be sent to the plugin"}, 0};
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
		 * \verbatim
		 * MetricPlugin accepts the following parameters:
		 * "metricPluginType": The name of the plugin to load
		 * "level" (Default: 0): The verbosity level of the metric plugin. Higher number = fewer metrics sent to the metric storage
		 * "reporting_interval" (Default: 15.0): The interval, in seconds, which the metric plugin will accumulate values for.
		 *  Calling sendMetric with the accumulate parameter set to false will bypass this accumulation and directly send the
		 *  metric. String metrics cannot be accumulated.
		 *  \endverbatim
		 */
	explicit MetricPlugin(fhicl::ParameterSet const& ps, std::string const& app_name)
	    : pset(ps)
	    , app_name_(app_name)
	    , inhibit_(false)
	{
		runLevel_ = pset.get<int>("level", 0);
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
		for (auto metric : metricData_)
		{
			auto* metricName = &metric.first;
			if (readyToSend_(*metricName) || forceSend)
			{
				if (metricData_[*metricName].size() == 0 && metricRegistry_.count(*metricName))
				{
					sendZero_(metricRegistry_[*metricName]);
				}
				else if (metricData_[*metricName].size() > 0)
				{
					MetricData& data = metricData_[*metricName].front();
					auto it = ++(metricData_[*metricName].begin());
					while (it != metricData_[*metricName].end())
					{
						data.Add(*it);
						it = metricData_[*metricName].erase(it);
					}

					std::bitset<32> modeSet(static_cast<uint32_t>(data.Mode));
					bool useSuffix = true;
					if (modeSet.count() <= 1) useSuffix = false;

					if ((data.Mode & MetricMode::LastPoint) != MetricMode::None)
					{
						sendMetric_(data.Name + (useSuffix ? " - Last" : ""), data.Last, data.Unit, data.Type);
					}
					if ((data.Mode & MetricMode::Accumulate) != MetricMode::None)
					{
						sendMetric_(data.Name + (useSuffix ? " - Total" : ""), data.Value, data.Unit, data.Type);
					}
					if ((data.Mode & MetricMode::Average) != MetricMode::None)
					{
						double average = 0.0;
						switch (data.Type)
						{
							case MetricType::DoubleMetric:
								average = data.Value.d / static_cast<double>(data.DataPointCount);
								break;
							case MetricType::FloatMetric:
								average = data.Value.f / static_cast<double>(data.DataPointCount);
								break;
							case MetricType::IntMetric:
								average = data.Value.i / static_cast<double>(data.DataPointCount);
								break;
							case MetricType::UnsignedMetric:
								average = data.Value.u / static_cast<double>(data.DataPointCount);
								break;
							default:
								break;
						}
						sendMetric_(data.Name + (useSuffix ? " - Average" : ""), average, data.Unit);
					}
					if ((data.Mode & MetricMode::Rate) != MetricMode::None)
					{
						double duration = std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(
						                      interval_end - interval_start_[*metricName])
						                      .count();
						double rate = 0.0;
						switch (data.Type)
						{
							case MetricType::DoubleMetric:
								rate = data.Value.d / duration;
								break;
							case MetricType::FloatMetric:
								rate = data.Value.f / duration;
								break;
							case MetricType::IntMetric:
								rate = data.Value.i / duration;
								break;
							case MetricType::UnsignedMetric:
								rate = data.Value.u / duration;
								break;
							default:
								break;
						}
						sendMetric_(data.Name + (useSuffix ? " - Rate" : ""), rate, data.Unit);
					}
					if ((data.Mode & MetricMode::Minimum) != MetricMode::None)
					{
						sendMetric_(data.Name + (useSuffix ? " - Min" : ""), data.Min, data.Unit, data.Type);
					}
					if ((data.Mode & MetricMode::Maximum) != MetricMode::None)
					{
						sendMetric_(data.Name + (useSuffix ? " - Max" : ""), data.Max, data.Unit, data.Type);
					}

					metricData_[*metricName].clear();
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

	/**
		 * \brief Set the threshold for sending metrics to the underlying storage.
   * \param level The new threshold for sending metrics to the underlying storage. Metrics with level <= to runLevel_
   * will be sent.
		 */
	void setRunLevel(int level) { runLevel_ = level; }

	/**
		 * \brief Get the threshold for sending metrics to the underlying storage.
   * \return The threshold for sending metrics to the underlying storage. Metrics with level <= to runLevel_ will be
   * sent.
		 */
	int getRunLevel() const { return runLevel_; }

protected:
	int runLevel_;             ///< The threshold for sending metrics to the underlying storage. Metrics with level <= to runLevel_
	                           ///< will be sent.
	fhicl::ParameterSet pset;  ///< The ParameterSet used to configure the MetricPlugin
	double accumulationTime_;  ///< The amount of time to average metric values; except for accumulate=false metrics, will
	                           ///< be the interval at which each metric is sent.
	std::string app_name_;     ///< Name of the application which is sending metrics to this plugin
	bool inhibit_;             ///< Whether to inhibit all metric sending

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
		std::bitset<32> modeSet(static_cast<uint32_t>(data.Mode));
		bool useSuffix = true;
		if (modeSet.count() <= 1) useSuffix = false;

		MetricData::MetricDataValue zero;
		switch (data.Type)
		{
			case MetricType::DoubleMetric:
				zero.d = 0.0;
				break;
			case MetricType::FloatMetric:
				zero.f = 0.0f;
				break;
			case MetricType::IntMetric:
				zero.i = 0;
				break;
			case MetricType::UnsignedMetric:
				zero.u = 0;
				break;
			default:
				break;
		}

		if ((data.Mode & MetricMode::LastPoint) != MetricMode::None)
		{
			sendMetric_(data.Name + (useSuffix ? " - Last" : ""), zero, data.Unit, data.Type);
		}
		if ((data.Mode & MetricMode::Accumulate) != MetricMode::None)
		{
			sendMetric_(data.Name + (useSuffix ? " - Total" : ""), zero, data.Unit, data.Type);
		}
		if ((data.Mode & MetricMode::Average) != MetricMode::None)
		{
			sendMetric_(data.Name + (useSuffix ? " - Average" : ""), 0.0, data.Unit);
		}
		if ((data.Mode & MetricMode::Rate) != MetricMode::None)
		{
			sendMetric_(data.Name + (useSuffix ? " - Rate" : ""), 0.0, data.Unit);
		}
		if ((data.Mode & MetricMode::Minimum) != MetricMode::None)
		{
			sendMetric_(data.Name + (useSuffix ? " - Min" : ""), zero, data.Unit, data.Type);
		}
		if ((data.Mode & MetricMode::Maximum) != MetricMode::None)
		{
			sendMetric_(data.Name + (useSuffix ? " - Max" : ""), zero, data.Unit, data.Type);
		}
	}

	void sendMetric_(std::string name, MetricData::MetricDataValue data, std::string unit, MetricType type)
	{
		switch (type)
		{
			case MetricType::DoubleMetric:
				sendMetric_(name, data.d, unit);
				break;
			case MetricType::FloatMetric:
				sendMetric_(name, data.f, unit);
				break;
			case MetricType::IntMetric:
				sendMetric_(name, data.i, unit);
				break;
			case MetricType::UnsignedMetric:
				sendMetric_(name, data.u, unit);
				break;
			default:
				break;
		}
	}
};
}  //End namespace artdaq

#endif  //End ifndef __METRIC_INTERFACE__
