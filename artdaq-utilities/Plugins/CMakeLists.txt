cet_make(
  EXCLUDE graphite_metric.cc file_metric.cc msgFacility_metric.cc procFile_metric.cc report_metric.cc test_metric.cc
  LIBRARIES
  ${FHICLCPP}
  ${CETLIB}
  ${MESSAGEFACILITY_LIBS}
  ${CETLIB_EXCEPT}
  pthread
  ${Boost_THREAD_LIBRARY}
  ${Boost_SYSTEM_LIBRARY}
  )

basic_plugin("file" "metric"
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
  ${Boost_SYSTEM_LIBRARY}
  ${Boost_FILESYSTEM_LIBRARY}
  ${MESSAGEFACILITY_LIBS}
)

basic_plugin("test" "metric"
	artdaq-utilities_Plugins
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
)

basic_plugin("trace" "metric"
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
)

basic_plugin("report" "metric"
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
  ${MESSAGEFACILITY_LIBS}
)

basic_plugin("msgFacility" "metric"
   ${FHICLCPP}
   ${CETLIB}
  ${CETLIB_EXCEPT}
  ${MESSAGEFACILITY_LIBS}
)

basic_plugin("graphite" "metric"
  ${Boost_SYSTEM_LIBRARY}
  ${Boost_THREAD_LIBRARY}
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
   ${MF_MESSAGELOGGER}
  pthread
)

basic_plugin("procFile" "metric"
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
   ${MF_MESSAGELOGGER}
  pthread
  ${Boost_THREAD_LIBRARY}
  ${Boost_SYSTEM_LIBRARY}
)

install_headers()
install_source()
install_fhicl(SUBDIRS fcl)
