cet_make(
  EXCLUDE graphite_metric.cc file_metric.cc msgFacility_metric.cc procFile_metric.cc report_metric.cc test_metric.cc
  LIBRARIES
  fhiclcpp
  cetlib
  MF_MessageLogger
  cetlib_except
  pthread
  ${Boost_THREAD_LIBRARY}
  ${Boost_SYSTEM_LIBRARY}
  )

basic_plugin("file" "metric"
  fhiclcpp
  cetlib
  cetlib_except
  ${Boost_SYSTEM_LIBRARY}
  ${Boost_FILESYSTEM_LIBRARY}
  MF_MessageLogger
)

basic_plugin("test" "metric"
	artdaq-utilities_Plugins
  fhiclcpp
  cetlib
  cetlib_except
)

basic_plugin("trace" "metric"
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
)

basic_plugin("report" "metric"
  fhiclcpp
  cetlib
  cetlib_except
  MF_MessageLogger
)

basic_plugin("msgFacility" "metric"
   fhiclcpp
   cetlib
  cetlib_except
  MF_MessageLogger
)

basic_plugin("graphite" "metric"
  ${Boost_SYSTEM_LIBRARY}
  ${Boost_THREAD_LIBRARY}
  fhiclcpp
  cetlib
  cetlib_except
   MF_MessageLogger
  pthread
)

basic_plugin("procFile" "metric"
  fhiclcpp
  cetlib
  cetlib_except
   MF_MessageLogger
  pthread
  ${Boost_THREAD_LIBRARY}
  ${Boost_SYSTEM_LIBRARY}
)

install_headers()
install_source()
install_fhicl(SUBDIRS fcl)
