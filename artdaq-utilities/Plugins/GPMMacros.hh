#ifndef artdaq_Plugins_GPM_Macros_hh
#define artdaq_Plugins_GPM_Macros_hh

#include <memory>
#include "artdaq-utilities/Plugins/GPMPublisher.hh"
#include "artdaq-utilities/Plugins/GPMSubscriber.hh"
#include "cetlib/compiler_macros.h"
#include "fhiclcpp/fwd.h"

namespace artdaq {
/**
 * \brief Make a MetricPlugin instance, loading the plugin if necessary
 * \param ps ParameterSet used to configure the MetricPlugin instance
 * \param application_name Name of the application sending metrics
 * \return A std::unique_ptr<artdaq::MetricPlugin> to the new instance
 */
typedef std::unique_ptr<artdaq::GPMPublisher> makeFunc_t(fhicl::ParameterSet const& ps, std::string const& application_name);

// typedef std::unique_ptr<artdaq::GPMSubscriber> makeFunc_t(fhicl::ParameterSet const& ps, std::string const& application_name);
}  // namespace artdaq

#ifndef EXTERN_C_FUNC_DECLARE_START
#define EXTERN_C_FUNC_DECLARE_START extern "C" {
#endif

#define DEFINE_GPM_PUBLISHER(klass)                                                    \
	EXTERN_C_FUNC_DECLARE_START                                                        \
	std::unique_ptr<artdaq::GPMPublisher>                                              \
	make(fhicl::ParameterSet const& ps, std::string const& application_name)           \
	{                                                                                  \
		return std::unique_ptr<artdaq::GPMPublisher>(new klass(ps, application_name)); \
	}                                                                                  \
	}

#define DEFINE_GPM_SUBSCRIBER(klass)                                                    \
	EXTERN_C_FUNC_DECLARE_START                                                         \
	std::unique_ptr<artdaq::GPMSubscriber>                                              \
	make(fhicl::ParameterSet const& ps, std::string const& application_name)            \
	{                                                                                   \
		return std::unique_ptr<artdaq::GPMSubscriber>(new klass(ps, application_name)); \
	}                                                                                   \
	}

#endif /* artdaq_Plugins_GPM_Macros_hh */
