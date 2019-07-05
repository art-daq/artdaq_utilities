// TestMetric.hh: Static storage for testing Metric system

#ifndef __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_
#define __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_

#include <chrono>
#include <list>
#include <mutex>
#include <string>

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

	static std::mutex received_metrics_mutex;
	static std::list<MetricPoint> received_metrics;
};
}  // namespace artdaq

#endif  // __ARTDAQ_UTILITIES_PLUGINS_TESTMETRIC_HH_