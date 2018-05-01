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
#include "fhiclcpp/types/Atom.h"
#if MESSAGEFACILITY_HEX_VERSION >= 0x20103
# include "fhiclcpp/types/ConfigurationTable.h"
#endif

#include "artdaq-utilities/Plugins/MetricData.hh"
#include "cetlib/compiler_macros.h"
#ifndef FALLTHROUGH
#define FALLTHROUGH while(0)
#endif

namespace artdaq
{
	/**
	 * \brief The MetricPlugin class defines the interface that MetricManager uses to send metric data
	 * to the various metric plugins.
	 */
	class MetricPlugin
	{
	public:
		struct Config
		{
			fhicl::Atom<std::string> metricPluginType{ fhicl::Name{"metricPluginType"}, fhicl::Comment{"The name of the metric plugin to load (may have additional configuration parameters"} };
			fhicl::Atom<int> level{ fhicl::Name{"level"}, fhicl::Comment{"The verbosity level threshold for this plugin. Metrics with verbosity level greater than this will not be sent to the plugin"}, 0 };
			fhicl::Atom<double> reporting_interval{ fhicl::Name{"reporting_interval"}, fhicl::Comment{"How often recorded metrics are sent to the underlying metric storage"}, 15.0 };
		};
#if MESSAGEFACILITY_HEX_VERSION >= 0x20103
		using Parameters = fhicl::WrappedTable<Config>;
#endif

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
				//sendMetrics();
			}
		}

		/**
		 * \brief For each known metric, determine whether the reporting interval has elapsed, and if so, report a value to the underlying metric storage
		 * \param forceSend (Default = false): Force sending metrics, even if reporting interval has not elapsed
		 */
		void sendMetrics(bool forceSend = false, std::chrono::steady_clock::time_point interval_end = std::chrono::steady_clock::now())
		{
			for (auto metric : metricData_)
			{
				auto metricName = metric.first;
				if (readyToSend_(metricName) || forceSend)
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
							if (metricData_[metricName].size() > 1)
							{
								metricData_[metricName].erase(metricData_[metricName].begin(), std::prev(metricData_[metricName].end()));
							}
							sendMetric_(metricData_[metricName].back());
						}
						else
						{
							switch (metricType)
							{
							case MetricType::DoubleMetric:
							{
								auto ds = 0.0;
								for (auto& mv : metricData_[metricName]) { ds += mv.DoubleValue; }
								switch (metricMode)
								{
								case MetricMode::Average: ds /= static_cast<double>(metricData_[metricName].size()); break;
								case MetricMode::Rate: ds /= std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count(); break;
								case MetricMode::AccumulateAndRate: sendMetric_(metricName + " - Rate", ds / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count(), metricUnits + "/s"); break;
								default:
									break;
								}
								sendMetric_(metricName, ds, metricUnits);
							}
							break;
							case MetricType::FloatMetric:
							{
								auto fs = 0.0;
								double ds = 0.0;
								for (auto& mv : metricData_[metricName]) { fs += mv.FloatValue; }

								switch (metricMode)
								{
								case MetricMode::Average:
									ds = fs / static_cast<double>(metricData_[metricName].size());
									sendMetric_(metricName, ds, metricUnits);
									break;
								case MetricMode::Rate:
									ds = fs / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count();
									sendMetric_(metricName, ds, metricUnits);
									break;
								case MetricMode::AccumulateAndRate:
									sendMetric_(metricName + " - Rate", fs / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count(), metricUnits + "/s");
									FALLTHROUGH;
								case MetricMode::Accumulate:
								default:
									sendMetric_(metricName, fs, metricUnits);
									break;
								}
							}
							break;
							case MetricType::IntMetric:
							{
								auto is = 0;
								double ds = 0.0;
								for (auto& mv : metricData_[metricName]) { is += mv.IntValue; }

								switch (metricMode)
								{
								case MetricMode::Average:
									ds = is / static_cast<double>(metricData_[metricName].size());
									sendMetric_(metricName, ds, metricUnits);
									break;
								case MetricMode::Rate:
									ds = is / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count();
									sendMetric_(metricName, ds, metricUnits);
									break;
								case MetricMode::AccumulateAndRate:
									sendMetric_(metricName + " - Rate", is / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count(), metricUnits + "/s");
									FALLTHROUGH;
								case MetricMode::Accumulate:
								default:
									sendMetric_(metricName, is, metricUnits);
									break;
								}
							}
							break;
							case MetricType::UnsignedMetric:
							{
								auto us = 0UL;
								double ds = 0.0;
								for (auto& mv : metricData_[metricName]) { us += mv.UnsignedValue; }

								switch (metricMode)
								{
								case MetricMode::Average:
									ds = us / static_cast<double>(metricData_[metricName].size());
									sendMetric_(metricName, ds, metricUnits);
									break;
								case MetricMode::Rate:
									ds = us / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count();
									sendMetric_(metricName, ds, metricUnits);
									break;
								case MetricMode::AccumulateAndRate:
									sendMetric_(metricName + " - Rate", us / std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(interval_end - interval_start_[metricName]).count(), metricUnits + "/s");
									FALLTHROUGH;
								case MetricMode::Accumulate:
								default:
									sendMetric_(metricName, us, metricUnits);
									break;
								}
							}
							break;
							default:
								break;
							}
							metricData_[metricName].clear();
						}
					}
					interval_start_[metricName] = interval_end;
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
		std::unordered_map<std::string, std::chrono::steady_clock::time_point> interval_start_;

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
	} //End namespace artdaq

#endif //End ifndef __METRIC_INTERFACE__
