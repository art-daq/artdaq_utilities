//ganglia_metric.cc: Ganglia Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 11/14/2014
//
// An implementation of the MetricPlugin interface for Ganglia

#ifndef __GANGLIA_METRIC__
#define __GANGLIA_METRIC__ 1

#include "artdaq/Plugins/MetricMacros.hh"
#include "messagefacility/MessageLogger/MessageLogger.h"
#include "send_gmetric.h"
#include <sys/times.h>
#include <unordered_map>

namespace artdaq {

  class GangliaMetric : public MetricPlugin {
  private:
    std::string configFile_;
    std::string group_;
    std::string cluster_;
    bool makeRateMetrics_;
    std::unordered_map<std::string, std::vector<double> >   doubleAccumulator_;
    std::unordered_map<std::string, std::vector<int> >      intAccumulator_;
    std::unordered_map<std::string, std::vector<float> >    floatAccumulator_;
    std::unordered_map<std::string, std::vector<uint32_t> > uintAccumulator_;
    std::unordered_map<std::string, clock_t> lastSendTime_;
    double _timeSinceLastSend(clock_t& currenttime, std::string name )
    {
      struct tms ctime;
      currenttime = times(&ctime);
      double deltaw = ((double)(currenttime - lastSendTime_[name]))*10000./CLOCKS_PER_SEC;
      return deltaw;
    }
  public:
    GangliaMetric(fhicl::ParameterSet pset) : MetricPlugin(pset),
					configFile_(pset.get<std::string>("configFile","/etc/ganglia/gmond.conf")),
						    group_(pset.get<std::string>("group","ARTDAQ")),
					      cluster_(pset.get<std::string>("cluster", "")),
                                              makeRateMetrics_(pset.get<bool>("reportRate",false))
    {
    }

    virtual ~GangliaMetric()
    {
      stopMetrics();
    }

    virtual std::string getLibName() { return "ganglia"; }
    virtual void stopMetrics()
    {
      for(auto dv : doubleAccumulator_)
      {
        static_cast<std::vector<double>>(dv.second).clear();
        lastSendTime_[dv.first] = CLOCKS_PER_SEC * 20;
        sendMetric(dv.first,0,"");
      }
      for(auto iv : intAccumulator_)
      {
        static_cast<std::vector<int>>(iv.second).clear();
        lastSendTime_[iv.first] = CLOCKS_PER_SEC * 20;
        sendMetric(iv.first,0,"");
      }
      for(auto fv : floatAccumulator_)
      {
        static_cast<std::vector<float>>(fv.second).clear();
        lastSendTime_[fv.first] = CLOCKS_PER_SEC * 20;
        sendMetric(fv.first,0,"");
      }
      for(auto uv : uintAccumulator_)
      {
        static_cast<std::vector<uint32_t>>(uv.second).clear();
        lastSendTime_[uv.first] = CLOCKS_PER_SEC * 20;
        sendMetric(uv.first,0,"");
      }
    }
    virtual void startMetrics()
    {
    }

    virtual void sendMetric(std::string name, std::string value, std::string unit ) 
    {
      //mf::LogInfo("GangliaMetric") << "Sending string value to Ganglia: " << value;
      send_gmetric(configFile_.c_str(),name.c_str(),value.c_str(),"string",
		   unit.c_str(),"both",15,0,group_.c_str(),cluster_.c_str(),"","");
    }
    virtual void sendMetric(std::string name, int value, std::string unit ) 
    {
      intAccumulator_[name].push_back(value);

      clock_t thisSendTime = 0;
      double deltaT = _timeSinceLastSend(thisSendTime, name);
      if(deltaT >= 15)
	{
	  double sendValue = 0;
          double accumValue = 0;
	  for(auto val : intAccumulator_[name])
	  {
            accumValue += val;
            sendValue += val / (double)intAccumulator_[name].size();
	  }

          //mf::LogInfo("GangliaMetric") << "Sending int value to Ganglia: " << sendValue;
          send_gmetric(configFile_.c_str(),name.c_str(), std::to_string(sendValue).c_str(),
                       "double", unit.c_str(), "both", 15,0,group_.c_str(),cluster_.c_str(),"","");
          if(makeRateMetrics_)
    	  {
            send_gmetric(configFile_.c_str(),(name + "_RATE").c_str(), std::to_string(accumValue / deltaT).c_str(),
		       "double", (unit + "/s").c_str(), "both", 15, 0, group_.c_str(), cluster_.c_str(), "",("Rate of " + name).c_str());
	  }

          intAccumulator_[name].clear();
          lastSendTime_[name] = thisSendTime;
      }
    }
    virtual void sendMetric(std::string name, double value, std::string unit ) 
    { 
      doubleAccumulator_[name].push_back(value);

      clock_t thisSendTime = 0;
      double deltaT = _timeSinceLastSend(thisSendTime, name);
      if(deltaT >= 15)
	{
	  double sendValue = 0;
          double accumValue = 0;
	  for(auto val : doubleAccumulator_[name])
	  {
            accumValue += val;
            sendValue += val / doubleAccumulator_[name].size();
	  }
	  
          //mf::LogInfo("GangliaMetric") << "Sending double value to Ganglia: " << sendValue;
          send_gmetric(configFile_.c_str(),name.c_str(), std::to_string(sendValue).c_str(),
                       "double", unit.c_str(), "both", 15,0,group_.c_str(),cluster_.c_str(),"","");
          if(makeRateMetrics_)
    	  {
            send_gmetric(configFile_.c_str(),(name + "_RATE").c_str(), std::to_string(accumValue / deltaT).c_str(),
		       "double", (unit + "/s").c_str(), "both", 15, 0, group_.c_str(), cluster_.c_str(), "",("Rate of " + name).c_str());
	  }

          doubleAccumulator_[name].clear();
          lastSendTime_[name] = thisSendTime;
      }
    }
    virtual void sendMetric(std::string name, float value, std::string unit ) 
    {
      floatAccumulator_[name].push_back(value);

      clock_t thisSendTime = 0;
      double deltaT = _timeSinceLastSend(thisSendTime, name);
      if(deltaT >= 15)
	{
	  float sendValue = 0;
          float accumValue = 0;
	  for(auto val : floatAccumulator_[name])
	  {
            accumValue += val;
            sendValue += val / floatAccumulator_[name].size();
	  }
	  
          //mf::LogInfo("GangliaMetric") << "Sending float value to Ganglia: " << sendValue;
          send_gmetric(configFile_.c_str(),name.c_str(), std::to_string(sendValue).c_str(),
                       "float", unit.c_str(), "both", 15,0,group_.c_str(),cluster_.c_str(),"","");
          if(makeRateMetrics_)
    	  {
            send_gmetric(configFile_.c_str(),(name + "_RATE").c_str(), std::to_string(accumValue / deltaT).c_str(),
		       "double", (unit + "/s").c_str(), "both", 15, 0, group_.c_str(), cluster_.c_str(), "",("Rate of " + name).c_str());
	  }

          floatAccumulator_[name].clear();
          lastSendTime_[name] = thisSendTime;
      }
    }
    virtual void sendMetric(std::string name, unsigned long int value, std::string unit ) 
    { 
      uint32_t uvalue = static_cast<uint32_t>(value);
      uintAccumulator_[name].push_back(uvalue);

      clock_t thisSendTime = 0;
      double deltaT = _timeSinceLastSend(thisSendTime, name);
      if(deltaT >= 15)
	{
	  double sendValue = 0;
          double accumValue = 0;
	  for(auto val : uintAccumulator_[name])
	  {
            accumValue += val;
            sendValue += val / (double)uintAccumulator_[name].size();
	  }
	  
          //mf::LogInfo("GangliaMetric") << "Sending uint uvalue to Ganglia: " << sendValue;
          send_gmetric(configFile_.c_str(),name.c_str(), std::to_string(sendValue).c_str(),
                       "double", unit.c_str(), "both", 15,0,group_.c_str(),cluster_.c_str(),"","");
          if(makeRateMetrics_)
    	  {
            send_gmetric(configFile_.c_str(),(name + "_RATE").c_str(), std::to_string(accumValue / deltaT).c_str(),
		       "double", (unit + "/s").c_str(), "both", 15, 0, group_.c_str(), cluster_.c_str(), "",("Rate of " + name).c_str());
	  }

          uintAccumulator_[name].clear();
          lastSendTime_[name] = thisSendTime;
      }}
  };
} //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::GangliaMetric)

#endif //End ifndef __GANGLIA_METRIC__
