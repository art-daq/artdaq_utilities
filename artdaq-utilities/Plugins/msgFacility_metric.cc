// msgFacility_metric.cc: Message Facility Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 09/29/2015
//
// An implementation of the MetricPlugin for Message Facility

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <iostream>
#include <string>
#include <algorithm>

namespace artdaq {
class MsgFacilityMetric : public MetricPlugin
{
private:
	std::string facility_;
	int outputLevel_;
public:
	MsgFacilityMetric(fhicl::ParameterSet config)
		: MetricPlugin(config)
		, facility_(config.get<std::string>("output_message_application_name", "ARTDAQ Metric"))
        , outputLevel_(0)
	{
	  try{
		outputLevel_ = config.get<int>("output_message_severity", 0);
		  }
      catch(cet::exception)
		{
		  std::string levelString = config.get<std::string>("output_message_severity", "Info");
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
	~MsgFacilityMetric() { stopMetrics(); }
	virtual std::string getLibName() { return "msgFacility"; }

	virtual void sendMetric_(std::string name, std::string value, std::string unit)
	{
		switch (outputLevel_)
		{
        case 0:
		  mf::LogInfo(facility_) << name << ": " << value << " " << unit << "." << std::endl;
		  break;
		case 1:
			mf::LogDebug(facility_)<< name << ": " << value << " " << unit << "." << std::endl;
			break;
		case 2:
			mf::LogWarning(facility_)<< name << ": " << value << " " << unit << "." << std::endl;
			break;
		case 3:
			mf::LogError(facility_)<< name << ": " << value << " " << unit << "." << std::endl;
			break;
		}
	}
	virtual void sendMetric_(std::string name, int value, std::string unit)
	{
		sendMetric(name, std::to_string(value), unit);
	}
	virtual void sendMetric_(std::string name, double value, std::string unit)
	{
		sendMetric(name, std::to_string(value), unit);
	}
	virtual void sendMetric_(std::string name, float value, std::string unit)
	{
		sendMetric(name, std::to_string(value), unit);
	}
	virtual void sendMetric_(std::string name, unsigned long int value, std::string unit)
	{
		sendMetric(name, std::to_string(value), unit);
	}
	virtual void startMetrics_()
	{}
	virtual void stopMetrics_()
	{}
};
} //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::MsgFacilityMetric)

