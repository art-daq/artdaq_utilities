// TestMetric.hh: Static storage for testing Metric system

#ifndef __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_
#define __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_

#include <chrono>
#include <list>
#include <mutex>
#include <string>

#include "trace.h"

namespace artdaq {
class TestMetric
{
public:
	struct MetricPoint
	{
		std::chrono::steady_clock::time_point sent_time;
		std::string metric;
		std::string value;
		std::string unit;
	};
static std::list<MetricPoint> received_metrics;

static void LockReceivedMetricMutex() {
	TLOG(20) << "Locking TestMetric::received_metrics_mutex";
	while (!received_metrics_mutex.try_lock()) usleep(10000);
	TLOG(20) << "Locked TestMetric::received_metrics_mutex";
}

static void UnlockReceivedMetricMutex() {
	TLOG(20) << "Unlocking TestMetric::received_metrics_mutex";
	received_metrics_mutex.unlock();
}

private:
static std::mutex received_metrics_mutex;
};
}  // namespace artdaq

#endif  // __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_