# ======================================================================
#  artdaq-utilities main build file
#
#  cd .../path/to/build/directory
#  source .../path/to/artdaq-utilities/ups/setup_for_development
#  cmake [-DCMAKE_INSTALL_PREFIX=/install/path]
#        -Dqualifier:STRING=$CETPKG_QUAL
#        -DCMAKE_BUILD_TYPE=$CETPKG_TYPE
#        $CETPKG_SOURCE
#  make
#  make test
#  make install
#  make package
# ======================================================================

# use cmake 2.8 or later
cmake_minimum_required (VERSION 3.19)

find_package(cetmodules 3.16.00 REQUIRED)

project(artdaq_utilities VERSION 1.08.01)
			  
include(CetCMakeEnv)
cet_cmake_env()

# Find our own CMake modules, and tell everyone else where to find them.
cet_cmake_module_directories(Modules BINARY)

cet_set_compiler_flags(DIAGS VIGILANT
  WERROR
  NO_UNDEFINED
  EXTRA_FLAGS -pedantic
)

# Debug streamer.
string(TOUPPER ${CMAKE_BUILD_TYPE} BTYPE_UC)
if(BTYPE_UC STREQUAL DEBUG)
  add_definitions(-DDEBUGME)
	if(DEFINED ENV{USE_ASAN})
		if($ENV{USE_ASAN} GREATER 0)
			message("!!! Address Sanitizer Activated!!!")
			add_compile_options(-fsanitize=address -Wno-unused-command-line-argument)
			add_link_options(-lasan)
		endif()
	endif()
	if(DEFINED ENV{USE_TSAN})
		if($ENV{USE_TSAN} GREATER 0)
			message("!!! Thread Sanitizer Activated!!!")
			add_compile_options(-fsanitize=thread -Wno-unused-command-line-argument -Wno-tsan)
			add_link_options(-ltsan)
		endif()
	endif()
	if(DEFINED ENV{USE_UBSAN})
		if($ENV{USE_UBSAN} GREATER 0)
			message("!!! Undefined Sanitizer Activated!!!")
			add_compile_options(-fsanitize=undefined -Wno-unused-command-line-argument)
			add_link_options(-lubsan)
		endif()
	endif()
	if(DEFINED ENV{USE_GCOV})
		add_compile_options(-fprofile-arcs -ftest-coverage --coverage)
		add_link_options(--coverage)
	endif()
endif()

#cet_report_compiler_flags()

find_package(messagefacility REQUIRED EXPORT QUIET)
find_package(fhiclcpp REQUIRED EXPORT QUIET)
find_package(cetlib REQUIRED EXPORT QUIET)
find_package(Boost QUIET COMPONENTS filesystem thread REQUIRED EXPORT)
find_package(TRACE REQUIRED EXPORT)

# Debug streamer.
string(TOUPPER ${CMAKE_BUILD_TYPE} BTYPE_UC)
if(BTYPE_UC STREQUAL DEBUG)
  add_definitions(-DDEBUGME)
endif()

cet_register_export_set(SET_NAME artdaq_utilities NAMESPACE artdaq_utilities)

# source
add_subdirectory(artdaq-utilities)

# utility scripts/tools
add_subdirectory(script)

# testing
add_subdirectory(test)

# Useful tools and scripts for building ARTDAQ on Jenkins
add_subdirectory(for_jenkins)

# doc - Documentation
if ( NOT DEFINED ENV{DISABLE_DOXYGEN} )
add_subdirectory(doc)
endif()

# CMake module files used by artdaq-utilities packages
FILE(COPY Modules DESTINATION .)
INSTALL(DIRECTORY Modules DESTINATION .)

cet_cmake_config()
