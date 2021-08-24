// graphite_metric.cc: Graphite Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 11/13/2014
//
// An implementation of the MetricPlugin for Graphite

#include "TRACE/tracemf.h"  // order matters -- trace.h (no "mf") is nested from MetricMacros.hh
#define TRACE_NAME (app_name_ + "_graphite_metric").c_str()

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <algorithm>
#include <boost/asio.hpp>
#include <chrono>
#include <ctime>
#include <iostream>
#include <string>

using boost::asio::ip::tcp;

namespace artdaq {
/**
	 * \brief Send a metric to Graphite
	 * 
	 * Graphite accepts metrics in a tree hiereachy, using '.' as a delimiter. Therefore, the metric artdaq.BoardReader.Fragment_Rate will appear in Graphite as:
	 * artdaq/
	 *   BoardReader/
	 *     Fragment_Rate
	 *     
	 *  This plugin sends TCP messages with the following content: [name] [value] [timestamp], units are discarded
	 */
class GraphiteMetric final : public MetricPlugin
{
private:
	std::string host_;
	int port_;
	std::string namespace_;
	boost::asio::io_service io_service_;
	tcp::socket socket_;
	bool stopped_;
	int errorCount_;
	std::chrono::steady_clock::time_point waitStart_;

public:
	/**
	 * \brief GraphiteMetric Constructor
	 * \param config ParameterSet used to configure GraphiteMetric
	 * \param app_name Name of the application sending metrics
	 * \param metric_name Name of this MetricPlugin instance
	 * 
	 * \verbatim
	 * GraphiteMetric accepts the following Parameters:
	 * "host" (Default: "localhost"): Destination host
	 * "port" (Default: 2003): Destination port
	 * "namespace" (Default: "artdaq."): Directory name to prepend to all metrics. Should include the trailing '.'
	 * \endverbatim
	 */
	explicit GraphiteMetric(fhicl::ParameterSet const& config, std::string const& app_name, std::string const& metric_name)
	    : MetricPlugin(config, app_name, metric_name)
	    , host_(pset.get<std::string>("host", "localhost"))
	    , port_(pset.get<int>("port", 2003))
	    , namespace_(pset.get<std::string>("namespace", "artdaq."))
	    , io_service_()
	    , socket_(io_service_)
	    , stopped_(true)
	    , errorCount_(0)
	{
		METLOG(TLVL_TRACE) << "GraphiteMetric ctor";
		startMetrics();
	}

	/**
	 * \brief GraphiteMetric Destructor. Calls stopMetrics()
	 */
	~GraphiteMetric() override { stopMetrics(); }

	/**
	 * \brief Get the library name for the Graphite metric
	 * \return The library name for the Graphite metric, "graphite"
	 */
	std::string getLibName() const override { return "graphite"; }

	/**
	 * \brief Send a metric to Graphite
	 * \param name Name of the metric. Will have the namespace prepended
	 * \param value Value of the metric
     * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const std::string& value, const std::string& /*unit*/, const std::chrono::system_clock::time_point& time) override
	{
		if (!stopped_)
		{
			boost::asio::streambuf data;
			auto nameTemp(name);
			std::replace(nameTemp.begin(), nameTemp.end(), ' ', '_');
			std::ostream out(&data);
			out << namespace_ << nameTemp << " "
			    << value << " "
			    << std::chrono::system_clock::to_time_t(time) << std::endl;

			boost::system::error_code error;
			boost::asio::write(socket_, data, error);
			if (error)
			{
				errorCount_++;
				reconnect_();
			}
		}
	}

	/**
	 * \brief Send a metric to Graphite
	 * \param name Name of the metric. Will have the namespace prepended
	 * \param value Value of the metric
	 * \param unit Units of the metric (Not used)
     * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const int& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
	 * \brief Send a metric to Graphite
	 * \param name Name of the metric. Will have the namespace prepended
	 * \param value Value of the metric
	 * \param unit Units of the metric (Not used)
     * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const double& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
		* \brief Send a metric to Graphite
		* \param name Name of the metric. Will have the namespace prepended
		* \param value Value of the metric
		 * \param unit Units of the metric (Not used)
     * \param time Time the metric was sent
		*/
	void sendMetric_(const std::string& name, const float& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
	 * \brief Send a metric to Graphite
	 * \param name Name of the metric. Will have the namespace prepended
	 * \param value Value of the metric
	 * \param unit Units of the metric (Not used)
     * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const uint64_t& value, const std::string& unit, const std::chrono::system_clock::time_point& time) override
	{
		sendMetric_(name, std::to_string(value), unit, time);
	}

	/**
	 * \brief Perform startup actions. For Graphite, this means reconnecting the socket.
	 */
	void startMetrics_() override
	{
		if (stopped_)
		{
			reconnect_();
			stopped_ = false;
		}
	}

	/**
	 * \brief Perform shutdown actions. This shuts down the socket and closes it.
	 */
	void stopMetrics_() override
	{
		if (!stopped_)
		{
			try
			{
				socket_.shutdown(boost::asio::socket_base::shutdown_send);
				socket_.close();
				stopped_ = true;
			}
			catch (boost::system::system_error& err)
			{
				METLOG(TLVL_WARNING) << "In destructor of GraphiteMetric instance associated with " << host_ << ":" << port_ << ", the following boost::system::system_error exception was thrown out of a call to stopMetrics() and caught: " << err.code() << ", \"" << err.what() << "\"";
			}
			catch (...)
			{
				METLOG(TLVL_WARNING) << "In destructor of GraphiteMetric instance associated with " << host_ << ":" << port_ << ", an *unknown* exception was thrown out of a call to stopMetrics() and caught!";
			}
		}
	}

private:
	GraphiteMetric(const GraphiteMetric&) = delete;
	GraphiteMetric(GraphiteMetric&&) = delete;
	GraphiteMetric& operator=(const GraphiteMetric&) = delete;
	GraphiteMetric& operator=(GraphiteMetric&&) = delete;

	/**
		 * \brief Reconnect to Graphite
		 */
	void reconnect_()
	{
		if (errorCount_ < 5)
		{
			boost::system::error_code error;
			tcp::resolver resolver(io_service_);
			tcp::resolver::query query(host_, std::to_string(port_));
			boost::asio::connect(socket_, resolver.resolve(query), error);
			if (!error) { errorCount_ = 0; }
			else
			{
				METLOG(TLVL_WARNING) << "Error reconnecting socket, attempt #" << errorCount_;
			}
			waitStart_ = std::chrono::steady_clock::now();
		}
		else if (std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now() - waitStart_).count() >= 5)  //Seconds
		{
			errorCount_ = 0;
		}
	}
};
}  //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::GraphiteMetric)
