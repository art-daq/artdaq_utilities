SET(CMAKE_C_FLAGS "-std=gnu99 -fPIC" CACHE STRING "" FORCE)
cet_make_library(LIBRARY_NAME gmetric 
                 SOURCE send_gmetric.c
                 LIBRARIES ganglia apr-1
                           WITH_STATIC_LIBRARY)

simple_plugin(ganglia "metric"
  artdaq_Plugins
  gmetric
  ${FHICLCPP}
  ${CETLIB}
  ${MF_MESSAGELOGGER}
  ${MF_UTILITIES}
)

install_headers()
install_source()
