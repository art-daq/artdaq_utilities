find_ups_product(swig v3_0_0)
find_ups_product(nodejs v4_5_0)

if( SWIG_FOUND )
INCLUDE(${SWIG_USE_FILE}) 
endif(SWIG_FOUND)

SET(NODEJS_ADDON_DIR ${CMAKE_CURRENT_LIST_DIR})

function(create_node_package_json NODEJS_ADDON_NAME)
        configure_file (${NODEJS_ADDON_DIR}/package.json.in ${CMAKE_CURRENT_BINARY_DIR}/package.json @ONLY)
        install(FILES ${CMAKE_CURRENT_BINARY_DIR}/package.json
            DESTINATION ${flavorqual_dir}/lib/node_modules/${NODEJS_ADDON_NAME} )
endfunction()

function(create_nodejs_addon NODEJS_ADDON_NAME NODEJS_ADDON_INCLUDES NODEJS_ADDON_LIBS)
    if(SWIG_FOUND AND NODEJS_FOUND)
        set (NODE_INCLUDE_DIRS $ENV{NODEJS_INC})

        execute_process(COMMAND node -e "var arr = process.versions.v8.split('.');arr.push('EXTRA');console.log(arr.join(';'));" OUTPUT_VARIABLE V8_STRING)
        list(GET V8_STRING 0 V8_STRING_MAJOR)
        list(GET V8_STRING 1 V8_STRING_MINOR)
        list(GET V8_STRING 2 V8_STRING_PATCH)
        execute_process(COMMAND printf %d%02d%02d ${V8_STRING_MAJOR} ${V8_STRING_MINOR} ${V8_STRING_PATCH} OUTPUT_VARIABLE V8_DEFINE_STRING)
        message("V8_DEFINE_STRING is ${V8_DEFINE_STRING}")

        set( CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-unused-parameter")

        file(GLOB NODEJS_ADDON_SOURCES  *.i)
        file(GLOB LIB_SOURCES  *.cpp)

        set_source_files_properties (${NODEJS_ADDON_SOURCES} PROPERTIES CPLUSPLUS ON)
        set_source_files_properties (${NODEJS_ADDON_SOURCES} PROPERTIES SWIG_FLAGS "-node")

        list(APPEND NODEJS_ADDON_INCLUDES ${CMAKE_CURRENT_SOURCE_DIR}) 

        swig_add_module (${NODEJS_ADDON_NAME} javascript ${NODEJS_ADDON_SOURCES} ${LIB_SOURCES})

        swig_link_libraries (${NODEJS_ADDON_NAME} ${NODE_LIBRARIES} ${NODEJS_ADDON_LIBS})

        target_include_directories ( ${NODEJS_ADDON_NAME} PUBLIC ${NODE_INCLUDE_DIRS} ${NODEJS_ADDON_INCLUDES})

        set_target_properties (${NODEJS_ADDON_NAME} PROPERTIES
        COMPILE_FLAGS "${CMAKE_CXX_FLAGS} -DBUILDING_NODE_EXTENSION -DSWIG_V8_VERSION=0x0${V8_DEFINE_STRING}"
        PREFIX ""
        SUFFIX ".node"
        )

        create_node_package_json(${NODEJS_ADDON_NAME})

        install (FILES ${LIBRARY_OUTPUT_PATH}/${NODEJS_ADDON_NAME}.node DESTINATION ${flavorqual_dir}/lib/node_modules/${NODEJS_ADDON_NAME})

        # add_custom_command(TARGET ${NODEJS_ADDON_NAME} POST_BUILD 
        # COMMAND echo "**** Exports for ${LIBRARY_OUTPUT_PATH}/${NODEJS_ADDON_NAME}.node"
        # COMMAND echo "**** BEGIN"
        # COMMAND /usr/bin/nm ${LIBRARY_OUTPUT_PATH}/${NODEJS_ADDON_NAME}.node | /bin/egrep -e \"^[a-f0-9]{1,16} [T]\" | /usr/bin/c++filt  
        # COMMAND echo "**** END" )

    else(SWIG_FOUND AND NODEJS_FOUND)
        message("Compatible versions of Swig or Node.js not found. Compatible versions of Swig or Node.js not found")
    endif(SWIG_FOUND AND NODEJS_FOUND)
endfunction()
