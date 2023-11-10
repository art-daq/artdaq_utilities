
set(CAN_BUILD true)

  
FIND_PACKAGE(SWIG) 
INCLUDE(${SWIG_USE_FILE})
if ( NOT ${SWIG_FOUND} )
  set(CAN_BUILD false)
endif()
  
FIND_PACKAGE(Python3 COMPONENTS Python)
if ( NOT ${Python3_FOUND})
  set(CAN_BUILD false)
endif()

macro (create_python_addon)
    if(CAN_BUILD)
        set(cet_file_list "")
        set(create_python_addon_usage "USAGE: create_python_addon( [ADDON_NAME <addon name>] [LIBRARIES <library list>] [INCLUDES <include directories>])")
        #message(STATUS "create_python_addon debug: called with ${ARGN} from ${CMAKE_CURRENT_SOURCE_DIR}")
        cmake_parse_arguments( PIA "" "" "ADDON_NAME;LIBRARIES;INCLUDES" ${ARGN})
        # there are no default arguments
        if( PIA_DEFAULT_ARGS )
            message(FATAL_ERROR  " undefined arguments ${CNA_DEFAULT_ARGS} \n ${create_python_addon_usage}")
        endif()
		
    file(GLOB PIA_SOURCES  *_python.i)
    file(GLOB LIB_SOURCES  *.cpp)

    set_source_files_properties (${PIA_SOURCES} PROPERTIES CPLUSPLUS ON)

    list(APPEND PIA_INCLUDES ${CMAKE_CURRENT_SOURCE_DIR} ${PYTHON_INCLUDE_PATH}) 

    INCLUDE_DIRECTORIES(${CMAKE_CURRENT_SOURCE_DIR})

    #swig_add_module (${PIA_ADDON_NAME} python ${PIA_SOURCES} ${LIB_SOURCES})
	swig_add_library(${PIA_ADDON_NAME} LANGUAGE python SOURCES ${PIA_SOURCES} ${LIB_SOURCES})
    swig_link_libraries (${PIA_ADDON_NAME} ${PIA_LIBRARIES} Python3::Python)
    
		message("CMAKE_CXX_COMPILER is ${CMAKE_CXX_COMPILER}")
		if(CMAKE_CXX_COMPILER MATCHES "clang\\+\\+$")
            target_compile_options(${PIA_ADDON_NAME} PUBLIC -Wno-bad-function-cast -Wno-unused-parameter -Wno-register -Wno-deprecated-declarations)
		else()
            target_compile_options(${PIA_ADDON_NAME} PUBLIC -Wno-cast-function-type -Wno-unused-parameter -Wno-register)
		endif()

    set(PIA_ADDON_LIBNAME _${PIA_ADDON_NAME})

    set( mrb_build_dir $ENV{MRB_BUILDDIR} )
    if( mrb_build_dir )
        set( this_build_path ${mrb_build_dir}/${product} )
    else()
        set( this_build_path $ENV{CETPKG_BUILD} )
    endif()
          
     add_custom_command(TARGET ${PIA_ADDON_NAME} POST_BUILD 
                        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/${PIA_ADDON_NAME}.py ${this_build_path}/${artdaq_LIBRARY_DIR}
     )

    else(CAN_BUILD)
        message("Compatible version of Swig found. NOT building ${PIA_ADDON_NAME}")
    endif(CAN_BUILD)
endmacro()
