cet_test(MetricManager_t USE_BOOST_UNIT
         LIBRARIES
         artdaq-utilities_Plugins
         ${FHICLCPP}
         ${MF_MESSAGELOGGER}
         ${Boost_SYSTEM_LIBRARY}
         )
		 cet_test(MetricPlugin_t USE_BOOST_UNIT
         LIBRARIES
         artdaq-utilities_Plugins
         ${FHICLCPP}
         ${MF_MESSAGELOGGER}
         ${Boost_SYSTEM_LIBRARY}
         )
