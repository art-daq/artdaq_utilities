#include "artdaq-utilities/Plugins/makeMetricPlugin.hh"

#include "artdaq-utilities/Plugins/MetricMacros.hh"
#include "fhiclcpp/ParameterSet.h"
#include "cetlib/BasicPluginFactory.h"

std::unique_ptr<artdaq::MetricPlugin>
artdaq::makeMetricPlugin(std::string const& generator_plugin_spec, fhicl::ParameterSet const& ps, std::string const& app_name)
{
	static cet::BasicPluginFactory bpf("metric", "make");

	return bpf.makePlugin<std::unique_ptr<artdaq::MetricPlugin>, fhicl::ParameterSet const &, std::string const&>(generator_plugin_spec, ps, app_name);
}
