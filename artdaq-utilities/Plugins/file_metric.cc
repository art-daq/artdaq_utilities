// FileMetric.h: File Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 11/06/2014
//
// An implementation of the MetricPlugin for Log Files

#define TRACE_NAME "FileMetric"
#include "tracemf.h"

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "trace.h"

#include <sys/types.h>
#include <unistd.h>
#include <boost/filesystem.hpp>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <string>
namespace BFS = boost::filesystem;

namespace artdaq {
/**
 * \brief FileMetric writes metric data to a file on disk
 */
class FileMetric final : public MetricPlugin
{
private:
	std::string outputFile_;
	bool file_name_is_absolute_path_;
	std::string relative_env_var_;
	bool uniquify_file_name_;
	std::ofstream outputStream_;
	std::ios_base::openmode mode_;
	std::string timeformat_;
	bool stopped_;

	std::ostream& getTime_(std::ostream& stream, const std::chrono::system_clock::time_point& time)
	{
		std::time_t tt = std::chrono::system_clock::to_time_t(time);

		struct std::tm* ptm = std::localtime(&tt);
		if (!timeformat_.empty())
		{
			return stream << std::put_time(ptm, timeformat_.c_str()) << ": ";
		}

		return stream;
	}

	FileMetric(const FileMetric&) = delete;
	FileMetric(FileMetric&&) = delete;
	FileMetric& operator=(const FileMetric&) = delete;
	FileMetric& operator=(FileMetric&&) = delete;

public:
	/**
   * \brief FileMetric Constructor. Opens the file and starts the metric
   * \param config ParameterSet used to configure FileMetric
   * \param app_name Name of the application sending metrics
   *
   * \verbatim
   * FileMetric accepts the following Parameters:
   * "fileName" (Default: "FileMetric.out"): Name of the output file
   * "absolute_file_path" (Default: true): Whether the fileName should be treated as an absolute path (default), or as relative to
   * "relative_directory_env_var" (Default: ARTDAQ_LOG_ROOT): If fileName is not an absolute path (absolute_file_path: false), it will be treated as relative to the directory specified in this environment variable.
   * "uniquify" (Default: false): If true, will replace %UID% with the PID of the current process, or append _%UID% to the end of the filename if %UID% is not present in fileName 
   * "time_format" (Default: "%c"): Format to use for time printout (see std::put_time)
   * "fileMode" (Default: "append"): Set to "Overwrite" to create a new file instead of appending \endverbatim
   */
	explicit FileMetric(fhicl::ParameterSet const& config, std::string const& app_name)
	    : MetricPlugin(config, app_name)
	    , outputFile_(pset.get<std::string>("fileName", "FileMetric.out"))
	    , file_name_is_absolute_path_(pset.get<bool>("absolute_file_path", true))
	    , relative_env_var_(pset.get<std::string>("relative_directory_env_var", "ARTDAQ_LOG_ROOT"))
	    , uniquify_file_name_(pset.get<bool>("uniquify", false))
	    , timeformat_(pset.get<std::string>("time_format", "%c"))
	    , stopped_(true)
	{
		auto modeString = pset.get<std::string>("fileMode", "append");

		mode_ = std::ofstream::out | std::ofstream::app;
		if (modeString == "Overwrite" || modeString == "Create" || modeString == "Write")
		{
			mode_ = std::ofstream::out | std::ofstream::trunc;
		}

		if (uniquify_file_name_)
		{
			struct timespec ts;
			clock_gettime(CLOCK_REALTIME, &ts);
			std::string unique_id = std::to_string(ts.tv_sec) + "_" + std::to_string(getpid());
			if (outputFile_.find("%UID%") != std::string::npos)
			{
				outputFile_ = outputFile_.replace(outputFile_.find("%UID%"), 5, unique_id);
			}
			else
			{
				if (outputFile_.rfind('.') != std::string::npos)
				{
					outputFile_ = outputFile_.insert(outputFile_.rfind('.'), "_" + unique_id);
				}
				else
				{
					outputFile_ = outputFile_.append("_" + unique_id);
				}
			}
		}

		openFile_();
		startMetrics();
	}

	/**
   * \brief FileMetric Destructor. Calls stopMetrics and then closes the file
   */
	~FileMetric() override
	{
		stopMetrics();
		closeFile_();
	}

	/**
   * \brief Get the library name for the File metric
   * \return The library name for the File metric, "file"
   */
	std::string getLibName() const override { return "file"; }

	/**
   * \brief Write metric data to a file
   * \param name Name of the metric
   * \param value Value of the metric
   * \param unit Units of the metric
   * \param time Time the metric was sent
   */
	void sendMetric_(const std::string& name, const std::string& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		if (!stopped_ && !inhibit_)
		{
			getTime_(outputStream_, time) << "FileMetric: " << name << ": " << value << " " << unit << "." << std::endl;
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
   * \brief Perform startup actions. Writes start message to output file.
   */
	void startMetrics_() override
	{
		stopped_ = false;
		getTime_(outputStream_, std::chrono::system_clock::now()) << "FileMetric plugin started." << std::endl;
	}

	/**
   * \brief Perform shutdown actions. Writes stop message to output file.
   */
	void stopMetrics_() override
	{
		stopped_ = true;
		getTime_(outputStream_, std::chrono::system_clock::now()) << "FileMetric plugin has been stopped!" << std::endl;
	}

private:
	void openFile_()
	{
		if (!file_name_is_absolute_path_)
		{
			TLOG(TLVL_DEBUG) << "Reading relative directory evironment variable " << relative_env_var_;
			std::string logPathProblem;
			std::string logfileName;
			char* logRootString = getenv(relative_env_var_.c_str());

			std::string logfileDir;
			if (logRootString != nullptr)
			{
				if (!BFS::exists(logRootString))
				{
					TLOG(TLVL_WARNING) << "Relative directory environment variable " << relative_env_var_ << " points to a non-existant directory! Using /tmp/!";
					outputFile_ = "/tmp/" + outputFile_;
					TLOG(TLVL_INFO) << "FileMetric Opening file " << outputFile_;
					outputStream_.open(outputFile_, mode_);
				}
				else
				{
					logfileDir = logRootString;
					logfileDir.append("/metrics/");

					while (outputFile_.find('/') != std::string::npos)
					{
						TLOG(TLVL_DEBUG) << "Extracting subdirectories from relative file path " << outputFile_ << " (logfileDir = " << logfileDir << ")";
						logfileDir.append(outputFile_.substr(0, outputFile_.find('/') + 1));
						outputFile_.erase(0, outputFile_.find('/') + 1);
					}

					// As long as the top-level directory exists, I don't think we
					// really care if we have to create application directories...
					TLOG(TLVL_DEBUG) << "Creating log file directory " << logfileDir;
					if (!BFS::exists(logfileDir))
					{
						BFS::create_directories(logfileDir);
					}

					logfileName.append(logfileDir);
					logfileName.append(outputFile_);

					TLOG(TLVL_INFO) << "FileMetric Opening file " << logfileName;
					outputStream_.open(logfileName, mode_);
				}
			}
			else
			{
				TLOG(TLVL_WARNING) << "Relative directory environment variable " << relative_env_var_ << " is null! Using /tmp/!";
				outputFile_ = "/tmp/" + outputFile_;
				TLOG(TLVL_INFO) << "FileMetric Opening file " << outputFile_;
				outputStream_.open(outputFile_, mode_);
			}
		}
		else
		{
			TLOG(TLVL_INFO) << "FileMetric Opening file " << outputFile_;
			outputStream_.open(outputFile_, mode_);
		}
		if (outputStream_.is_open())
		{
			getTime_(outputStream_, std::chrono::system_clock::now()) << "FileMetric plugin file opened." << std::endl;
		}
		else
		{
			TLOG(TLVL_ERROR) << "Error opening metric file " << outputFile_;
		}
	}

	void closeFile_()
	{
		getTime_(outputStream_, std::chrono::system_clock::now()) << "FileMetric closing file stream." << std::endl;

		try
		{
			outputStream_.flush();
			outputStream_.close();
		}
		catch (...)
		{
			// IGNORED
		}
	}
};  // namespace artdaq
}  // End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::FileMetric)
