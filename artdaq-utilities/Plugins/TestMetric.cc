
#include "artdaq-utilities/Plugins/TestMetric.hh"

std::mutex artdaq::TestMetric::received_metrics_mutex;
std::list<artdaq::TestMetric::MetricPoint> artdaq::TestMetric::received_metrics = std::list<TestMetric::MetricPoint>();