/**
 * \file TestMetric.hh: Static storage for testing Metric system
 */

#ifndef __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_
#define __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_

#include <chrono>
#include <list>
#include <mutex>
#include <string>

#include "trace.h"

namespace artdaq {
/// <summary>
/// Provides in-memory storage of metric data for testing
/// </summary>
class TestMetric
{
public:
	/// <summary>
	/// Describes a single metric point
	/// </summary>
	struct MetricPoint
	{
		std::chrono::system_clock::time_point sent_time;  ///< When the metric was received
		std::string metric;                               ///< Name of the metric
		std::string value;                                ///< Value of the metric
		std::string unit;                                 ///< Units for the metric
	};

	/// <summary>
	/// Lock the ReceivedMetricMutex
	/// </summary>
	static void LockReceivedMetricMutex()
	{
		TLOG(TLVL_DEBUG + 39) << "Locking TestMetric::received_metrics_mutex";
		while (!received_metrics_mutex.try_lock()) usleep(10000);
		TLOG(TLVL_DEBUG + 39) << "Locked TestMetric::received_metrics_mutex";
	}

	/// <summary>
	/// Unlock the ReceivedMetricMutex
	/// </summary>
	static void UnlockReceivedMetricMutex()
	{
		TLOG(TLVL_DEBUG + 39) << "Unlocking TestMetric::received_metrics_mutex";
		received_metrics_mutex.unlock();
	}

	static std::mutex received_metrics_mutex;        ///< Mutex to protect the received_metrics list
	static std::list<MetricPoint> received_metrics;  ///< List of received metric data
};
}  // namespace artdaq

#endif  // __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_
