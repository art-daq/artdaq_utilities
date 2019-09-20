#include "artdaq-utilities/Plugins/MetricPlugin.hh"
#include "artdaq-utilities/Plugins/TestMetric.hh"

#define BOOST_TEST_MODULES MetricPlugin_t
#include "cetlib/quiet_unit_test.hpp"
#include "cetlib_except/exception.h"
#include "fhiclcpp/make_ParameterSet.h"

#include "trace.h"

namespace artdaqtest {
/// <summary>
/// Metric plugin which stores metric call counts for testing
/// </summary>
class MetricPluginTestAdapter : public artdaq::MetricPlugin
{
public:
	/// <summary>
	/// Constructor
	/// </summary>
	/// <param name="ps">fhicl::ParameterSet used to configure MetricPLugin</param>
	explicit MetricPluginTestAdapter(fhicl::ParameterSet ps)
	    : artdaq::MetricPlugin(ps, "MetricPlugin_t")
	    , sendMetric_string_calls(0)
	    , sendMetric_int_calls(0)
	    , sendMetric_double_calls(0)
	    , sendMetric_float_calls(0)
	    , sendMetric_unsigned_calls(0)
	    , startMetrics_calls(0)
	    , stopMetrics_calls(0)
	{}

	/**
	 * \brief Send a String metric, record the call and discard the metric's data
	 */
	virtual void sendMetric_(const std::string&, const std::string&, const std::string&) override { sendMetric_string_calls++; }
	/**
	 * \brief Send an int metric, record the call and discard the metric's data
	 */
	virtual void sendMetric_(const std::string&, const int&, const std::string&) override { sendMetric_int_calls++; }
	/**
	 * \brief Send a double metric, record the call and discard the metric's data
	 */
	virtual void sendMetric_(const std::string&, const double&, const std::string&) override { sendMetric_double_calls++; }
	/**
	 * \brief Send a float metric, record the call and discard the metric's data
	 */
	virtual void sendMetric_(const std::string&, const float&, const std::string&) override { sendMetric_float_calls++; }
	/**
	 * \brief Send an unsigned metric, record the call and discard the metric's data
	 */
	virtual void sendMetric_(const std::string&, const long unsigned int&, const std::string&) override { sendMetric_unsigned_calls++; }

	/**
	 * \brief Record that a startMetrics call was received
	 */
	virtual void startMetrics_() override { startMetrics_calls++; }
	/**
	 * \brief Record that a stopMetrics call was received
	 */
	virtual void stopMetrics_() override { stopMetrics_calls++; }

	size_t sendMetric_string_calls;    ///< The number of string metric calls received
	size_t sendMetric_int_calls;       ///< The number of int metric calls received
	size_t sendMetric_double_calls;    ///< The number of double metric calls received
	size_t sendMetric_float_calls;     ///< The number of float metric calls received
	size_t sendMetric_unsigned_calls;  ///< The numberof unsigned metric calls received
	size_t startMetrics_calls;         ///< The number of startMetrics_ calls received
	size_t stopMetrics_calls;          ///< The number of stopMetrics_ calls received

	// Getters for protected members
	/// <summary>
	/// Get the ParameterSet used to configure the plugin
	/// </summary>
	/// <returns>The ParameterSet used to configure the plugin</returns>
	fhicl::ParameterSet get_pset() { return pset; }
	/// <summary>
	/// Get the MetricPlugin's accumulationTime variable
	/// </summary>
	/// <returns>The accumulationTime variable from the MetricPlugin</returns>
	double get_accumulationTime_() { return accumulationTime_; }
	/// <summary>
	/// Get the MetricPlugin's app_name_ variable
	/// </summary>
	/// <returns>The app_name_ variable from the MetricPlugin</returns>
	std::string get_app_name_() { return app_name_; }
	/// <summary>
	/// Get the MetricPlugin's inhibit_ variable
	/// </summary>
	/// <returns>The inhibit_ variable from the MetricPlugin</returns>
	bool get_inhibit_() { return inhibit_; }
	/// <summary>
	/// Get the MetricPlugin's level_mask_ variable
	/// </summary>
	/// <returns>The level_mask_ variable from the MetricPlugin</returns>
	std::bitset<64> get_level_mask_() { return level_mask_; }
};
}  // namespace artdaqtest

BOOST_AUTO_TEST_SUITE(MetricPlugin_test)

BOOST_AUTO_TEST_CASE(Constructor)
{
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case Constructor BEGIN";
	std::string testConfig = "reporting_interval: 0 level: 4 metric_levels: [7,9,11] level_string: \"13-15,17,19-21,7-9\"";
	fhicl::ParameterSet pset;
	fhicl::make_ParameterSet(testConfig, pset);
	artdaqtest::MetricPluginTestAdapter mpta(pset);
	BOOST_REQUIRE_EQUAL(mpta.get_pset().to_string(), pset.to_string());
	BOOST_REQUIRE_EQUAL(mpta.get_accumulationTime_(), 0.0);
	BOOST_REQUIRE_EQUAL(mpta.get_level_mask_()[8], true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(8), true);
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case Constructor END";
}

BOOST_AUTO_TEST_CASE(IsLevelEnabled)
{
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case IsLevelEnabled BEGIN";
	std::string testConfig = "reporting_interval: 0 level: 4 metric_levels: [7,9,11] level_string: \"13-15,17,19-21,7-9\"";
	fhicl::ParameterSet pset;
	fhicl::make_ParameterSet(testConfig, pset);
	artdaqtest::MetricPluginTestAdapter mpta(pset);

	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(0), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(1), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(2), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(3), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(4), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(5), false);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(6), false);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(7), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(8), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(9), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(10), false);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(11), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(12), false);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(13), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(14), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(15), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(16), false);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(17), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(18), false);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(19), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(20), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(21), true);
	BOOST_REQUIRE_EQUAL(mpta.IsLevelEnabled(22), false);

	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case IsLevelEnabled END";
}

BOOST_AUTO_TEST_CASE(LibraryName)
{
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case LibraryName BEGIN";
	std::string testConfig = "reporting_interval: 0 level: 4 metric_levels: [7,9,11] level_string: \"13-15,17,19-21,7-9\"";
	fhicl::ParameterSet pset;
	fhicl::make_ParameterSet(testConfig, pset);
	artdaqtest::MetricPluginTestAdapter mpta(pset);

	BOOST_REQUIRE_EQUAL(mpta.getLibName(), "ERROR");
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case LibraryName END";
}

BOOST_AUTO_TEST_CASE(AddMetricData)
{
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case AddMetricData BEGIN";
	std::string testConfig = "reporting_interval: 1.0 level: 4 metric_levels: [7,9,11] level_string: \"13-15,17,19-21,7-9\"";
	fhicl::ParameterSet pset;
	fhicl::make_ParameterSet(testConfig, pset);
	artdaqtest::MetricPluginTestAdapter mpta(pset);

	auto smd = std::make_unique<artdaq::MetricData>("String Metric", "Test Value", "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto imd = std::make_unique<artdaq::MetricData>("Int Metric", 2, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto fmd = std::make_unique<artdaq::MetricData>("Float Metric", 3.5f, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto dmd = std::make_unique<artdaq::MetricData>("Double Metric", 4.5, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto umd = std::make_unique<artdaq::MetricData>("Unsigned Metric", 5UL, "Units", 1, artdaq::MetricMode::LastPoint, "", false);

	mpta.addMetricData(smd);
	mpta.addMetricData(imd);
	mpta.addMetricData(fmd);
	mpta.addMetricData(dmd);
	mpta.addMetricData(umd);

	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 0);

	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case AddMetricData END";
}

BOOST_AUTO_TEST_CASE(SendMetrics)
{
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case SendMetrics BEGIN";
	std::string testConfig = "reporting_interval: 0.01 level: 4 metric_levels: [7,9,11] level_string: \"13-15,17,19-21,7-9\"";
	fhicl::ParameterSet pset;
	fhicl::make_ParameterSet(testConfig, pset);
	artdaqtest::MetricPluginTestAdapter mpta(pset);

	auto smd = std::make_unique<artdaq::MetricData>("String Metric", "Test Value", "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto imd = std::make_unique<artdaq::MetricData>("Int Metric", 2, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto fmd = std::make_unique<artdaq::MetricData>("Float Metric", 3.5f, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto dmd = std::make_unique<artdaq::MetricData>("Double Metric", 4.5, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto umd = std::make_unique<artdaq::MetricData>("Unsigned Metric", 5UL, "Units", 1, artdaq::MetricMode::LastPoint, "", false);

	mpta.addMetricData(smd);
	mpta.addMetricData(imd);
	mpta.addMetricData(fmd);
	mpta.addMetricData(dmd);
	mpta.addMetricData(umd);

	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 0);

	mpta.sendMetrics();

	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 1);

	mpta.addMetricData(smd);
	mpta.addMetricData(imd);
	mpta.addMetricData(fmd);
	mpta.addMetricData(dmd);
	mpta.addMetricData(umd);

	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 1);

	mpta.sendMetrics();

	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 1);

	usleep(200000);

	mpta.sendMetrics();

	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 2);

	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case SendMetrics END";
}

BOOST_AUTO_TEST_CASE(StartMetrics)
{
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case StartMetrics BEGIN";
	std::string testConfig = "reporting_interval: 0 level: 4 metric_levels: [7,9,11] level_string: \"13-15,17,19-21,7-9\"";
	fhicl::ParameterSet pset;
	fhicl::make_ParameterSet(testConfig, pset);
	artdaqtest::MetricPluginTestAdapter mpta(pset);

	mpta.startMetrics();
	BOOST_REQUIRE_EQUAL(mpta.startMetrics_calls, 1);
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case StartMetrics END";
}

BOOST_AUTO_TEST_CASE(StopMetrics)
{
	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case StopMetrics BEGIN";
	std::string testConfig = "reporting_interval: 1.0 level: 4 metric_levels: [7,9,11] level_string: \"13-15,17,19-21,7-9\"";
	fhicl::ParameterSet pset;
	fhicl::make_ParameterSet(testConfig, pset);
	artdaqtest::MetricPluginTestAdapter mpta(pset);

	auto smd = std::make_unique<artdaq::MetricData>("String Metric", "Test Value", "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto imd = std::make_unique<artdaq::MetricData>("Int Metric", 2, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto fmd = std::make_unique<artdaq::MetricData>("Float Metric", 3.5f, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto dmd = std::make_unique<artdaq::MetricData>("Double Metric", 4.5, "Units", 1, artdaq::MetricMode::LastPoint, "", false);
	auto umd = std::make_unique<artdaq::MetricData>("Unsigned Metric", 5UL, "Units", 1, artdaq::MetricMode::LastPoint, "", false);

	mpta.addMetricData(smd);
	mpta.addMetricData(imd);
	mpta.addMetricData(fmd);
	mpta.addMetricData(dmd);
	mpta.addMetricData(umd);

	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 0);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 0);

	mpta.stopMetrics();

	BOOST_REQUIRE_EQUAL(mpta.stopMetrics_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_string_calls, 1);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_int_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_float_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_double_calls, 2);
	BOOST_REQUIRE_EQUAL(mpta.sendMetric_unsigned_calls, 2);

	TLOG(TLVL_INFO, "MetricPlugin_t") << "Test Case StopMetrics END";
}

BOOST_AUTO_TEST_SUITE_END()