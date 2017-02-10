
# create package configuration and version files

process_ups_files()

if ( ${qualifier} MATCHES "-nq-" )
    set( VQUAL "" )
    set( FQUAL "" )
else ()
    STRING( REGEX REPLACE ":" "_" VQUAL "${${product}_full_qualifier}" )
    set( FQUAL "${${product}_full_qualifier}" )
endif()

CONFIGURE_FILE ( ${CMAKE_CURRENT_SOURCE_DIR}/${product}.current.in
                 ${CMAKE_CURRENT_BINARY_DIR}/${UPSFLAVOR}_${VQUAL}.current @ONLY )
INSTALL (FILES ${CMAKE_CURRENT_BINARY_DIR}/${UPSFLAVOR}_${VQUAL}.current
    DESTINATION ${product}/current.chain/
	RENAME ${UPSFLAVOR}_${VQUAL} )

cet_cmake_config()
