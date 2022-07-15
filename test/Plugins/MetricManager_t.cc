
#define TRACE_NAME "MetricManager_t"
#include "trace.h"

#include "artdaq-utilities/Plugins/MetricManager.hh"
#include "artdaq-utilities/Plugins/TestMetric.hh"

#define BOOST_TEST_MODULE MetricManager_t
#include "cetlib/quiet_unit_test.hpp"
#include "cetlib_except/exception.h"

BOOST_AUTO_TEST_SUITE(MetricManager_test)

#define TRACE_REQUIRE_EQUAL(l, r)                                                                                                    \
	do                                                                                                                               \
	{                                                                                                                                \
		if ((l) == (r))                                                                                                              \
		{                                                                                                                            \
			TLOG(TLVL_DEBUG) << __LINE__ << ": Checking if " << #l << " (" << (l) << ") equals " << #r << " (" << (r) << ")...YES!"; \
		}                                                                                                                            \
		else                                                                                                                         \
		{                                                                                                                            \
			TLOG(TLVL_ERROR) << __LINE__ << ": Checking if " << #l << " (" << (l) << ") equals " << #r << " (" << (r) << ")...NO!";  \
		}                                                                                                                            \
		BOOST_REQUIRE_EQUAL((l), (r));                                                                                               \
	} while (0)

using seconds = std::chrono::duration<double, std::ratio<1>>;

constexpr double GetElapsedTime(std::chrono::steady_clock::time_point then,
                                std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now())
{
	return std::chrono::duration_cast<seconds>(now - then).count();
}

BOOST_AUTO_TEST_CASE(Construct)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST Construct" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);
	TLOG_DEBUG("MetricManager_t") << "END TEST Construct" << TLOG_ENDL;
}

BOOST_AUTO_TEST_CASE(Initialize)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST Initialize" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);

	std::string testConfig = "msgFac: { level: 5 metricPluginType: test reporting_interval: 1.0}";
	fhicl::ParameterSet pset = fhicl::ParameterSet::make(testConfig);

	mm.initialize(pset, "MetricManager_t");
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);

	mm.do_start();
	TRACE_REQUIRE_EQUAL(mm.Running(), true);
	TRACE_REQUIRE_EQUAL(mm.Active(), true);
	TLOG_DEBUG("MetricManager_t") << "END TEST Initialize" << TLOG_ENDL;
}

BOOST_AUTO_TEST_CASE(Initialize_WithError)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST Initialize_WithError" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);

	std::string testConfig = "err: { level: 5 metricPluginType: nonExistentPluginType reporting_interval: 1.0}";
	fhicl::ParameterSet pset = fhicl::ParameterSet::make(testConfig);

	mm.initialize(pset, "MetricManager_t");
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);

	mm.do_start();
	TRACE_REQUIRE_EQUAL(mm.Running(), true);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TLOG_DEBUG("MetricManager_t") << "END TEST Initialize_WithError" << TLOG_ENDL;
}

BOOST_AUTO_TEST_CASE(Shutdown)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST Shutdown" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);

	std::string testConfig = "msgFac: { level: 5 metricPluginType: test reporting_interval: 1.0}";
	fhicl::ParameterSet pset = fhicl::ParameterSet::make(testConfig);

	mm.initialize(pset, "MetricManager_t");
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);

	mm.do_start();
	TRACE_REQUIRE_EQUAL(mm.Running(), true);
	TRACE_REQUIRE_EQUAL(mm.Active(), true);

	mm.do_stop();
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);

	mm.shutdown();
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TLOG_DEBUG("MetricManager_t") << "END TEST Shutdown" << TLOG_ENDL;
}

BOOST_AUTO_TEST_CASE(SendMetric_String)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST SendMetric_String" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);

	std::string testConfig = "msgFac: { level: 5 metricPluginType: test reporting_interval: 1.0}";
	fhicl::ParameterSet pset = fhicl::ParameterSet::make(testConfig);

	mm.initialize(pset, "MetricManager_t");
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);

	mm.do_start();
	TRACE_REQUIRE_EQUAL(mm.Running(), true);
	TRACE_REQUIRE_EQUAL(mm.Active(), true);

	mm.sendMetric("Test Metric", "This is a test", "Units", 2, artdaq::MetricMode::LastPoint);

	mm.do_stop();
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);

	mm.shutdown();
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TLOG_DEBUG("MetricManager_t") << "END TEST SendMetric_String" << TLOG_ENDL;
}

BOOST_AUTO_TEST_CASE(SendMetrics)  // NOLINT(readability-function-size)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST SendMetrics" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);

	std::string testConfig = "msgFac: { level: 5 metricPluginType: test reporting_interval: 0.5 send_zeros: false} metric_send_maximum_delay_ms: 100 metric_holdoff_us: 10000";
	fhicl::ParameterSet pset = fhicl::ParameterSet::make(testConfig);

	mm.initialize(pset, "MetricManager_t");
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);

	mm.do_start();
	TRACE_REQUIRE_EQUAL(mm.Running(), true);
	TRACE_REQUIRE_EQUAL(mm.Active(), true);

	mm.sendMetric("Test Metric LastPoint", 1, "Units", 2, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric LastPoint", 5, "Units", 2, artdaq::MetricMode::LastPoint, "", true);
	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	{
		artdaq::TestMetric::LockReceivedMetricMutex();
		bool present = false;
		for (auto& point : artdaq::TestMetric::received_metrics)
		{
			TLOG(TLVL_DEBUG) << "Metric: " << point.metric << ", Value: " << point.value << ", Units: " << point.unit;
			if (point.metric == "Test Metric LastPoint")
			{
				TRACE_REQUIRE_EQUAL(point.value, "5");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				present = true;
			}
		}
		BOOST_REQUIRE(present);
		artdaq::TestMetric::received_metrics.clear();
		artdaq::TestMetric::UnlockReceivedMetricMutex();
	}

	mm.sendMetric("Test Metric Accumulate", 4, "Units", 2, artdaq::MetricMode::Accumulate, "", true);
	mm.sendMetric("Test Metric Accumulate", 5, "Units", 2, artdaq::MetricMode::Accumulate, "", true);
	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	{
		artdaq::TestMetric::LockReceivedMetricMutex();
		bool present = false;
		for (auto& point : artdaq::TestMetric::received_metrics)
		{
			if (point.metric == "Test Metric Accumulate")
			{
				TRACE_REQUIRE_EQUAL(point.value, "9");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				present = true;
			}
		}
		BOOST_REQUIRE(present);
		artdaq::TestMetric::received_metrics.clear();
		artdaq::TestMetric::UnlockReceivedMetricMutex();
	}

	mm.sendMetric("Test Metric Average", 1, "Units", 2, artdaq::MetricMode::Average, "", true);
	mm.sendMetric("Test Metric Average", 3, "Units", 2, artdaq::MetricMode::Average, "", true);
	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	{
		artdaq::TestMetric::LockReceivedMetricMutex();
		bool present = false;
		for (auto& point : artdaq::TestMetric::received_metrics)
		{
			if (point.metric == "Test Metric Average")
			{
				TRACE_REQUIRE_EQUAL(std::stof(point.value), 2);
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				present = true;
			}
		}
		BOOST_REQUIRE(present);
		artdaq::TestMetric::received_metrics.clear();
		artdaq::TestMetric::UnlockReceivedMetricMutex();
	}

	mm.sendMetric("Test Metric Rate", 4, "Units", 2, artdaq::MetricMode::Rate, "", true);
	mm.sendMetric("Test Metric Rate", 5, "Units", 2, artdaq::MetricMode::Rate, "", true);
	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	{
		artdaq::TestMetric::LockReceivedMetricMutex();
		bool present = false;
		for (auto& point : artdaq::TestMetric::received_metrics)
		{
			if (point.metric == "Test Metric Rate")
			{
				TRACE_REQUIRE_EQUAL(point.unit, "Units/s");
				present = true;
			}
		}
		BOOST_REQUIRE(present);
		artdaq::TestMetric::received_metrics.clear();
		artdaq::TestMetric::UnlockReceivedMetricMutex();
	}

	mm.sendMetric("Test Metric AccumulateAndRate", 4, "Units", 2, artdaq::MetricMode::Accumulate | artdaq::MetricMode::Rate, "", true);
	mm.sendMetric("Test Metric AccumulateAndRate", 5, "Units", 2, artdaq::MetricMode::Accumulate | artdaq::MetricMode::Rate, "", true);
	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	{
		artdaq::TestMetric::LockReceivedMetricMutex();
		int present = 0;
		for (auto& point : artdaq::TestMetric::received_metrics)
		{
			if (point.metric == "Test Metric AccumulateAndRate - Total")
			{
				TRACE_REQUIRE_EQUAL(point.value, "9");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				present++;
			}
			if (point.metric == "Test Metric AccumulateAndRate - Rate")
			{
				TRACE_REQUIRE_EQUAL(point.unit, "Units/s");
				present++;
			}
		}
		TRACE_REQUIRE_EQUAL(present, 2);
		artdaq::TestMetric::received_metrics.clear();
		artdaq::TestMetric::UnlockReceivedMetricMutex();
	}

	mm.do_stop();
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);

	mm.shutdown();
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TLOG_DEBUG("MetricManager_t") << "END TEST SendMetrics" << TLOG_ENDL;
}

BOOST_AUTO_TEST_CASE(SendMetrics_Levels)  // NOLINT(readability-function-size)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST SendMetrics_Levels" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);

	std::string testConfig = "msgFac: { level: 0 metric_levels: [ 1, 2 ] level_string: \"3-5,9,7\" metricPluginType: test reporting_interval: 0.1 send_zeros: false} metric_send_maximum_delay_ms: 100";
	fhicl::ParameterSet pset = fhicl::ParameterSet::make(testConfig);

	mm.initialize(pset, "MetricManager_t");
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);

	mm.do_start();
	TRACE_REQUIRE_EQUAL(mm.Running(), true);
	TRACE_REQUIRE_EQUAL(mm.Active(), true);

	mm.sendMetric("Test Metric 0", 0, "Units", 0, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 1", 1, "Units", 1, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 2", 2, "Units", 2, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 3", 3, "Units", 3, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 4", 4, "Units", 4, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 5", 5, "Units", 5, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 6", 6, "Units", 6, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 7", 7, "Units", 7, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 8", 8, "Units", 8, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 9", 9, "Units", 9, artdaq::MetricMode::LastPoint, "", true);
	mm.sendMetric("Test Metric 10", 10, "Units", 10, artdaq::MetricMode::LastPoint, "", true);
	std::bitset<11> received_metrics_;

	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	{
		artdaq::TestMetric::LockReceivedMetricMutex();
		for (auto& point : artdaq::TestMetric::received_metrics)
		{
			if (point.metric == "Test Metric 0")
			{
				TRACE_REQUIRE_EQUAL(point.value, "0");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[0] = true;
			}
			if (point.metric == "Test Metric 1")
			{
				TRACE_REQUIRE_EQUAL(point.value, "1");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[1] = true;
			}
			if (point.metric == "Test Metric 2")
			{
				TRACE_REQUIRE_EQUAL(point.value, "2");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[2] = true;
			}
			if (point.metric == "Test Metric 3")
			{
				TRACE_REQUIRE_EQUAL(point.value, "3");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[3] = true;
			}
			if (point.metric == "Test Metric 4")
			{
				TRACE_REQUIRE_EQUAL(point.value, "4");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[4] = true;
			}
			if (point.metric == "Test Metric 5")
			{
				TRACE_REQUIRE_EQUAL(point.value, "5");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[5] = true;
			}
			if (point.metric == "Test Metric 6")
			{
				BOOST_TEST_FAIL("Metric level 6 should not have been sent!");
				received_metrics_[6] = true;
			}
			if (point.metric == "Test Metric 7")
			{
				TRACE_REQUIRE_EQUAL(point.value, "7");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[7] = true;
			}
			if (point.metric == "Test Metric 8")
			{
				BOOST_TEST_FAIL("Metric level 8 should not have been sent!");
				received_metrics_[8] = true;
			}
			if (point.metric == "Test Metric 9")
			{
				TRACE_REQUIRE_EQUAL(point.value, "9");
				TRACE_REQUIRE_EQUAL(point.unit, "Units");
				received_metrics_[9] = true;
			}
			if (point.metric == "Test Metric 10")
			{
				BOOST_TEST_FAIL("Metric level 10 should not have been sent!");
				received_metrics_[10] = true;
			}
		}
		TRACE_REQUIRE_EQUAL(received_metrics_.to_ulong(), 0x2BF);
		artdaq::TestMetric::received_metrics.clear();
		artdaq::TestMetric::UnlockReceivedMetricMutex();
	}

	mm.do_stop();
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);

	mm.shutdown();
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TLOG_DEBUG("MetricManager_t") << "END TEST SendMetrics_Levels" << TLOG_ENDL;
}

BOOST_AUTO_TEST_CASE(MetricFlood)  // NOLINT(readability-function-size)
{
	TLOG_DEBUG("MetricManager_t") << "BEGIN TEST MetricFlood" << TLOG_ENDL;
	artdaq::MetricManager mm;
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);
	TRACE_REQUIRE_EQUAL(mm.metricQueueEmpty(), true);
	TRACE_REQUIRE_EQUAL(mm.metricQueueSize(), 0);

	std::string testConfig = "msgFac: { level: 5 metricPluginType: test reporting_interval: 0.1 send_zeros: false}  metric_send_maximum_delay_ms: 100";
	fhicl::ParameterSet pset = fhicl::ParameterSet::make(testConfig);

	mm.initialize(pset, "MetricManager_t");
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Active(), false);

	mm.do_start();
	TRACE_REQUIRE_EQUAL(mm.Running(), true);
	TRACE_REQUIRE_EQUAL(mm.Active(), true);

	auto beforeOne = std::chrono::steady_clock::now();
	mm.sendMetric("Test Metric 1", 1, "Units", 2, artdaq::MetricMode::Accumulate, "", true);
	auto afterOne = std::chrono::steady_clock::now();

	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	auto beforeTen = std::chrono::steady_clock::now();
	for (auto ii = 1; ii <= 10; ++ii)
	{
		mm.sendMetric("Test Metric 10", ii, "Units", 2, artdaq::MetricMode::Accumulate, "", true);
	}
	auto afterTen = std::chrono::steady_clock::now();

	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	auto beforeOneHundred = std::chrono::steady_clock::now();
	for (auto ii = 1; ii <= 100; ++ii)
	{
		mm.sendMetric("Test Metric 100", ii, "Units", 2, artdaq::MetricMode::Accumulate, "", true);
	}
	auto afterOneHundred = std::chrono::steady_clock::now();

	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	auto beforeOneThousand = std::chrono::steady_clock::now();
	for (auto ii = 1; ii <= 1000; ++ii)
	{
		mm.sendMetric("Test Metric 1000", ii, "Units", 2, artdaq::MetricMode::Accumulate, "", true);
	}
	auto afterOneThousand = std::chrono::steady_clock::now();

	while (mm.metricManagerBusy())
	{
		usleep(1000);
	}

	auto beforeTenThousand = std::chrono::steady_clock::now();
	for (auto ii = 1; ii <= 10000; ++ii)
	{
		mm.sendMetric("Test Metric 10000", ii, "Units", 2, artdaq::MetricMode::Accumulate, "", true);
	}
	auto afterTenThousand = std::chrono::steady_clock::now();

	auto beforeStop = std::chrono::steady_clock::now();
	mm.do_stop();
	TRACE_REQUIRE_EQUAL(mm.Running(), false);
	TRACE_REQUIRE_EQUAL(mm.Initialized(), true);
	auto afterStop = std::chrono::steady_clock::now();

	TLOG_INFO("MetricManager_t") << "Time for One Metric: " << GetElapsedTime(beforeOne, afterOne) << " s." << TLOG_ENDL;
	TLOG_INFO("MetricManager_t") << "Time for Ten Metrics: " << GetElapsedTime(beforeTen, afterTen) << " s." << TLOG_ENDL;
	TLOG_INFO("MetricManager_t") << "Time for One Hundred Metrics: " << GetElapsedTime(beforeOneHundred, afterOneHundred)
	                             << " s." << TLOG_ENDL;
	TLOG_INFO("MetricManager_t") << "Time for One Thousand Metrics: "
	                             << GetElapsedTime(beforeOneThousand, afterOneThousand) << " s." << TLOG_ENDL;
	TLOG_INFO("MetricManager_t") << "Time for Ten Thousand Metrics: "
	                             << GetElapsedTime(beforeTenThousand, afterTenThousand) << " s." << TLOG_ENDL;
	TLOG_INFO("MetricManager_t") << "Time for Stop Metrics: " << GetElapsedTime(beforeStop, afterStop) << " s."
	                             << TLOG_ENDL;

	mm.shutdown();
	TRACE_REQUIRE_EQUAL(mm.Initialized(), false);
	TLOG_DEBUG("MetricManager_t") << "END TEST MetricFlood" << TLOG_ENDL;
}

BOOST_AUTO_TEST_SUITE_END()
