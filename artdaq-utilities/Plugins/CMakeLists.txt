cet_make(
  EXCLUDE graphite_metric.cc file_metric.cc msgFacility_metric.cc
  LIBRARIES
  ${FHICLCPP}
  ${CETLIB}
  ${MF_MESSAGELOGGER}
  ${MF_UTILITIES}
  ${CETLIB_EXCEPT}
  pthread
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

install_headers()
install_source()
install_fhicl(SUBDIRS fcl)
