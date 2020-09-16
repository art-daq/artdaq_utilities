// report_metric.cc: Periodic Report Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 11/06/2014
//
// An implementation of the MetricPlugin for creating "Periodic Report" messages

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"

#include <sys/types.h>
#include <unistd.h>
#include <ctime>
#include <fstream>
#include <mutex>
#include <sstream>
#include <string>
#include "tracemf.h"

namespace artdaq {
/**
	 * \brief PeriodicReportMetric writes metric data to a file on disk
	 */
class PeriodicReportMetric final : public MetricPlugin
{
private:
	std::chrono::steady_clock::time_point last_report_time_;

	std::map<std::string, std::string> metrics_;

	std::mutex report_mutex_;

public:
	/**
		 * \brief PeriodicReportMetric Constructor.
		 * \param config ParameterSet used to configure PeriodicReportMetric
		 * \param app_name Name of the application sending metrics
		 * 
		 * \verbatim
		 * PeriodicReportMetric accepts no parameters.
		 * \endverbatim
		 */
	explicit PeriodicReportMetric(fhicl::ParameterSet const& config, std::string const& app_name)
	    : MetricPlugin(config, app_name)
	    , last_report_time_(std::chrono::steady_clock::now())

	{
		startMetrics();
	}

	/**
		 * \brief PeriodicReportMetric Destructor. Calls stopMetrics and then closes the file
		 */
	~PeriodicReportMetric() override
	{
		stopMetrics();
	}

	/**
		* \brief Get the library name for the PeriodicReport metric
		* \return The library name for the PeriodicReport metric, "report"
		*/
	std::string getLibName() const override { return "report"; }

	/**
		* \brief Write metric data to a file
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*
		* Not using the time field, as the report will have its own timestamp from TRACE
		*/
	void sendMetric_(const std::string& name, const std::string& value, const std::string& unit, const std::chrono::system_clock::time_point&) override
	{
		if (!inhibit_)
		{
			metrics_[name] = value + " " + unit;
			writeReportMessage_(false);
		}
	}

	/**
	   * \brief Write metric data to a file
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
		* \brief Write metric data to a file
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
		* \brief Write metric data to a file
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
		 * \brief Write metric data to a file
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
		writeReportMessage_(true);
		metrics_.clear();
	}

private:
	PeriodicReportMetric(const PeriodicReportMetric&) = delete;
	PeriodicReportMetric(PeriodicReportMetric&&) = delete;
	PeriodicReportMetric& operator=(const PeriodicReportMetric&) = delete;
	PeriodicReportMetric& operator=(PeriodicReportMetric&&) = delete;

	void writeReportMessage_(bool force)
	{
		std::unique_lock<std::mutex> lk(report_mutex_);
		if (force || std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(std::chrono::steady_clock::now() - last_report_time_).count() >= accumulationTime_)
		{
			if (metrics_.empty())
			{
				return;
			}
			last_report_time_ = std::chrono::steady_clock::now();
			std::ostringstream str;

			int count = 0;
			int live_metrics = 0;
			for (auto& metric : metrics_)
			{
				if (count != 0)
				{
					str << "," << std::endl;
				}
				str << "\t" << metric.first << ": " << metric.second;
				if (metric.second != "NOT REPORTED")
				{
					live_metrics++;
				}
				metric.second = "NOT REPORTED";
				count++;
			}
			if (live_metrics > 0)
			{
				TLOG_INFO(app_name_) << "Periodic report: " << live_metrics << " active metrics:" << std::endl
				                     << str.str();
			}
			else
			{
				TLOG_INFO(app_name_) << "Periodic report: No active metrics in last reporting interval!";
			}
		}
	}
};
}  //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::PeriodicReportMetric)
