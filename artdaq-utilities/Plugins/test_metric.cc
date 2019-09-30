// test_metric.cc: Test Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 4/10/2019
//
// An implementation of the MetricPlugin that writes to the TestMetric static storage

#include "TRACE/tracemf.h"  // order matters -- trace.h (no "mf") is nested from MetricMacros.hh
#define TRACE_NAME "test_metric"

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
class TestMetricImpl : public MetricPlugin
{
public:
	/**
   * \brief TestMetric Constructor.
   * \param config ParameterSet used to configure TestMetric
   * \param app_name Name of the application sending metrics
   */
	explicit TestMetricImpl(fhicl::ParameterSet const& config, std::string const& app_name, std::string const& metric_name)
	    : MetricPlugin(config, app_name, metric_name)
	{
		startMetrics();
	}

	/**
   * \brief TestMetricImpl Destructor. Calls stopMetrics
   */
	virtual ~TestMetricImpl()
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
   */
	void sendMetric_(const std::string& name, const std::string& value, const std::string& unit) override
	{
		if (!inhibit_)
		{
			TestMetric::LockReceivedMetricMutex();
			METLOG(TLVL_TRACE) << "TestMetric: Adding MetricPoint name=" << name << ", value=" << value << ", unit=" << unit;
			TestMetric::received_metrics.emplace_back(TestMetric::MetricPoint{std::chrono::steady_clock::now(), name, value, unit});
			TestMetric::UnlockReceivedMetricMutex();
		}
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   */
	void sendMetric_(const std::string& name, const int& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   */
	void sendMetric_(const std::string& name, const double& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   */
	void sendMetric_(const std::string& name, const float& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
	}

	/**
   * \brief Write metric data to memory
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   */
	void sendMetric_(const std::string& name, const unsigned long int& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
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
};

}  // End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::TestMetricImpl)
