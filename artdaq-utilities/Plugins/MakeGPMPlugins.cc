#include "artdaq-utilities/Plugins/MakeGPMPlugins.hh"

#include "artdaq-utilities/Plugins/GPMMacros.hh"
#include "cetlib/BasicPluginFactory.h"
#include "fhiclcpp/ParameterSet.h"

std::unique_ptr<artdaq::GPMPublisher>
artdaq::makeGPMPublisher(std::string const& generator_plugin_spec, fhicl::ParameterSet const& ps, std::string const& application_name)
{
	static cet::BasicPluginFactory bpf("publisher", "make");

	return bpf.makePlugin<std::unique_ptr<artdaq::GPMPublisher>, fhicl::ParameterSet const&, std::string const&>(generator_plugin_spec, ps, application_name);
}

std::unique_ptr<artdaq::GPMSubscriber>
artdaq::makeGPMSubscriber(std::string const& generator_plugin_spec, fhicl::ParameterSet const& ps, std::string const& application_name)
{
	static cet::BasicPluginFactory bpf("subscriber", "make");

	return bpf.makePlugin<std::unique_ptr<artdaq::GPMSubscriber>, fhicl::ParameterSet const&, std::string const&>(generator_plugin_spec, ps, application_name);
}
