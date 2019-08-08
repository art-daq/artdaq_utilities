#ifndef artdaq_Plugins_makeGPMPlugins_hh
#define artdaq_Plugins_makeGPMPlugins_hh

// Using LibraryManager, find the correct library and return an instance
// of the specified generator.

#include "fhiclcpp/fwd.h"
#include <memory>

/**
 * \brief The artdaq namespace
 */
namespace artdaq
{
  class GPMPublisher;
  class GPMSubscriber;

  /**
   * \brief Load a given GPMPublisher plugin and return a pointer to it
   * \param generator_plugin_spec Name of the GPMPublisher plugin
   * \param ps ParameterSet with which to configure the GPMPublisher
   * \param application_name Application name of the calling application
   * \return std::unique_ptr to the new GPMPublisher instance
   */
  std::unique_ptr<GPMPublisher>
  makeGPMPublisher(std::string const& generator_plugin_spec,
                   fhicl::ParameterSet const& ps, std::string const& application_name);

  /**
   * \brief Load a given GPMSubscriber plugin and return a pointer to it
   * \param generator_plugin_spec Name of the GPMSubscriber plugin
   * \param ps ParameterSet with which to configure the GPMSubscriber
   * \param application_name Application name of the calling application
   * \return std::unique_ptr to the new GPMSubscriber instance
   */
  std::unique_ptr<GPMSubscriber>
  makeGPMSubscriber(std::string const& generator_plugin_spec,
                    fhicl::ParameterSet const& ps, std::string const& application_name);
}
#endif /* artdaq_Plugins_makeGPMPlugins_hh */
