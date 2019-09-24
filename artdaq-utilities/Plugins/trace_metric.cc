// trace_metric.cc: TRACE Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 9/06/2018
//
// An implementation of the MetricPlugin for TRACE

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "trace.h"

namespace artdaq {
/**
	 * \brief TRACEMetric writes metric data to a file on disk
	 */
class TRACEMetric : public MetricPlugin
{
private:
	bool stopped_;
	std::string name_;
	int lvl_;

public:
	/**
		 * \brief TRACEMetric Constructor. Opens the file and starts the metric
		 * \param config ParameterSet used to configure TRACEMetric
		 * \param app_name Name of the application sending metrics
		 *
		 * \verbatim
		 * TRACEMetric accepts the following Parameters:
		 * "trace_name" (Default: app_name + "_TRACEMetric"): Name to use for TRACEs
		 * "trace_level" (Default: TLVL_TRACE): Level to use for metric TRACEs
		 * \endverbatim
		 */
	explicit TRACEMetric(fhicl::ParameterSet const& config, std::string const& app_name)
	    : MetricPlugin(config, app_name)
	    , stopped_(true)
	    , name_(config.get<std::string>("trace_name", app_name + "_TRACEMetric"))
	    , lvl_(config.get<int>("trace_level", TLVL_TRACE))
	{
		startMetrics();
	}

	/**
		 * \brief TRACEMetric Destructor. Calls stopMetrics and then closes the file
		 */
	virtual ~TRACEMetric()
	{
		stopMetrics();
	}

	/**
		* \brief Get the library name for the TRACE metric
		* \return The library name for the TRACE metric, "trace"
		*/
	std::string getLibName() const override { return "trace"; }

	/**
		* \brief Write metric data to a file
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
	void sendMetric_(const std::string& name, const std::string& value, const std::string& unit) override
	{
		if (!stopped_ && !inhibit_)
		{
			TLOG(lvl_, name_) << "TRACEMetric: " << name << ": " << value << " " << unit << ".";
		}
	}

	/**
		* \brief Write metric data to a file
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
	void sendMetric_(const std::string& name, const int& value, const std::string& unit) override
	{
		if (!stopped_ && !inhibit_)
		{
			TLOG(lvl_, name_) << "TRACEMetric: " << name << ": " << value << " " << unit << ".";
		}
	}

	/**
		* \brief Write metric data to a file
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
	void sendMetric_(const std::string& name, const double& value, const std::string& unit) override
	{
		if (!stopped_ && !inhibit_)
		{
			TLOG(lvl_, name_) << "TRACEMetric: " << name << ": " << value << " " << unit << ".";
		}
	}

	/**
		* \brief Write metric data to a file
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
	void sendMetric_(const std::string& name, const float& value, const std::string& unit) override
	{
		if (!stopped_ && !inhibit_)
		{
			TLOG(lvl_, name_) << "TRACEMetric: " << name << ": " << value << " " << unit << ".";
		}
	}

	/**
		 * \brief Write metric data to a file
		 * \param name Name of the metric
		 * \param value Value of the metric
		 * \param unit Units of the metric
		 */
	void sendMetric_(const std::string& name, const unsigned long int& value, const std::string& unit) override
	{
		if (!stopped_ && !inhibit_)
		{
			TLOG(lvl_, name_) << "TRACEMetric: " << name << ": " << value << " " << unit << ".";
		}
	}

	/**
		 * \brief Perform startup actions. Writes start message to output file.
		 */
	void startMetrics_() override
	{
		stopped_ = false;
		TLOG(TLVL_INFO, name_) << "TRACE Metric Plugin started";
	}

	/**
		 * \brief Perform shutdown actions. Writes stop message to output file.
		 */
	void stopMetrics_() override
	{
		stopped_ = true;
		TLOG(TLVL_INFO, name_) << "TRACE Metric Plugin stopped";
	}

private:
};
}  //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::TRACEMetric)
