#ifndef artdaq_DAQrate_MetricManager_hh
#define artdaq_DAQrate_MetricManager_hh

// MetricManager class definition file
// Author: Eric Flumerfelt
// Last Modified: 11/14/2014
//
// MetricManager loads a user-specified set of plugins, sends them their configuration,
// and sends them data as it is recieved. It also maintains the state of the plugins
// relative to the application state.

#include "artdaq-utilities/Plugins/MetricData.hh"
#include "artdaq-utilities/Plugins/MetricPlugin.hh"
#include "artdaq-utilities/Plugins/SystemMetricCollector.hh"

namespace fhicl {
class ParameterSet;
}

#include "fhiclcpp/types/Atom.h"
#include "fhiclcpp/types/Comment.h"
#include "fhiclcpp/types/ConfigurationTable.h"
#include "fhiclcpp/types/Name.h"
#include "fhiclcpp/types/OptionalTable.h"

#include <atomic>
#include <boost/thread.hpp>
#include <condition_variable>
#include <queue>
#include <sstream>

namespace artdaq {
class MetricManager;
}

/**
 * \brief The MetricManager class handles loading metric plugins and asynchronously sending metric data to them.
 * It is designed to be a "black hole" for metrics, taking as little time as possible so that metrics do not impact
 * the data-taking performance.
 */
class artdaq::MetricManager
{
public:
	/**
	 * \brief The Config struct defines the accepted configuration parameters for this class
	 */
	struct Config
	{
		/// "metric_queue_size": (Default: 1000): The maximum number of metric entries which can be stored in the metric
		/// queue.
		fhicl::Atom<size_t> metric_queue_size{
		    fhicl::Name{"metric_queue_size"},
		    fhicl::Comment{"The maximum number of metric entries which can be stored in the metric queue."}, 1000};
		/// "metric_queue_notify_size": (Default: 10): The number of metric entries in the list which will cause reports of
		/// the queue size to be printed.
		fhicl::Atom<size_t> metric_queue_notify_size{
		    fhicl::Name{"metric_queue_notify_size"},
		    fhicl::Comment{
		        "The number of metric entries in the list which will cause reports of the queue size to be printed."},
		    10};
		/// "metric_send_maximum_delay_ms": (Default: 15000): The maximum amount of time between metric send calls (will
		/// send 0s for metrics which have not reported in this interval)
		fhicl::Atom<int> metric_send_maximum_delay_ms{
		    fhicl::Name{"metric_send_maximum_delay_ms"},
		    fhicl::Comment{"The maximum amount of time between metric send calls (will send 0s for metrics which have not "
		                   "reported in this interval)"},
		    15000};
		/// "send_system_metrics": (Default: false): Whether to collect and send system metrics such as CPU usage, Memory usage and network activity.
		fhicl::Atom<bool> send_system_metrics{fhicl::Name{"send_system_metrics"}, fhicl::Comment{"Whether to collect and send system metrics such as CPU usage, Memory usage and network activity."}, false};
		/// "send_process_metrics" (Default: false): Whether to collect and send process CPU usage and Memory usage
		fhicl::Atom<bool> send_process_metrics{fhicl::Name{"send_process_metrics"}, fhicl::Comment{"Whether to collect and send process CPU usage and Memory usage"}, false};
		/// Example MetricPlugin Configuration
		fhicl::OptionalTable<artdaq::MetricPlugin::Config> metricConfig{fhicl::Name{"metricConfig"}};
	};
	/// Used for ParameterSet validation (if desired)
	using Parameters = fhicl::WrappedTable<Config>;

	/**
	 * \brief Construct an instance of the MetricManager class
	 */
	MetricManager();

	/**
	 * \brief Copy Constructor is deleted
	 */
	MetricManager(MetricManager const&) = delete;

	/**
	 * \brief MetricManager destructor
	 *
	 * Calls shutdown()
	 */
	virtual ~MetricManager() noexcept;

	/**
	 * \brief Copy Assignment operator is deleted
	 * \return MetricManager copy
	 */
	MetricManager& operator=(MetricManager const&) = delete;

	/**
	 * \brief Move Constructor is deleted
	 */
	MetricManager(MetricManager&&) = delete;
	/**
	 * @brief Move assignment operator is deleted
	 * @return Moved MetricManager
	 */
	MetricManager& operator=(MetricManager&&) = delete;

	/**
	 * \brief Initialize the MetricPlugin instances
	 * \param pset The ParameterSet used to configure the MetricPlugin instances
	 * \param prefix The prefix to prepend to all metric names, unless useNameOverride is set to true
	 *
	 * The ParameterSet should be a collection of tables, each configuring a MetricPlugin.
	 * See the MetricPlugin documentation for how to configure a MetricPlugin.
	 * "metric_queue_size": (Default: 1000): The maximum number of metric entries which can be stored in the metric queue. If the queue is above this
	 * size, new metric entries will be dropped until the plugins catch up.
	 * "metric_queue_notify_size": (Default: 10): The number of metric entries in the list which will cause reports of the queue size to be printed.
	 * "metric_send_maximum_delay_ms": (Default: 15000): The maximum amount of time between metric send calls (will send 0s for metrics which have not reported in this interval)
	 * "metric_holdoff_us": (Default: 1000): Amount of time, in microseconds, to delay sending metrics after each sendMetric call (to ensure that multiple associated calls are in the same metrics interval)
	 */
	void initialize(fhicl::ParameterSet const& pset, std::string const& prefix = "");

	/**
	 * \brief Perform startup actions for each configured MetricPlugin
	 */
	void do_start();

	/**
	 * \brief Stop sending metrics to the MetricPlugin instances
	 */
	void do_stop();

	/**
	 * \brief Pause metric sending. Currently a No-Op.
	 */
	void do_pause();

	/**
	 * \brief Resume metric sending. Currently a No-Op.
	 */
	void do_resume();

	/**
	 * \brief Reinitialize all MetricPlugin Instances
	 * \param pset ParameterSet used to configure the MetricPlugin instances
	 * \param prefix Prefix to apply to Metric names
	 *
	 * Calls shutdown(), then initialize(pset, prefix).
	 */
	void reinitialize(fhicl::ParameterSet const& pset, std::string const& prefix = "");

	/**
	 * \brief Call the destructors for all configured MetricPlugin instances
	 */
	void shutdown();

	/**
	 * \brief Send a metric with the given parameters to any MetricPlugins with a threshold level >= to level.
	 * \param name The Name of the metric
	 * \param value The value of the metric
	 * \param unit The units of the metric
	 * \param level The verbosity level of the metric. Higher number == more verbose
	 * \param mode The MetricMode that the metric should operate in. Options are:
	 *    LastPoint: Every reporting_interval, the latest metric value is sent (For run/event numbers, etc)
	 *    Accumulate: Every reporting_interval, the sum of all metric values since the last report is sent (for counters)
	 *    Average: Every reporting_interval, the average of all metric values since the last report is sent (for rates)
	 * \param metricPrefix An additional prefix to prepend to the metric name
	 * \param useNameOverride Whether to use name verbatim and not apply prefixes
	 */
	void sendMetric(std::string const& name, std::string const& value, std::string const& unit, int level,
	                MetricMode mode, std::string const& metricPrefix = "", bool useNameOverride = false);

	/**
	 * \brief Send a metric with the given parameters to any MetricPlugins with a threshold level >= to level.
	 * \param name The Name of the metric
	 * \param value The value of the metric
	 * \param unit The units of the metric
	 * \param level The verbosity level of the metric. Higher number == more verbose
	 * \param mode The MetricMode that the metric should operate in. Options are:
	 *    LastPoint: Every reporting_interval, the latest metric value is sent (For run/event numbers, etc)
	 *    Accumulate: Every reporting_interval, the sum of all metric values since the last report is sent (for counters)
	 *    Average: Every reporting_interval, the average of all metric values since the last report is sent (for rates)
	 * \param metricPrefix An additional prefix to prepend to the metric name
	 * \param useNameOverride Whether to use name verbatim and not apply prefixes
	 */
	void sendMetric(std::string const& name, int const& value, std::string const& unit, int level, MetricMode mode,
	                std::string const& metricPrefix = "", bool useNameOverride = false);

	/**
	 * \brief Send a metric with the given parameters to any MetricPlugins with a threshold level >= to level.
	 * \param name The Name of the metric
	 * \param value The value of the metric
	 * \param unit The units of the metric
	 * \param level The verbosity level of the metric. Higher number == more verbose
	 * \param mode The MetricMode that the metric should operate in. Options are:
	 *    LastPoint: Every reporting_interval, the latest metric value is sent (For run/event numbers, etc)
	 *    Accumulate: Every reporting_interval, the sum of all metric values since the last report is sent (for counters)
	 *    Average: Every reporting_interval, the average of all metric values since the last report is sent (for rates)
	 * \param metricPrefix An additional prefix to prepend to the metric name
	 * \param useNameOverride Whether to use name verbatim and not apply prefixes
	 */
	void sendMetric(std::string const& name, double const& value, std::string const& unit, int level, MetricMode mode,
	                std::string const& metricPrefix = "", bool useNameOverride = false);

	/**
	 * \brief Send a metric with the given parameters to any MetricPlugins with a threshold level >= to level.
	 * \param name The Name of the metric
	 * \param value The value of the metric
	 * \param unit The units of the metric
	 * \param level The verbosity level of the metric. Higher number == more verbose
	 * \param mode The MetricMode that the metric should operate in. Options are:
	 *    LastPoint: Every reporting_interval, the latest metric value is sent (For run/event numbers, etc)
	 *    Accumulate: Every reporting_interval, the sum of all metric values since the last report is sent (for counters)
	 *    Average: Every reporting_interval, the average of all metric values since the last report is sent (for rates)
	 * \param metricPrefix An additional prefix to prepend to the metric name
	 * \param useNameOverride Whether to use name verbatim and not apply prefixes
	 */
	void sendMetric(std::string const& name, float const& value, std::string const& unit, int level, MetricMode mode,
	                std::string const& metricPrefix = "", bool useNameOverride = false);

	/**
	 * \brief Send a metric with the given parameters to any MetricPlugins with a threshold level >= to level.
	 * \param name The Name of the metric
	 * \param value The value of the metric
	 * \param unit The units of the metric
	 * \param level The verbosity level of the metric. Higher number == more verbose
	 * \param mode The MetricMode that the metric should operate in. Options are:
	 *    LastPoint: Every reporting_interval, the latest metric value is sent (For run/event numbers, etc)
	 *    Accumulate: Every reporting_interval, the sum of all metric values since the last report is sent (for counters)
	 *    Average: Every reporting_interval, the average of all metric values since the last report is sent (for rates)
	 * \param metricPrefix An additional prefix to prepend to the metric name
	 * \param useNameOverride Whether to use name verbatim and not apply prefixes
	 */
	void sendMetric(std::string const& name, uint64_t const& value, std::string const& unit, int level,
	                MetricMode mode, std::string const& metricPrefix = "", bool useNameOverride = false);

	/**
	 * \brief Sets the prefix prepended to all metrics without useNameOverride set
	 * \param prefix The prefix to prepend. Delimiter character in names is "."
	 */
	void setPrefix(std::string const& prefix) { prefix_ = prefix; }

	/// <summary>
	/// Returns whether the MetricManager has been initialized (configured)
	/// </summary>
	/// <returns>True if MetricManager is initialized</returns>
	bool Initialized() { return initialized_; }

	/// <summary>
	/// Returns whether the MetricManager is running (accepting metric calls)
	/// </summary>
	/// <returns>True if MetricManager is running</returns>
	bool Running() { return running_; }

	/// <summary>
	/// Returns whether any Metric Plugins are defined and configured
	/// </summary>
	/// <returns>True if a Metric Plugin can accept metrics</returns>
	bool Active() { return active_; }

	/// <summary>
	/// Returns whether the metric queue is completely empty
	/// </summary>
	/// <returns>True if the metric queue is empty</returns>
	bool metricQueueEmpty();

	/// <summary>
	/// Determine whether the MetricManager or any of its plugins are currently processing metrics. Used for MetricManager_t
	/// </summary>
	/// <returns>True if MetricManager or one of its MetricPlugins are currently processing metrics.</returns>
	bool metricManagerBusy();

	/// <summary>
	/// Return the size of the named metric queue
	/// </summary>
	/// <param name="name">Name of the metric queue to query. "" returns size of all queues (default)</param>
	/// <returns>Size of selected metric queue</returns>
	size_t metricQueueSize(std::string const& name = "");

private:
	void sendMetricLoop_();

	void startMetricLoop_();

	std::vector<std::unique_ptr<artdaq::MetricPlugin>> metric_plugins_;
	boost::thread metric_sending_thread_;
	std::mutex metric_mutex_;
	std::condition_variable metric_cv_;
	int metric_send_interval_ms_{15000};
	int metric_holdoff_us_{1000};
	std::chrono::steady_clock::time_point last_metric_received_;
	std::unique_ptr<SystemMetricCollector> system_metric_collector_;

	std::atomic<bool> initialized_;
	std::atomic<bool> running_;
	std::atomic<bool> active_;
	std::atomic<bool> busy_;
	std::string prefix_;

	std::unordered_map<std::string, std::unique_ptr<MetricData>> metric_cache_;
	std::mutex metric_cache_mutex_;
	std::atomic<size_t> missed_metric_calls_;
	std::atomic<size_t> metric_calls_;
	size_t metric_cache_max_size_{1000};
	size_t metric_cache_notify_size_{10};

	std::chrono::steady_clock::time_point last_failure_;
};

#endif /* artdaq_DAQrate_MetricManager_hh */
