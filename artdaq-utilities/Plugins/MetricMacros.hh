#ifndef artdaq_Plugins_MetricMacros_hh
#define artdaq_Plugins_MetricMacros_hh

#include "artdaq-utilities/Plugins/MetricPlugin.hh"
#include "fhiclcpp/fwd.h"

#include <memory>

namespace artdaq
{
	/**
	 * \brief Make a MetricPlugin instance, loading the plugin if necessary
	 * \param ps ParameterSet used to configure the MetricPlugin instance
	 * \return A std::unique_ptr<artdaq::MetricPlugin> to the new instance
	 */
	typedef std::unique_ptr<artdaq::MetricPlugin> makeFunc_t(fhicl::ParameterSet const& ps);
}

#define DEFINE_ARTDAQ_METRIC(klass)                                \
  extern "C"                                                          \
  std::unique_ptr<artdaq::MetricPlugin>                          \
  make(fhicl::ParameterSet const & ps) {                              \
    return std::unique_ptr<artdaq::MetricPlugin>(new klass(ps)); \
  }

#endif /* artdaq_Plugins_MetricMacros_hh */
