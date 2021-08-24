#ifndef artdaq_Plugins_makeMetricPlugin_hh
#define artdaq_Plugins_makeMetricPlugin_hh
// Using LibraryManager, find the correct library and return an instance
// of the specified generator.

#include "fhiclcpp/fwd.h"

#include <memory>
#include <string>

/**
 * \brief The artdaq namespace
 */
namespace artdaq {
class MetricPlugin;

/**
	 * \brief Load a given MetricPlugin and return a pointer to it
	 * \param generator_plugin_spec Name of the MetricPlugin
	 * \param ps ParameterSet with which to configure the MetricPlugin
	 * \param app_name Application name of the calling application
	 * \param metric_name Name of this MetricPlugin instance
	 * \return std::unique_ptr to the new MetricPlugin instance
	 */
std::unique_ptr<MetricPlugin>
makeMetricPlugin(std::string const& generator_plugin_spec,
                 fhicl::ParameterSet const& ps, std::string const& app_name, std::string const& metric_name);
}  // namespace artdaq
#endif /* artdaq_Plugins_makeMetricPlugin_hh */
