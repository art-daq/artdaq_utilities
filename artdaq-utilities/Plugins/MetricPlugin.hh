// MetricPlugin.hh: Metric Plugin Interface
// Author: Eric Flumerfelt
// Last Modified: 11/05/2014 (Created)
//
// Defines the interface that any ARTDAQ metric plugin must implement


#ifndef __METRIC_INTERFACE__
#define __METRIC_INTERFACE__

#include <string>
#include <chrono>
#include <unordered_map>
#include "fhiclcpp/ParameterSet.h"
#include "artdaq-utilities/Plugins/MetricData.hh"

namespace artdaq
{
	/**
	 * \brief The MetricPlugin class defines the interface that MetricManager uses to send metric data
	 * to the various metric plugins.
	 */
	class MetricPlugin
	{
	public:
		/**
		 * \brief MetricPlugin Constructor
		 * \param ps The ParameterSet used to configure this MetricPlugin instance
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
		explicit MetricPlugin(fhicl::ParameterSet const& ps) : pset(ps)
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
		void addMetricData(MetricData data)
		{
			if (data.Type == MetricType::StringMetric)
			{
				sendMetric_(data.Name, data.StringValue, data.Unit);
			}
			else
			{
				if (!metricRegistry_.count(data.Name))
				{
					metricRegistry_[data.Name] = data;
				}
				metricData_[data.Name].push_back(data);
				sendMetrics();
			}
		}

		/**
		 * \brief For each known metric, determine whether the reporting interval has elapsed, and if so, report a value to the underlying metric storage
		 */
		void sendMetrics()
		{
			for (auto metric : metricData_)
			{
				auto metricName = metric.first;
				if (readyToSend_(metricName))
				{
					if (metricData_[metricName].size() == 0 && metricRegistry_.count(metricName))
					{
						sendZero_(metricRegistry_[metricName]);
					}
					else if (metricData_[metricName].size() > 0)
					{
						auto metricMode = metricData_[metricName].back().Mode;
						auto metricUnits = metricData_[metricName].back().Unit;
						auto metricType = metricData_[metricName].back().Type;

						if (metricMode == MetricMode::LastPoint)
						{
							std::list<MetricData> tmpList(1);
							auto lastPoint = metricData_[metricName].back();
							tmpList.push_back(lastPoint);
							metricData_[metricName].swap(tmpList);
							assert(metricData_[metricName].size() == 1);
							sendMetric_(lastPoint);
						}
						else
						{
							switch (metricType)
							{
							case MetricType::DoubleMetric:
							{
								auto ds = 0.0;
								for (auto& mv : metricData_[metricName]) { ds += mv.DoubleValue; }
								if (metricMode == MetricMode::Average) { ds /= metricData_[metricName].size(); }
								sendMetric_(metricName, ds, metricUnits);
							}
							break;
							case MetricType::FloatMetric:
							{
								auto fs = 0.0;
								for (auto& mv : metricData_[metricName]) { fs += mv.FloatValue; }
								if (metricMode == MetricMode::Average) { fs /= metricData_[metricName].size(); }
								sendMetric_(metricName, fs, metricUnits);
							}
							break;
							case MetricType::IntMetric:
							{
								auto is = 0;
								for (auto& mv : metricData_[metricName]) { is += mv.IntValue; }
								if (metricMode == MetricMode::Average) { is /= metricData_[metricName].size(); }
								sendMetric_(metricName, is, metricUnits);
							}
							break;
							case MetricType::UnsignedMetric:
							{
								auto us = 0;
								for (auto& mv : metricData_[metricName]) { us += mv.UnsignedValue; }
								if (metricMode == MetricMode::Average) { us /= metricData_[metricName].size(); }
								sendMetric_(metricName, us, metricUnits);
							}
							break;
							default:
								break;
							}
							metricData_[metricName].clear();
						}
					}
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
			for (auto metric : metricRegistry_)
			{
				sendZero_(metric.second);
			}
			stopMetrics_();
			inhibit_ = false;
		}

		/**
		 * \brief Set the threshold for sending metrics to the underlying storage.
		 * \param level The new threshold for sending metrics to the underlying storage. Metrics with level <= to runLevel_ will be sent.
		 */
		void setRunLevel(int level) { runLevel_ = level; }
		/**
		 * \brief Get the threshold for sending metrics to the underlying storage.
		 * \return The threshold for sending metrics to the underlying storage. Metrics with level <= to runLevel_ will be sent.
		 */
		int getRunLevel() const { return runLevel_; }

	protected:
		int runLevel_; ///< The threshold for sending metrics to the underlying storage. Metrics with level <= to runLevel_ will be sent.
		fhicl::ParameterSet pset; ///< The ParameterSet used to configure the MetricPlugin
		double accumulationTime_; ///< The amount of time to average metric values; except for accumulate=false metrics, will be the interval at which each metric is sent.
		bool inhibit_; ///< Whether to inhibit all metric sending

	private:
		std::unordered_map<std::string, std::list<MetricData>> metricData_;
		std::unordered_map<std::string, MetricData> metricRegistry_;
		std::unordered_map<std::string, std::chrono::steady_clock::time_point> lastSendTime_;

		bool readyToSend_(std::string name)
		{
			auto now = std::chrono::steady_clock::now();
			if (std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(now - lastSendTime_[name]).count() >= accumulationTime_)
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
} //End namespace artdaq

#endif //End ifndef __METRIC_INTERFACE__
