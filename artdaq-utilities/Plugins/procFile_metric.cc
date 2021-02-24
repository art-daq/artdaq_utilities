
#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"
#define TRACE_NAME "procFile_metric"
#include "trace.h"

#include <fcntl.h>     // open
#include <sys/stat.h>  // mkfifo
#include <boost/thread.hpp>
#include <cstdlib>  // exit
#include <ctime>
#include <map>
#include <string>

namespace artdaq {
/**
 * \brief A MetricPlugin which writes a long unsigned int metric with a given name to a given pipe
 *
 * This MetricPlugin emulates the function of the /proc file system, where the kernel provides
 * access to various counters and parameters.
 */
class ProcFileMetric final : public MetricPlugin
{
private:
	std::string pipe_;
	std::unordered_map<std::string, std::string> value_map_;
	bool stopped_;
	boost::thread thread_;

	ProcFileMetric(const ProcFileMetric&) = delete;
	ProcFileMetric(ProcFileMetric&&) = delete;
	ProcFileMetric& operator=(const ProcFileMetric&) = delete;
	ProcFileMetric& operator=(ProcFileMetric&&) = delete;

public:
	/**
	 * \brief ProcFileMetric Constructor
	 * \param config FHiCL ParameterSet used to configure the ProcFileMetric
	 * \param app_name Name of the application sending metrics
	 *
	 * \verbatim
	 * ProcFileMetric accepts the following Parameters (in addition to those accepted by MetricPlugin):
	 * "pipe": Name of pipe virtual file to write to
	 * "name": Name of the metric to write to pipe
	 * \endverbatim
	 */
	explicit ProcFileMetric(fhicl::ParameterSet const& config, std::string const& app_name)
	    : MetricPlugin(config, app_name)
	    , pipe_(pset.get<std::string>("pipe", "/tmp/eventQueueStat"))
	    , stopped_(true)
	{
		auto names = pset.get<std::vector<std::string>>("names", std::vector<std::string>());

		for (const auto& name : names)
		{
			value_map_[name] = "";
		}

		int sts = mkfifo(pipe_.c_str(), 0777);
		if (sts != 0) { perror("ProcFileMetric mkfifo"); }
		TLOG(10) << "ProcFileMetric mkfifo()" << pipe_ << " sts=" << sts;
		startMetrics();
	}

	/**
	 * \brief ProcFileMetric Destructor
	 */
	~ProcFileMetric() override
	{
		TLOG(11) << "~ProcFileMetric";
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
	void sendMetric_(const std::string& name, const std::string& value, const std::string& /*unit*/, const std::chrono::system_clock::time_point& /*time*/) override
	{
		if (value_map_.count(name) != 0u)
		{
			TLOG(12) << "sendMetric_ setting value=" << value;
			value_map_[name] = value;
		}
	}

	/**
	 * \brief Set the value to be written to the pipe when it is opened by a reader
	 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
	 * \param value Value of the metric.
	 * \param unit Units of the metric.
	 * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const int& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
	 * \brief Set the value to be written to the pipe when it is opened by a reader
	 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
	 * \param value Value of the metric.
	 * \param unit Units of the metric.
	 * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const double& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
	 * \brief Set the value to be written to the pipe when it is opened by a reader
	 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
	 * \param value Value of the metric.
	 * \param unit Units of the metric.
	 * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const float& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
	 * \brief Set the value to be written to the pipe when it is opened by a reader
	 * \param name Name of the metric. Must match configred name for value to be updated (This MetricPlugin should be used with the useNameOverride parameter!)
	 * \param value Value of the metric.
	 * \param unit Units of the metric.
	 * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const uint64_t& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
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
			boost::thread::attributes attrs;
			attrs.set_stack_size(4096 * 2000);  // 8000 KB
			try
			{
				thread_ = boost::thread(attrs, boost::bind(&ProcFileMetric::writePipe, this));
			}
			catch (boost::exception const& e)
			{
				std::cerr << "Creating ProcFile Metric thread failed! e: " << boost::diagnostic_information(e) << std::endl;
				exit(4);
			}
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
			TLOG(11) << "stopMetrics_ before open " << pipe_;
			int fd = open(pipe_.c_str(), O_RDONLY | O_NONBLOCK);
			if (fd == -1)
			{
				perror("stopMetrics_ open(\"r\")");
				exit(1);
			}
			TLOG(10) << "stopMetrics_ between open and unlink" << pipe_ << " fd=" << fd;
			unlink(pipe_.c_str());
			TLOG(11) << "stopMetrics_ unlinked " << pipe_;
#if 0
				char buf[256];
				read(fd, buf, sizeof(buf));
#endif
			usleep(10000);
			close(fd);
			TLOG(11) << "stopMetrics_ after close " << pipe_;
			if (thread_.joinable())
			{
				thread_.join();
			}
		}
	}

	/**
	 * \brief Wait for the pipe to be opened and then write the current value to it
	 */
	void writePipe()
	{
		while (!stopped_)
		{
			TLOG(11) << "writePipe before open";
			int fd = open(pipe_.c_str(), O_WRONLY);
			std::string str;
			for (const auto& value : value_map_)
			{
				TLOG(10) << "writePipe open fd=" << fd << " name=" << value.first << " value=" << value.second;  // can't have args b/c name may have %
				str += value.first + ": " + value.second + "\n";
				//snprintf(buf, sizeof(buf), "%s: %lu\n", value.first.c_str(), value.second);
			}
			int sts = write(fd, str.c_str(), str.size());
			TLOG(11) << "writePipe write complete sts=" << sts;
			close(fd);
			TLOG(11) << "writePipe after close -- about to usleep";
			usleep(400000);  // must wait to make sure other end closes
		}
	}
};
}  //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::ProcFileMetric)
