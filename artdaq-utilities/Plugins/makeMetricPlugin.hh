#ifndef artdaq_Plugins_makeMetricPlugin_hh
#define artdaq_Plugins_makeMetricPlugin_hh
// Using LibraryManager, find the correct library and return an instance
// of the specified generator.

#include "fhiclcpp/fwd.h"

#include <memory>
#include <string>

namespace artdaq {

  class MetricPlugin;

  std::unique_ptr<MetricPlugin>
    makeMetricPlugin(std::string const & generator_plugin_spec,
                          fhicl::ParameterSet const & ps);
}
#endif /* artdaq_Plugins_makeMetricPlugin_hh */
