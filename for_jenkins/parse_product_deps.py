#!/bin/env python

# JCF, 5/26/15

# The purpose of this script is to parse a product_deps file for a
# given package, and determine the immediate packages on which is
# depends given its qualifier list

import sys, os, re

if not len(sys.argv) == 5:
    sys.exit("Usage: " + sys.argv[0] + " <filename> <package> <version> <colon-delimited qualifiers>") 


def standardize_quals(qualstring):
    tokens = qualstring.split(":")
    return ":".join( sorted([ tok for tok in tokens \
                                  if tok != "prof" and tok != "debug"]) )

filename = sys.argv[1]
target_package = sys.argv[2]
target_version = sys.argv[3]
target_quals = standardize_quals(sys.argv[4])

    
package_version_dict = {}
package_column_dict = {}

inf = open(filename)

in_dependent_list = False
in_qualifier_list = False

found_quals = False

for line in inf.readlines():
    
    res = re.search(r"^product[ \t]+version[ \t]+optional", line)

    if res:
        in_dependent_list = True
        continue

    res = re.search(r"end_product_list", line)

    if res:
        in_dependent_list = False
        continue

    res = re.search(r"^qualifier[ \t]+", line)

    if res:
        in_qualifier_list = True
        for i, label in enumerate(line.split()):
            if label != "qualifier" and label != "notes":
                package_column_dict[label] = i
        continue

    res = re.search(r"end_qualifier_list", line)
    
    if res:
        in_qualifier_list = False
        continue

    if in_dependent_list:

        skip_package = False

        line.lstrip()
        tokens = line.split()

        if len(tokens) == 0:
            continue # Blank line

        # If the version of a package the target package depends
        # corresponds to a different qualifier than the target
        # package's qualifiers, skip the line

        if len(tokens) > 2:
            quals = tokens[2].split(":")

            for qual in quals:
                if qual != "-" and qual not in target_quals :
                    skip_package = True

            if skip_package:
                continue
            
        package, version = tokens[0:2]
    
        # Since we don't yet know the qualifier set, assign it a "-"

        if package not in package_version_dict:
            package_version_dict[ package ] = [version, "-"]
    
        continue

    if in_qualifier_list:
        tokens = line.split()
        quals = standardize_quals(tokens[0])

        # We have the line we want, so now figure out the qualifiers
        # of the packages on which the target package depends

        if quals == target_quals:

            found_quals = True

            for package, column in package_column_dict.items():
                if package_version_dict[ package ][1] == "-":

                    # In the qualifier section of the product_deps
                    # file, a "-" means "this package isn't used", a
                    # "-nq-" means "this package IS used, but has no
                    # qualifiers, and anything else is to be taken as
                    # a typical qualifier list

                    possible_quals = standardize_quals( tokens[ package_column_dict[ package ] ] )

                    if possible_quals == "-": 
                        del package_version_dict[ package ]
                    elif possible_quals != "-nq-":
                        package_version_dict[ package ][1] = possible_quals
            break

if not found_quals:
    sys.stderr.write( "Error in parse_product_deps.py: unable to find qualifiers %s in product_deps file %s\n" % (target_quals, filename))
    sys.exit(1)

for package, info in package_version_dict.items():
    version, qualifier = info
    print "%s: %s %s" % (package, version, qualifier)



