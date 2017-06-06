cmake_policy(VERSION 3.0.1)

include(FindDoxygen)
include(FindLATEX)

SET(DOXYFILE_DIR ${CMAKE_CURRENT_LIST_DIR})

function(create_pdf_documentation)
	find_package(LATEX COMPONENTS PDFLATEX PS2PDF MAKEINDEX)
	if(LATEX_FOUND)
	add_custom_command(OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/latex/API_Documentation.pdf
						   COMMAND make WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/latex 
					   COMMAND mv refman.pdf API_Documentation.pdf
				   DEPENDS ${product}_doc
				   COMMENT "Generating PDF API Documentation file" VERBATIM)
			   # ALL removed from this add_custom_target, as the PDF does not build correctly on woof
			   add_custom_target(${product}_pdf DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/latex/API_Documentation.pdf)
			   install(FILES ${CMAKE_CURRENT_BINARY_DIR}/latex/API_Documentation.pdf DESTINATION ${product}/${version}/doc/ OPTIONAL)
	endif(LATEX_FOUND)
endfunction()


macro (create_doxygen_documentation)
if(DOXYGEN_FOUND)
	configure_file(${DOXYFILE_DIR}/Doxyfile.in ${CMAKE_CURRENT_BINARY_DIR}/Doxyfile @ONLY)
	add_custom_command(OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/latex/refman.tex 
				  COMMAND ${DOXYGEN_EXECUTABLE} ${CMAKE_CURRENT_BINARY_DIR}/Doxyfile WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
					  COMMENT "Generating ${project} API documentation using Doxygen" VERBATIM)
	add_custom_target(${product}_doc ALL DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/latex/refman.tex)

	create_pdf_documentation()

	# install any documentation text files
	install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} DESTINATION ${product}/${version} 
		PATTERN "CMakeLists.txt" EXCLUDE
		)
		
	# install doxygen-generated HTML pages and MAN pages.
	install(DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/html DESTINATION ${product}/${version}/doc)
	file(COPY ${CMAKE_CURRENT_BINARY_DIR}/man DESTINATION ${LIBRARY_OUTPUT_PATH}/../share)
	install(DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/man DESTINATION ${${product}_lib_dir}/../share)
endif(DOXYGEN_FOUND)
endmacro()
