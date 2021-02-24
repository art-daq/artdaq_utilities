// test_metric.cc: Test Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 4/10/2019
//
// An implementation of the MetricPlugin that writes to the TestMetric static storage

#define TRACE_NAME "TestMetric"
#include "trace.h"

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "artdaq-utilities/Plugins/TestMetric.hh"
#include "fhiclcpp/ParameterSet.h"

#include <sys/types.h>
#include <unistd.h>
#include <ctime>
#include <string>

namespace artdaq {
/**
 * \brief TestMetric writes metric data to a statically-allocated memory block
 */
class TestMetricImpl final : public MetricPlugin
{
public:
	/**
   * \brief TestMetric Constructor.
   * \param config ParameterSet used to configure TestMetric
   * \param app_name Name of the application sending metrics
   */
	explicit TestMetricImpl(fhicl::ParameterSet const& config, std::string const& app_name)
	    : MetricPlugin(config, app_name)
	{
		startMetrics();
	}

	/**
   * \brief TestMetricImpl Destructor. Calls stopMetrics
   */
	~TestMetricImpl() override
	{
		stopMetrics();
	}

	/**
   * \brief Get the library name for the Test metric
   * \return The library name for the Test metric, "test"
   */
	std::string getLibName() const override { return "test"; }

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   * \param time Time the metric was sent
   */
	void sendMetric_(const std::string& name, const std::string& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		if (!inhibit_)
		{
			TestMetric::LockReceivedMetricMutex();
			TLOG(TLVL_TRACE) << "TestMetric: Adding MetricPoint name=" << name << ", value=" << value << ", unit=" << unit;
			TestMetric::received_metrics.emplace_back(TestMetric::MetricPoint{time, name, value, unit});
			TestMetric::UnlockReceivedMetricMutex();
		}
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   * \param time Time the metric was sent
   */
	void sendMetric_(const std::string& name, const int& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   * \param time Time the metric was sent
   */
	void sendMetric_(const std::string& name, const double& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   * \param time Time the metric was sent
   */
	void sendMetric_(const std::string& name, const float& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   * \param time Time the metric was sent
   */
	void sendMetric_(const std::string& name, const uint64_t& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
   * \brief Perform startup actions.
   */
	void startMetrics_() override
	{
	}

	/**
   * \brief Perform shutdown actions.
   */
	void stopMetrics_() override
	{
	}

private:
	TestMetricImpl(const TestMetricImpl&) = delete;
	TestMetricImpl(TestMetricImpl&&) = delete;
	TestMetricImpl& operator=(const TestMetricImpl&) = delete;
	TestMetricImpl& operator=(TestMetricImpl&&) = delete;
};

}  // End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::TestMetricImpl)
