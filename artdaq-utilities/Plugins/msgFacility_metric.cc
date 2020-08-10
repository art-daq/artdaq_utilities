// msgFacility_metric.cc: Message Facility Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 09/29/2015
//
// An implementation of the MetricPlugin for Message Facility

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <algorithm>
#include <iostream>
#include <string>

namespace artdaq {
/**
	 * \brief A MetricPlugin class which sends metric data to MessageFacility
	 */
class MsgFacilityMetric final : public MetricPlugin
{
private:
	std::string facility_;
	int outputLevel_;

	MsgFacilityMetric(const MsgFacilityMetric&) = delete;
	MsgFacilityMetric(MsgFacilityMetric&&) = delete;
	MsgFacilityMetric& operator=(const MsgFacilityMetric&) = delete;
	MsgFacilityMetric& operator=(MsgFacilityMetric&&) = delete;

public:
	/**
		 * \brief MsgFacilityMetric Constructor
		 * \param config ParameterSet used to configure MsgFacilityMetric
		 * \param app_name Name of the application sending metrics
		 * 
		 * \verbatim
		  MsgFacilityMetric accepts the following Parameters:
		  "output_message_category_name" (Default: "ARTDAQ Metric"): Name of the "category" (for filtering) in MessageFacility
		  "output_message_severity" (Default: 0): Severity which messages should be sent with. This parameter may also be specified using
		  the string name of the severity.
		  0: Info, 1: Debug, 2: Warning, 3: Error
		\endverbatim
		 */
	explicit MsgFacilityMetric(fhicl::ParameterSet const& config, std::string const& app_name)
	    : MetricPlugin(config, app_name)
	    , facility_(config.get<std::string>("output_message_category_name", "ARTDAQ Metric"))
	    , outputLevel_(0)
	{
		try
		{
			outputLevel_ = config.get<int>("output_message_severity", 0);
		}
		catch (const cet::exception&)
		{
			auto levelString = config.get<std::string>("output_message_severity", "Info");
			if (levelString == "Info" || levelString == "info" || levelString == "LogInfo")
			{
				outputLevel_ = 0;
			}
			else if (levelString == "Debug" || levelString == "debug" || levelString == "LogDebug")
			{
				outputLevel_ = 1;
			}
			else if (levelString == "Warning" || levelString == "warning" || levelString == "LogWarning" || levelString == "Warn" || levelString == "warn")
			{
				outputLevel_ = 2;
			}
			else if (levelString == "Error" || levelString == "error" || levelString == "LogError")
			{
				outputLevel_ = 3;
			}
		}
		startMetrics();
	}

	/**
		 * \brief MsgFacilityMetric Destructor. Calls stopMetrics()
		 */
	~MsgFacilityMetric() override { stopMetrics(); }
	/**
		 * \brief Return the library name of the MetricPlugin
		 * \return The library name of MsgFacilityMetric: "msgFacility"
		 */
	std::string getLibName() const override { return "msgFacility"; }

	/**
		 * \brief Send a metric to MessageFacilty. Format is: "name: value unit."
		 * \param name Name of the metric
		 * \param value Value of the metric
		 * \param unit Units for the metric
		 */
	void sendMetric_(const std::string& name, const std::string& value, const std::string& unit) override
	{
		if (!inhibit_)
		{
			switch (outputLevel_)
			{
				case 0:
					mf::LogInfo(facility_) << name << ": " << value << " " << unit << "." << std::endl;
					break;
				case 1:
					mf::LogDebug(facility_) << name << ": " << value << " " << unit << "." << std::endl;
					break;
				case 2:
					mf::LogWarning(facility_) << name << ": " << value << " " << unit << "." << std::endl;
					break;
				case 3:
					mf::LogError(facility_) << name << ": " << value << " " << unit << "." << std::endl;
					break;
			}
		}
	}

	/**
		* \brief Send a metric to MessageFacility. All metrics are converted to strings.
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
	void sendMetric_(const std::string& name, const int& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
	}

	/**
		* \brief Send a metric to MessageFacility. All metrics are converted to strings.
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
	void sendMetric_(const std::string& name, const double& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
	}

	/**
		* \brief Send a metric to MessageFacility. All metrics are converted to strings.
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
	void sendMetric_(const std::string& name, const float& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
	}

	/**
		 * \brief Send a metric to MessageFacility. All metrics are converted to strings.
		 * \param name Name of the metric
		 * \param value Value of the metric
		 * \param unit Units of the metric
		 */
	void sendMetric_(const std::string& name, const uint64_t& value, const std::string& unit) override
	{
		sendMetric_(name, std::to_string(value), unit);
	}

	/**
		 * \brief Perform startup actions. No-Op.
		 */
	void startMetrics_() override {}
	/**
		 * \brief Perform shutdown actions. No-Op.
		 */
	void stopMetrics_() override {}
};
}  //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::MsgFacilityMetric)
