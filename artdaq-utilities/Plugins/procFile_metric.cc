// graphite_metric.cc: ProcFile Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 11/13/2014
//
// An implementation of the MetricPlugin for Graphite

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"
#define TRACE_NAME "procFile_metric"
#include "trace.h"

#include <sys/stat.h>			// mkfifo
#include <fcntl.h>				// open
#include <stdlib.h>				// exit
#include <iostream>
#include <ctime>
#include <string>
#include <thread>

namespace artdaq
{
	class ProcFileMetric : public MetricPlugin
	{
	private:
		std::string pipe_;
		std::string name_;
		bool stopped_;
		unsigned long int value_;
		std::thread thread_;
	public:
		ProcFileMetric(fhicl::ParameterSet config) : MetricPlugin(config)
		                                           , pipe_(pset.get<std::string>("pipe", "/tmp/eventQueueStat"))
												   , name_(pset.get<std::string>("name", "bytesRead"))
		                                           , stopped_(true)
												   , value_(0)
		{
			int sts=mkfifo( pipe_.c_str(), 0777 );
			if (sts!=0) { perror("ProcFileMetric mkfifo"); exit(1); }
			TRACE( 10, "ProcFileMetric mkfifo("+name_+") sts=%d",sts );
			startMetrics();
		}

		~ProcFileMetric() {
			stopMetrics(); unlink( pipe_.c_str() );
			TRACE( 10, "~ProcFileMetric unlinked "+pipe_ );
		}
		virtual std::string getLibName() const { return "procFile"; }

		virtual void sendMetric_(const std::string&, const std::string&, const std::string&)
		{
		}

		virtual void sendMetric_(const std::string&, const int&, const std::string&)
		{
		}

		virtual void sendMetric_(const std::string&, const double&, const std::string&)
		{
		}

		virtual void sendMetric_(const std::string&, const float&, const std::string&)
		{
		}

		virtual void sendMetric_(const std::string& name, const unsigned long int& value, const std::string& unit __attribute__((unused)))
		{
			if (name == name_) {
				TRACE( 11, "sendMetric_ setting value=%lu", value );
				value_ = value;
			}
		}

		virtual void startMetrics_()
		{
			if (stopped_)
			{
				// start thread
                stopped_ = false;
				thread_ = std::thread(&ProcFileMetric::writePipe, this);
			}
		}

		virtual void stopMetrics_()
		{
			if (!stopped_)
			{
				stopped_ = true;
				// do read on pipe to make sure writePipe is not blocking on open
				int fd = open( pipe_.c_str(), O_RDONLY );
				if (fd == -1) { perror("stopMetrics_ open(\"r\")"); exit(1); }
				char buf[256];
				read( fd, buf, sizeof(buf) );
				close(fd);
                if(thread_.joinable()) thread_.join();
			}
		}
 
        void writePipe()
        {   char buf[256];
            while(!stopped_)
			{
                int fd = open( pipe_.c_str(), O_WRONLY );
				snprintf(buf,sizeof(buf),"%s: %lu\n", name_.c_str(),value_);
				TRACE( 10, "writePipe value=%lu", value_ );
				write(fd, buf, strnlen(buf,sizeof(buf)) );
				close(fd);
				usleep(400000);	// must wait to make sure other end closes
			}
   
		}
	};
} //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::ProcFileMetric)
