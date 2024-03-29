cet_register_export_set(SET_NAME PluginTypes NAMESPACE artdaq_plugin_types)
# Make sure our default export set's targets file is read _after_ PluginTypes'
cet_register_export_set()

cet_make_library(LIBRARY_NAME metric INTERFACE
	EXPORT_SET PluginTypes
	SOURCE MetricPlugin.hh
	LIBRARIES INTERFACE
  fhiclcpp::fhiclcpp
  cetlib::compiler_macros
  TRACE::TRACE
  TRACE::MF
  Threads::Threads
  Boost::thread
)

cet_make_library(SOURCE
  MetricManager.cc
  SystemMetricCollector.cc
  TestMetric.cc
  makeMetricPlugin.cc
  LIBRARIES
  PUBLIC
  artdaq_plugin_types::metric
  PRIVATE
  cetlib::cetlib
)

include(BasicPlugin)
cet_write_plugin_builder(artdaq::metric artdaq::metric Modules
  SUFFIX metric
  INSTALL_BUILDER
  LIBRARIES CONDITIONAL artdaq_plugin_types::metric)

cet_collect_plugin_builders(Modules MetricPlugins LIST artdaq::metric)
include(MetricPlugins)

cet_build_plugin(file artdaq::metric
  LIBRARIES PRIVATE
  Boost::filesystem
)
cet_build_plugin(graphite artdaq::metric
  LIBRARIES PRIVATE
)
cet_build_plugin(msgFacility artdaq::metric
  LIBRARIES PRIVATE
  messagefacility::MF_MessageLogger
)
cet_build_plugin(procFile artdaq::metric
  LIBRARIES PRIVATE
)
cet_build_plugin(report artdaq::metric
  LIBRARIES PRIVATE
)
cet_build_plugin(test artdaq::metric
  LIBRARIES PRIVATE
  artdaq_utilities::artdaq-utilities_Plugins
)

install_headers()
install_source()
install_fhicl(SUBDIRS fcl)
