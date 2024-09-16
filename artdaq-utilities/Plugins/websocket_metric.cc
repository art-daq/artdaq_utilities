// websocket_metric.cc: Websocket Metric Plugin
// Bases on Graphite Metric Plugin
// Author: Simon Corrodi
// Last Modified: 10/23/2023
//
// A metrics manager plugin that forwards artdaq metrics over a websocket. 
// This plugin provides a websocket server allowing multiple clients to connect to. 
// Note that each plugin/metricsManager will need to run on a different port
//
// Example for clients connecting to HOST:PORT
//
// javascript:
// ---------------------------------------------------------------
// const socket = new WebSocket('ws://HOST:PORT');
// socket.addEventListener('message', handleMessage);  
// function handleMessage(event) {
//     console.log('Received:', event.data);
// }
// 
// python:
// ----------------------------------------------------------------
// import websocket
// def on_message(ws, message):
//     	print(f"Received: {message}")
// ws = websocket.WebSocketApp("ws://HOST:PORT/",
//                             on_message=on_message)
// ws.run_forever()
///

#include "TRACE/tracemf.h"  // order matters -- trace.h (no "mf") is nested from MetricMacros.hh
#define TRACE_NAME (app_name_ + "_graphite_metric").c_str()

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "messagefacility/MessageLogger/MessageLogger.h"

#include <algorithm>
#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <chrono>
#include <ctime>
#include <iostream>
#include <string>

using boost::asio::ip::tcp;

namespace artdaq {
/**
 * \brief Send a metric to a websocket
 *
 * This plugin sends messages over a websocket with the following content: [name] [value] [timestamp], units are discarded
 */
class WebsocketMetric final : public MetricPlugin
{
private:
	int port_;
	std::string namespace_;
	boost::asio::io_context io_context_;
	tcp::acceptor acceptor_;
	//tcp::socket socket_;
	bool stopped_;
	bool stop_accepting_;
	std::set<std::shared_ptr<boost::beast::websocket::stream<tcp::socket>>> connections_;
	std::thread io_thread_; // for io_context_.run() thread, we could use multiple if we run into performance issues

public:
	/**
	 * \brief WebsocketMetric Constructor
	 * \param config ParameterSet used to configure WebsocketMetric, use key "port" to specify the used port. Default is 2006. "namespace" adds a prefix, default is "artdaq." 
	 * \param app_name Name of the application sending metrics
	 * \param metric_name Name of this MetricPlugin instance
	 *
	 * \verbatim
	 * WebsocketMetric accepts the following Parameters:
	 * "port" (Default: 2006): Websocket server port the client can connect to
	 * "namespace" (Default: "artdaq."): Directory name to prepend to all metrics. Should include the trailing '.'
	 * \endverbatim
	 */
	explicit WebsocketMetric(fhicl::ParameterSet const& config, std::string const& app_name, std::string const& metric_name)
	    : MetricPlugin(config, app_name, metric_name)
	    , port_(pset.get<int>("port", 2006))
	    , namespace_(pset.get<std::string>("namespace", "artdaq."))
		, io_context_()
		, acceptor_( tcp::acceptor(io_context_, tcp::endpoint(tcp::v4(), port_))) // from all ips
	    , stopped_(true)
		, stop_accepting_(false)
	{
		METLOG(TLVL_DEBUG + 32) << "WebsocketMetric Starting Server";
		TLOG(TLVL_INFO) << "websocket Starting Server on port " << port_;

		startMetrics(); 
		accepting(); // start to accept new websockets
        TLOG(TLVL_INFO) << "websocket ioc.run()";
		io_thread_ = std::thread([this]() {io_context_.run(); });

		
	}

	/**
	 * \brief WebsocketMetricMetric Destructor. Calls stopMetrics()
	 *
	 * This also closes the websocket connection.
	 */
	~WebsocketMetric() override { 
			try
			{
				// close the websockets!!!
				for (auto& connection : connections_) {
					connection->close(boost::beast::websocket::close_code::normal);
					connection->next_layer().close();
					//const_cast<boost::beast::websocket::stream<tcp::socket>&>(connection).
					//	close(boost::beast::websocket::close_code::normal);
					//const_cast<boost::beast::websocket::stream<tcp::socket>&>(connection).next_layer().close();
				}
				connections_.clear();
				stopped_ = true;
			}
			catch (boost::system::system_error& err)
			{
				METLOG(TLVL_WARNING) << "In destructor of WebsocketMetric instance  on port " << port_ << ", the following boost::system::system_error exception was thrown out of a call to stopMetrics() and caught: " << err.code() << ", \"" << err.what() << "\"";
			}
			catch (...)
			{
				METLOG(TLVL_WARNING) << "In destructor of WebsocketMetric instance on port " << port_ << ", an *unknown* exception was thrown out of a call to stopMetrics() and caught!";
			}
		
		stop_accepting_ = true;
		stopMetrics(); 
		io_context_.stop();
		io_thread_.join(); // we could use multiple 
	}

	/**
	 * \brief Get the library name for the Websocket metric
	 * \return The library name for the Websocket metric, "websocket"
	 */
	std::string getLibName() const override { return "websocket"; }

	/**
	 * \brief Send a metric to Websocket
	 * \param name Name of the metric. Will have the namespace prepended
	 * \param value Value of the metric
	 * \param time Time the metric was sent
	 */
	void sendMetric_(const std::string& name, const std::string& value, const std::string& /*unit*/, const std::chrono::system_clock::time_point& time) override
	{
		if (!stopped_)
		{

			auto nameTemp(name);
			std::replace(nameTemp.begin(), nameTemp.end(), ' ', '_');
			std::ostringstream oss;
			oss << std::chrono::system_clock::to_time_t(time);
			broadcast(namespace_ + nameTemp + " " + value + " " + oss.str());
		}
	}

	/**
	 * \brief Send a metric to Websocket
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
	 * \brief Send a metric to Websocket
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
	 * \brief Send a metric to Websocket
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
	 * \brief Send a metric to Websocket
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
	 * \brief Perform startup actions. For the websocket nothing is really done here.
	 */
	void startMetrics_() override
	{
		if (stopped_)
		{
			stopped_ = false;
			//accepting();
		}
		//io_thread_ = std::thread([this]() {io_context_.run(); }); // this seg faults here, moved to constructor
	}

	/**
	 * \brief Perform shutdown actions. No action for Websockets.
	 */
	void stopMetrics_() override
	{
		if (!stopped_)
		{	
		}
	}

private:
	WebsocketMetric(const WebsocketMetric&) = delete;
	WebsocketMetric(WebsocketMetric&&) = delete;
	WebsocketMetric& operator=(const WebsocketMetric&) = delete;
	WebsocketMetric& operator=(WebsocketMetric&&) = delete;

	/**
	 * \brief Waits for new connection from a client and accepts it if a new connection is detected. Keeps accepting recursively.
	 */
	void accepting() {
		TLOG(TLVL_INFO) << "websocket accepting ( stopped = " << stopped_ << ")";
		if(stop_accepting_) return;

        acceptor_.async_accept(
            [this](boost::system::error_code ec, tcp::socket socket) {
                if (!ec) {
                    // Create a WebSocket session for this connection
					TLOG(TLVL_DEBUG) << "websocket new connection";
                    auto ws = std::make_shared<boost::beast::websocket::stream<tcp::socket>>(std::move(socket));
                    connections_.insert(ws);

                    // Set up WebSocket message handling
                    // ws->set_option(websocket::stream_base::timeout::suggested(boost::posix_time::seconds(30)));
                    ws->async_accept([this, ws](boost::system::error_code ec) {
                        if (!ec) {
                            // Connection established
							TLOG(TLVL_DEBUG) << "debug websocket connection established";
                        } else {
                            // Handle error
                            connections_.erase(ws);
                        }
                    });
                } else {
					TLOG(TLVL_DEBUG) << "websocket Error accepting connection: " << ec.message();
				}

                accepting(); // keep accepting more connections
            });
	}

	/**
	 * \brief Broadcasts a message (used by SendMetrics) to all connected clients. 
	 */
	void broadcast(std::string message) {
		TLOG(TLVL_INFO) << "websocket broadcast to " << connections_.size() << " connections ";
		for (auto connections_it = connections_.begin(); connections_it != connections_.end();) {
    		if ((*connections_it)->is_open()) {
                    try {
					    (*connections_it)->write(boost::asio::buffer(message));
                        ++connections_it;
                    } catch(boost::system::system_error& err) {
                        TLOG(TLVL_ERROR) << "ERROR: " << err.what();
                        connections_it = connections_.erase(connections_it);
                    }
			} else {
				connections_it = connections_.erase(connections_it);
			}
		}
	}

};
}  // End namespace artdaq

DEFINE_ARTDAQ_METRIC(artdaq::WebsocketMetric)
