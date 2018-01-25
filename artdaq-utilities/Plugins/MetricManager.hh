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
#include "artdaq-utilities/Plugins/MetricData.hh"
#include "fhiclcpp/fwd.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <sstream>
#include <queue>
#include <condition_variable>
#include <atomic>
#include <boost/thread.hpp>

namespace artdaq
{
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
	 * \brief Initialize the MetricPlugin instances
	 * \param pset The ParameterSet used to configure the MetricPlugin instances
	 * \param prefix The prefix to prepend to all metric names, unless useNameOverride is set to true
	 * 
	 * The ParameterSet should be a collection of tables, each configuring a MetricPlugin.
	 * See the MetricPlugin documentation for how to configure a MetricPlugin.
	 * "metric_queue_size": (Default: 10000): The maximum number of metric entries which can be stored in the metric queue.
	 * If the queue is above this size, new metric entries will be dropped until the plugins catch up.
	 */
	void initialize(fhicl::ParameterSet const& pset, std::string prefix = "");

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
	void reinitialize(fhicl::ParameterSet const& pset, std::string prefix = "");

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
	void sendMetric(std::string const& name, std::string const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix = "", bool useNameOverride = false);

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
	void sendMetric(std::string const& name, int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix = "", bool useNameOverride = false);

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
	void sendMetric(std::string const& name, double const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix = "", bool useNameOverride = false);

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
	void sendMetric(std::string const& name, float const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix = "", bool useNameOverride = false);

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
	void sendMetric(std::string const& name, long unsigned int const& value, std::string const& unit, int level, MetricMode mode, std::string const& metricPrefix = "", bool useNameOverride = false);

	/**
	 * \brief Sets the prefix prepended to all metrics without useNameOverride set
	 * \param prefix The prefix to prepend. Delimiter character in names is "."
	 */
	void setPrefix(std::string prefix) { prefix_ = prefix; }

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
	/// Return the size of the named metric queue
	/// </summary>
	/// <param name="name">Name of the metric queue to query. "" returns size of all queues (default)</param>
	/// <returns>Size of selected metric queue</returns>
	size_t metricQueueSize(std::string name = "");

private:
	void sendMetricLoop_();

	void startMetricLoop_();


	std::vector<std::unique_ptr<artdaq::MetricPlugin>> metric_plugins_;
	boost::thread metric_sending_thread_;
	std::mutex metric_mutex_;
	std::condition_variable metric_cv_;
	int metric_send_interval_ms_;

	bool initialized_;
	bool running_;
	bool active_;
	std::string prefix_;
	
	//https://stackoverflow.com/questions/228908/is-listsize-really-on
	// e10 does NOT properly have std::list::size as O(1)!!! Keep track of size separately while we still support e10.
	typedef std::unique_ptr<MetricData> metric_data_ptr;
	typedef std::pair<size_t, std::list<metric_data_ptr>> queue_entry;

	std::unordered_map<std::string, queue_entry> metric_queue_;
	std::mutex metric_queue_mutex_;
	std::atomic<size_t> missed_metric_calls_;
	size_t metric_queue_max_size_;
	size_t metric_queue_notify_size_;
};

#endif /* artdaq_DAQrate_MetricManager_hh */
