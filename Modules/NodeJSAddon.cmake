
function(check_dependencies)
    set(NODEJS_CAN_BUILD true)
    if(NOT EXISTS "$ENV{SWIG_DIR}")
        message("Directory \"$ENV{SWIG_DIR}\" does not exist, can't build Node.js addons!")
        set(NODEJS_CAN_BUILD false)
    endif(NOT EXISTS "$ENV{SWIG_DIR}")
    if(NOT EXISTS "$ENV{NODEJS_DIR}")
        message("Directory \"$ENV{NODEJS_DIR}\" does not exist, can't build Node.js addons!")
        set(NODEJS_CAN_BUILD false)
    endif(NOT EXISTS  "$ENV{NODEJS_DIR}")

    find_library(V8LIB NAMES v8)
    if(NOT EXISTS "${V8LIB}")
        message("V8 library not found, can't build Node.js addons!")
        set(V8LIB "")
        set(NODEJS_CAN_BUILD false)
    endif()

    if(NODEJS_CAN_BUILD)
        FIND_PACKAGE(SWIG REQUIRED) 
        INCLUDE(${SWIG_USE_FILE}) 
        find_package(nodejs v4_5_0)
    endif(NODEJS_CAN_BUILD)
endfunction()


function(create_node_package_json NODEJS_ADDON_NAME)
    check_dependencies()
    if(NODEJS_CAN_BUILD)
        configure_file (${CMAKE_CURRENT_LIST_DIR}/package.json.in ${CMAKE_CURRENT_BINARY_DIR}/package.json @ONLY)
        install(FILES ${CMAKE_CURRENT_BINARY_DIR}/package.json
                DESTINATION ${flavorqual_dir}/lib/node_modules/${NODEJS_ADDON_NAME} )
    endif(NODEJS_CAN_BUILD)
endfunction()

macro (create_nodejs_addon)
    check_dependencies()
    if(NODEJS_CAN_BUILD)
        set(cet_file_list "")
        set(create_nodejs_addon_usage "USAGE: create_nodejs_addon( [ADDON_NAME <addon name>] [LIBRARIES <library list>] [INCLUDES <include directories>])")
        #message(STATUS "create_nodejs_addon debug: called with ${ARGN} from ${CMAKE_CURRENT_SOURCE_DIR}")
        cmake_parse_arguments( CNA "" "" "ADDON_NAME;LIBRARIES;INCLUDES" ${ARGN})
        # there are no default arguments
        if( CNA_DEFAULT_ARGS )
            message(FATAL_ERROR  " undefined arguments ${CNA_DEFAULT_ARGS} \n ${create_nodejs_addon_usage}")
        endif()

        set (NODE_INCLUDE_DIRS $ENV{NODEJS_INC}/node)

        execute_process(COMMAND node -e "var arr = process.versions.v8.split('.');arr.push('EXTRA');console.log(arr.join(';'));" OUTPUT_VARIABLE V8_STRING)
        list(GET V8_STRING 0 V8_STRING_MAJOR)
        list(GET V8_STRING 1 V8_STRING_MINOR)
        list(GET V8_STRING 2 V8_STRING_PATCH)
        execute_process(COMMAND printf %d%02d%02d ${V8_STRING_MAJOR} ${V8_STRING_MINOR} ${V8_STRING_PATCH} OUTPUT_VARIABLE V8_DEFINE_STRING)
        message("V8_DEFINE_STRING is ${V8_DEFINE_STRING}")

        message("CMAKE_CXX_COMPILER is ${CMAKE_CXX_COMPILER}")
        if(CMAKE_CXX_COMPILER MATCHES "clang\\+\\+$")
            set( CMAKE_NODE_FLAGS ${CMAKE_CXX_FLAGS} -Wno-bad-function-cast -Wno-unused-parameter -Wno-unused-result)
        else()
            set( CMAKE_NODE_FLAGS ${CMAKE_CXX_FLAGS} -Wno-cast-function-type -Wno-unused-parameter -Wno-unused-result)
        endif()

        file(GLOB NODEJS_ADDON_SOURCES  *_node.i)
        file(GLOB LIB_SOURCES  *.cpp)
        file(GLOB SWIG_DEPENDS *.h *.i)

        set_source_files_properties (${NODEJS_ADDON_SOURCES} PROPERTIES CPLUSPLUS ON)

        list(APPEND CNA_INCLUDES ${CMAKE_CURRENT_SOURCE_DIR} ${NODE_INCLUDE_DIRS})

        SET(SWIG_MODULE_${CNA_ADDON_NAME}_EXTRA_DEPS ${SWIG_DEPENDS})
        #swig_add_module (${CNA_ADDON_NAME} javascript ${NODEJS_ADDON_SOURCES} ${LIB_SOURCES})
        swig_add_library(${CNA_ADDON_NAME} LANGUAGE javascript SOURCES ${NODEJS_ADDON_SOURCES} ${LIB_SOURCES})

        target_link_libraries (${CNA_ADDON_NAME} ${CNA_LIBRARIES} ${V8LIB})

        target_include_directories ( ${CNA_ADDON_NAME} BEFORE PUBLIC ${CNA_INCLUDES} ${NODE_INCLUDE_DIRS})

        target_compile_options(${CNA_ADDON_NAME} PUBLIC ${CMAKE_NODE_FLAGS})
        set_property(TARGET ${CNA_ADDON_NAME} PROPERTY SWIG_COMPILE_OPTIONS "-node")

        create_node_package_json(${CNA_ADDON_NAME})

        set( mrb_build_dir $ENV{MRB_BUILDDIR} )
        if( mrb_build_dir )
            set( this_build_path ${mrb_build_dir}/${product} )
        else()
            set( this_build_path $ENV{CETPKG_BUILD} )
        endif()

        install (FILES ${this_build_path}/lib/${CNA_ADDON_NAME}.node DESTINATION ${flavorqual_dir}/lib/node_modules/${CNA_ADDON_NAME})

        # add_custom_command(TARGET ${CNA_ADDON_NAME} POST_BUILD 
        # COMMAND echo "**** Exports for ${this_build_path}/lib/${CNA_ADDON_NAME}.node"
        # COMMAND echo "**** BEGIN"
        # COMMAND /usr/bin/nm ${this_build_path}/lib/${CNA_ADDON_NAME}.node | /bin/egrep -e \"^[a-f0-9]{1,16} [T]\" | /usr/bin/c++filt  
        # COMMAND echo "**** END" )

    else(NODEJS_CAN_BUILD)
        message("Compatible versions of Swig or Node.js not found. NOT building ${CNA_ADDON_NAME}")
    endif(NODEJS_CAN_BUILD)
endmacro()
