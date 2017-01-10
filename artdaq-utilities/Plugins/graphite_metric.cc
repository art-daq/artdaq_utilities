// graphite_metric.cc: Graphite Metric Plugin
// Author: Eric Flumerfelt
// Last Modified: 11/13/2014
//
// An implementation of the MetricPlugin for Graphite

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <iostream>
#include <ctime>
#include <string>
#include <algorithm>
#include <boost/asio.hpp>
#include <chrono>

using boost::asio::ip::tcp;

namespace artdaq {
	class GraphiteMetric : public MetricPlugin {
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
		GraphiteMetric(fhicl::ParameterSet config) : MetricPlugin(config),
			host_(pset.get<std::string>("host", "localhost")),
			port_(pset.get<int>("port", 2003)),
			namespace_(pset.get<std::string>("namespace", "artdaq.")),
			io_service_(),
			socket_(io_service_),
			stopped_(true),
			errorCount_(0)
		{
			startMetrics();
		}
		~GraphiteMetric() { stopMetrics(); }
		virtual std::string getLibName() const { return "graphite"; }

		virtual void sendMetric_(const std::string& name, const std::string& value, const std::string& unit)
		{
			if (!stopped_) {
				std::string unitWarn = unit;
				const std::time_t result = std::time(0);
				boost::asio::streambuf data;
				std::string nameTemp(name);
				std::replace(nameTemp.begin(), nameTemp.end(), ' ', '_');
				std::ostream out(&data);
				out << namespace_ << nameTemp << " "
					<< value << " "
					<< result << std::endl;

				boost::system::error_code error;
				boost::asio::write(socket_, data, error);
				if (error) {
					errorCount_++;
					reconnect_();
				}
			}
		}
		virtual void sendMetric_(const std::string& name, const int& value, const std::string& unit)
		{
			sendMetric(name, std::to_string(value), unit);
		}
		virtual void sendMetric_(const std::string& name, const double& value, const std::string& unit)
		{
			sendMetric(name, std::to_string(value), unit);
		}
		virtual void sendMetric_(const std::string& name, const float& value, const std::string& unit)
		{
			sendMetric(name, std::to_string(value), unit);
		}
		virtual void sendMetric_(const std::string& name, const unsigned long int& value, const std::string& unit)
		{
			sendMetric(name, std::to_string(value), unit);
		}
		virtual void startMetrics_() {
			if (stopped_)
			{
				reconnect_();
				stopped_ = false;
			}
		}
		virtual void stopMetrics_() {
			if (!stopped_)
			{
				socket_.shutdown(boost::asio::socket_base::shutdown_send);
				socket_.close();
				stopped_ = true;
			}
		}

		void reconnect_() {
			if (errorCount_ < 5) {
				boost::system::error_code error;
				tcp::resolver resolver(io_service_);
				tcp::resolver::query query(host_, std::to_string(port_));
				boost::asio::connect(socket_, resolver.resolve(query), error);
				if (!error) { errorCount_ = 0; }
				else { mf::LogWarning("GraphiteMetric") << "Error reconnecting socket, attempt #" << errorCount_; }
				waitStart_ = std::chrono::steady_clock::now();
			}
			else if (std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now() - waitStart_).count() >= 5)//Seconds
			{
				errorCount_ = 0;
			}
		}
	};

} //End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::GraphiteMetric)
