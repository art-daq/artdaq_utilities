cet_make(
  EXCLUDE graphite_metric.cc file_metric.cc msgFacility_metric.cc
  LIBRARIES
  ${ART_PERSISTENCY_COMMON}
  ${ART_UTILITIES}
  ${FHICLCPP}
  ${CETLIB}
  ${MF_MESSAGELOGGER}
  ${MF_UTILITIES}
  )

basic_plugin("file" "metric"
  ${FHICLCPP}
  ${CETLIB}
)

basic_plugin("msgFacility" "metric"
   ${FHICLCPP}
   ${CETLIB}
   ${MF_MESSAGELOGGER}
   ${MF_UTILITIES}
)

basic_plugin("graphite" "metric"
  ${Boost_SYSTEM_LIBRARY}
  ${Boost_THREAD_LIBRARY}
  ${FHICLCPP}
  ${CETLIB}
  pthread
)

install_headers()
install_source()
install_fhicl(SUBDIRS fcl)
