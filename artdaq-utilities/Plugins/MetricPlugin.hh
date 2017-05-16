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
		* \param name The name of the metric
		* \param value The current value of the metric
		* \param unit The units of the metric
		* \param accumulate Whether to average the metric over reporting_interval, or send it immediately. Defaults to true.
		*/
		void sendMetric(const std::string& name, const std::string& value, const std::string& unit, bool accumulate = true)
		{
			if (accumulate)
			{
				// There's no sensible way to accumulate string values, just pass them through...
				sendMetric_(name, value, unit);
			}
			else
			{
				sendMetric_(name, value, unit);
			}
		}

		/**
		* \brief Send a metric value to the MetricPlugin
		* \param name The name of the metric
		* \param value The current value of the metric
		* \param unit The units of the metric
		* \param accumulate Whether to average the metric over reporting_interval, or send it immediately. Defaults to true.
		*/
		void sendMetric(const std::string& name, const int& value, const std::string& unit, bool accumulate = true)
		{
			// 22-Jul-2015, KAB - moved push_back here so that we always get the name
			// added to the map, even if accumulate is false. This helps ensure that a
			// zero is sent at stop time.
			intAccumulator_[name].push_back(value);

			if (!accumulate)
			{
				sendMetric_(name, value, unit);
				intAccumulator_[name].clear();
				lastSendTime_[name] = std::chrono::steady_clock::now();
				return;
			}

			if (readyToSend_(name))
			{
				double sendValue = 0;
				for (auto val : intAccumulator_[name])
				{
					sendValue += val / static_cast<double>(intAccumulator_[name].size());
				}

				sendMetric_(name, sendValue, unit);

				intAccumulator_[name].clear();
			}
		}

		/**
		* \brief Send a metric value to the MetricPlugin
		* \param name The name of the metric
		* \param value The current value of the metric
		* \param unit The units of the metric
		* \param accumulate Whether to average the metric over reporting_interval, or send it immediately. Defaults to true.
		*/
		void sendMetric(const std::string& name, const double& value, const std::string& unit, bool accumulate = true)
		{
			// 22-Jul-2015, KAB - moved push_back here so that we always get the name
			// added to the map, even if accumulate is false. This helps ensure that a
			// zero is sent at stop time.
			doubleAccumulator_[name].push_back(value);

			if (!accumulate)
			{
				sendMetric_(name, value, unit);
				doubleAccumulator_[name].clear();
				lastSendTime_[name] = std::chrono::steady_clock::now();
				return;
			}

			if (readyToSend_(name))
			{
				double sendValue = 0;
				for (auto val : doubleAccumulator_[name])
				{
					sendValue += val / doubleAccumulator_[name].size();
				}

				sendMetric_(name, sendValue, unit);

				doubleAccumulator_[name].clear();
			}
		}

		/**
		* \brief Send a metric value to the MetricPlugin
		* \param name The name of the metric
		* \param value The current value of the metric
		* \param unit The units of the metric
		* \param accumulate Whether to average the metric over reporting_interval, or send it immediately. Defaults to true.
		*/
		void sendMetric(const std::string& name, const float& value, const std::string& unit, bool accumulate = true)
		{
			// 22-Jul-2015, KAB - moved push_back here so that we always get the name
			// added to the map, even if accumulate is false. This helps ensure that a
			// zero is sent at stop time.
			floatAccumulator_[name].push_back(value);

			if (!accumulate)
			{
				sendMetric_(name, value, unit);
				floatAccumulator_[name].clear();
				lastSendTime_[name] = std::chrono::steady_clock::now();
				return;
			}

			if (readyToSend_(name))
			{
				float sendValue = 0;
				for (auto val : floatAccumulator_[name])
				{
					sendValue += val / floatAccumulator_[name].size();
				}

				sendMetric_(name, sendValue, unit);

				floatAccumulator_[name].clear();
			}
		}

		/**
		 * \brief Send a metric value to the MetricPlugin
		 * \param name The name of the metric
		 * \param value The current value of the metric 
		 * \param unit The units of the metric
		 * \param accumulate Whether to average the metric over reporting_interval, or send it immediately. Defaults to true.
		 */
		void sendMetric(const std::string& name, const long unsigned int& value, const std::string& unit, bool accumulate = true)
		{
			// 22-Jul-2015, KAB - moved push_back here so that we always get the name
			// added to the map, even if accumulate is false. This helps ensure that a
			// zero is sent at stop time.
			auto uvalue = static_cast<uint32_t>(value);
			uintAccumulator_[name].push_back(uvalue);

			if (!accumulate)
			{
				sendMetric_(name, value, unit);
				uintAccumulator_[name].clear();
				lastSendTime_[name] = std::chrono::steady_clock::now();
				return;
			}

			if (readyToSend_(name))
			{
				double sendValue = 0;
				for (auto val : uintAccumulator_[name])
				{
					sendValue += val / static_cast<double>(uintAccumulator_[name].size());
				}

				sendMetric_(name, sendValue, unit);

				uintAccumulator_[name].clear();
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
			for (auto dv : doubleAccumulator_)
			{
				static_cast<std::vector<double>>(dv.second).clear();
				// 22-Jul-2015, KAB - added cast to get correct call and false to get immediate zero
				sendMetric(dv.first, static_cast<double>(0.0), "", false);
			}
			for (auto iv : intAccumulator_)
			{
				static_cast<std::vector<int>>(iv.second).clear();
				// 22-Jul-2015, KAB - added cast to get correct call and false to get immediate zero
				sendMetric(iv.first, static_cast<int>(0), "", false);
			}
			for (auto fv : floatAccumulator_)
			{
				static_cast<std::vector<float>>(fv.second).clear();
				// 22-Jul-2015, KAB - added cast to get correct call and false to get immediate zero
				sendMetric(fv.first, static_cast<float>(0.0), "", false);
			}
			for (auto uv : uintAccumulator_)
			{
				static_cast<std::vector<uint32_t>>(uv.second).clear();
				// 22-Jul-2015, KAB - added cast to get correct call and false to get immediate zero
				sendMetric(uv.first, static_cast<long unsigned int>(0), "", false);
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
		std::unordered_map<std::string, std::vector<double>> doubleAccumulator_;
		std::unordered_map<std::string, std::vector<int>> intAccumulator_;
		std::unordered_map<std::string, std::vector<float>> floatAccumulator_;
		std::unordered_map<std::string, std::vector<uint32_t>> uintAccumulator_;
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
	};
} //End namespace artdaq

#endif //End ifndef __METRIC_INTERFACE__
