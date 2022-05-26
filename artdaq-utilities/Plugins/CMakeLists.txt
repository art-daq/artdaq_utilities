cet_register_export_set(SET_NAME PluginTypes NAMESPACE artdaq_plugin_types)


cet_make(
  EXCLUDE file_metric.cc graphite_metric.cc msgFacility_metric.cc procFile_metric.cc report_metric.cc test_metric.cc  
  LIBRARIES
  fhiclcpp::fhiclcpp
  TRACE::TRACE
  messagefacility::MF_MessageLogger
  Boost::thread
)


cet_make_library(LIBRARY_NAME metric INTERFACE
				 EXPORT_SET PluginTypes
				 SOURCE MetricPlugin.hh
				 LIBRARIES INTERFACE
				 art_plugin_support::plugin_config_macros
				 art_plugin_support::support_macros
				 artdaq_utilities::artdaq-utilities_Plugins)

include(BasicPlugin)
foreach(type IN ITEMS metric)
  cet_make_plugin_builder(${type} ${type} Modules
    LIBRARIES REG artdaq_plugin_types::${type})
endforeach()

cet_collect_plugin_builders(Modules MetricPlugins)
include(MetricPlugins)

cet_build_plugin(file metric)
cet_build_plugin(test metric)
cet_build_plugin(report metric)
cet_build_plugin(msgFacility metric)
cet_build_plugin(graphite metric)
cet_build_plugin(procFile metric)

install_headers()
install_source()
install_fhicl(SUBDIRS fcl)
