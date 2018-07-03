// FileMetric.h: File Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 11/06/2014
//
// An implementation of the MetricPlugin for Log Files

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"

#include <fstream>
#include <ctime>
#include <string>
#include <sys/types.h>
#include <unistd.h>

namespace artdaq
{
	/**
	 * \brief FileMetric writes metric data to a file on disk
	 */
	class FileMetric : public MetricPlugin
	{
	private:
		std::string outputFile_;
		bool uniquify_file_name_;
		std::ofstream outputStream_;
		std::ios_base::openmode mode_;
		std::string timeformat_;
		bool stopped_;

		std::string getTime_()
		{
			static std::mutex timeMutex;
			std::unique_lock<std::mutex> lk(timeMutex);
			const std::time_t result = std::time(0);
			auto resultTm = localtime(&result);
			std::string timeString;
			timeString.reserve(30);
			strftime(&timeString[0], 30, timeformat_.c_str(), resultTm);

			return timeString;
		}
	public:
		/**
		 * \brief FileMetric Constructor. Opens the file and starts the metric
		 * \param config ParameterSet used to configure FileMetric
		 * \param app_name Name of the application sending metrics
		 *
		 * \verbatim
		 * FileMetric accepts the following Parameters:
		 * "fileName" (Default: "FileMetric.out"): Name of the output file
		 * "uniquify" (Default: false): If true, will replace %UID% with the PID of the current process, or append _%UID% to the end of the filename if %UID% is not present in fileName
		 * "time_format" (Default: "%c"): Format to use for time printout
		 * "fileMode" (Default: "append"): Set to "Overwrite" to create a new file instead of appending
		 * \endverbatim
		 */
		explicit FileMetric(fhicl::ParameterSet const& config, std::string const& app_name) : MetricPlugin(config, app_name)
			, outputFile_(pset.get<std::string>("fileName", "FileMetric.out"))
			, uniquify_file_name_(pset.get<bool>("uniquify", false))
			, timeformat_(pset.get<std::string>("time_format", "%c"))
			, stopped_(true)
		{
			std::string modeString = pset.get<std::string>("fileMode", "append");

			mode_ = std::ofstream::out | std::ofstream::app;
			if (modeString == "Overwrite" || modeString == "Create" || modeString == "Write")
			{
				mode_ = std::ofstream::out | std::ofstream::trunc;
			}

			if (uniquify_file_name_)
			{
				std::string unique_id = std::to_string(getpid());
				if (outputFile_.find("%UID%") != std::string::npos)
				{
					outputFile_ = outputFile_.replace(outputFile_.find("%UID%"), 5, unique_id);
				}
				else
				{
					if (outputFile_.rfind(".") != std::string::npos)
					{
						outputFile_ = outputFile_.insert(outputFile_.rfind("."), "_" + unique_id);
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
		virtual ~FileMetric()
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
		*/
		void sendMetric_(const std::string& name, const std::string& value, const std::string& unit) override
		{
			if (!stopped_ && !inhibit_)
			{
				outputStream_ << getTime_() << "FileMetric: " << name << ": " << value << " " << unit << "." << std::endl;
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
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		* \brief Write metric data to a file
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
		void sendMetric_(const std::string& name, const double& value, const std::string& unit) override
		{
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		* \brief Write metric data to a file
		* \param name Name of the metric
		* \param value Value of the metric
		* \param unit Units of the metric
		*/
		void sendMetric_(const std::string& name, const float& value, const std::string& unit) override
		{
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		 * \brief Write metric data to a file
		 * \param name Name of the metric
		 * \param value Value of the metric
		 * \param unit Units of the metric
		 */
		void sendMetric_(const std::string& name, const unsigned long int& value, const std::string& unit) override
		{
			sendMetric_(name, std::to_string(value), unit);
		}

		/**
		 * \brief Perform startup actions. Writes start message to output file.
		 */
		void startMetrics_() override
		{
			stopped_ = false;
			outputStream_ << getTime_() << "FileMetric plugin started." << std::endl;
		}

		/**
		 * \brief Perform shutdown actions. Writes stop message to output file.
		 */
		void stopMetrics_() override
		{
			stopped_ = true;
			outputStream_ << getTime_() << "FileMetric plugin has been stopped!" << std::endl;
		}

	private:
		void openFile_()
		{
			outputStream_.open(outputFile_.c_str(), mode_);
			outputStream_ << getTime_() << "FileMetric plugin file opened." << std::endl;
		}

		void closeFile_()
		{
			outputStream_ << getTime_() << "FileMetric closing file stream." << std::endl;
			outputStream_.close();
		}
	};
} //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::FileMetric)
