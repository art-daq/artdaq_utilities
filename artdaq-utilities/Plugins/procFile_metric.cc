
#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"
#define TRACE_NAME "procFile_metric"
#include "trace.h"

#include <sys/stat.h>			// mkfifo
#include <fcntl.h>				// open
#include <stdlib.h>				// exit
#include <ctime>
#include <string>
#include <thread>
#include <map>

namespace artdaq
{
	/**
	 * \brief A MetricPlugin which writes a long unsigned int metric with a given name to a given pipe
	 *
	 * This MetricPlugin emulates the function of the /proc file system, where the kernel provides
	 * access to various counters and parameters.
	 */
	class ProcFileMetric : public MetricPlugin
	{
	private:
		std::string pipe_;
		std::unordered_map<std::string, std::string> value_map_;
		bool stopped_;
		std::thread thread_;
	public:
		/**
		 * \brief ProcFileMetric Constructor
		 * \param config FHiCL ParameterSet used to configure the ProcFileMetric
		 *
		 * \verbatim
		 * ProcFileMetric accepts the following Parameters (in addition to those accepted by MetricPlugin):
		 * "pipe": Name of pipe virtual file to write to
		 * "name": Name of the metric to write to pipe
		 * \endverbatim
		 */
		explicit ProcFileMetric(fhicl::ParameterSet config) : MetricPlugin(config)
			, pipe_(pset.get<std::string>("pipe", "/tmp/eventQueueStat"))
			, value_map_()
			, stopped_(true)
		{
			auto names = pset.get<std::vector<std::string>>("names", std::vector<std::string>());

			for (auto name : names)
			{
				value_map_[name] = "";
			}

			int sts = mkfifo(pipe_.c_str(), 0777);
			if (sts != 0) { perror("ProcFileMetric mkfifo"); }
			TRACE(10, "ProcFileMetric mkfifo(" + pipe_ + ") sts=%d", sts);
			startMetrics();
		}

		/**
		 * \brief ProcFileMetric Destructor
		 */
		~ProcFileMetric() {
			TRACE( 11, "~ProcFileMetric" );
			stopMetrics();
		}

		/**
		 * \brief Get the "library name" of this Metric
		 * \return The library name of this metric, "procFile"
		 */
		std::string getLibName() const override { return "procFile"; }

		/**
		 * \brief Set the value to be written to the pipe when it is opened by a reader
		 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
		 * \param value Value of the metric.
		 */
		void sendMetric_(const std::string& name, const std::string& value, const std::string&) override {
			if (value_map_.count(name)) {
				TRACE(12, "sendMetric_ setting value="+ value);
				value_map_[name] = value;
			}
		}

		/**
		 * \brief Set the value to be written to the pipe when it is opened by a reader
		 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
		 * \param value Value of the metric.
		 * \param unit Units of the metric.
		 */
		void sendMetric_(const std::string& name, const int& value, const std::string& unit) override {
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		 * \brief Set the value to be written to the pipe when it is opened by a reader
		 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
		 * \param value Value of the metric.
		 * \param unit Units of the metric.
		 */
		void sendMetric_(const std::string& name, const double& value, const std::string& unit) override {
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		 * \brief Set the value to be written to the pipe when it is opened by a reader
		 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
		 * \param value Value of the metric.
		 * \param unit Units of the metric.
		 */
		void sendMetric_(const std::string& name, const float& value, const std::string& unit) override {
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		 * \brief Set the value to be written to the pipe when it is opened by a reader
		 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
		 * \param value Value of the metric.
		 * \param unit Units of the metric.
		 */
		void sendMetric_(const std::string& name, const unsigned long int& value, const std::string& unit) override
		{
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		 * \brief Start the metric-sending thread
		 */
		void startMetrics_() override
		{
			if (stopped_)
			{
				// start thread
				stopped_ = false;
				thread_ = std::thread(&ProcFileMetric::writePipe, this);
			}
		}

		/**
		 * \brief Open the pipe for reading to allow the metric-sending thread to end gracefully
		 */
		void stopMetrics_() override
		{
			if (!stopped_)
			{
				stopped_ = true;
				// do read on pipe to make sure writePipe is not blocking on open
				TRACE(11, "stopMetrics_ before open " + pipe_);
				int fd = open(pipe_.c_str(), O_RDONLY | O_NONBLOCK);
				if (fd == -1) { perror("stopMetrics_ open(\"r\")"); exit(1); }
				TRACE(10, "stopMetrics_ between open and unlink" + pipe_ + " fd=%d", fd);
				unlink(pipe_.c_str());
				TRACE(11, "stopMetrics_ unlinked " + pipe_);
# if 0
				char buf[256];
				read(fd, buf, sizeof(buf));
# endif
				usleep(10000);
				close(fd);
				TRACE(11, "stopMetrics_ after close " + pipe_);
				if (thread_.joinable()) thread_.join();
			}
		}

		/**
		 * \brief Wait for the pipe to be opened and then write the current value to it
		 */
		void writePipe()
		{
			while (!stopped_)
			{
				TRACE(11, "writePipe before open");
				int fd = open(pipe_.c_str(), O_WRONLY);
				std::string str;
				for (auto value : value_map_) {
					TRACE(10, "writePipe open fd="+std::to_string(fd)+" name="+value.first+" value="+value.second ); // can't have args b/c name may have %
					str += value.first + ": " + value.second + "\n";
					//snprintf(buf, sizeof(buf), "%s: %lu\n", value.first.c_str(), value.second);
				}
				int sts = write(fd, str.c_str(), str.size());
				TRACE(11, "writePipe write complete sts=%d", sts);
				close(fd);
				TRACE(11, "writePipe after close -- about to usleep");
				usleep(400000);	// must wait to make sure other end closes
			}

		}
	};
} //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::ProcFileMetric)
