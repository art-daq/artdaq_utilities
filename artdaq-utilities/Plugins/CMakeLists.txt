cet_make(
  EXCLUDE graphite_metric.cc file_metric.cc msgFacility_metric.cc procFile_metric.cc
  LIBRARIES
  ${FHICLCPP}
  ${CETLIB}
  ${MF_MESSAGELOGGER}
  ${MF_UTILITIES}
  ${CETLIB_EXCEPT}
  pthread
  ${Boost_THREAD_LIBRARY}
  ${Boost_SYSTEM_LIBRARY}
  )

basic_plugin("file" "metric"
  ${FHICLCPP}
  ${CETLIB}
  ${CETLIB_EXCEPT}
)

basic_plugin("msgFacility" "metric"
   ${FHICLCPP}
   ${CETLIB}
  ${CETLIB_EXCEPT}
   ${MF_MESSAGELOGGER}
   ${MF_UTILITIES}
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
