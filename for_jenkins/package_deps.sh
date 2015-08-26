#!/bin/bash

# JCF, 8/26/15

# package_deps.sh will determine the list of packages on which the
# target package (i.e., the package passed at the command line)
# depends. In this regard, it's not unlike the "ups depend" command,
# except that (A) it doesn't require that you have all packages built
# and installed already, and (B) it doesn't go "all the way down" -
# meaning, if a package is found in the "irreducible_list" variable,
# the packages on which it depends won't be pursued. Most of the
# packages in this list don't depend on anything beyond gcc anyway,
# with the exception of art - the reason art isn't studied is simply
# because this script is intended as an aid toward editing the
# CMakeLists.txt file in build-framework, and it's assumed that the
# packages on which art depends in that file are already up-to-date.


if [ $# != 3 ] ; then
     echo "Usage: $0 <packagename> <version> <qualifiers (just a \"-\" if there aren't any)>"
     exit 1
fi

target_package=$1
target_version=$2
target_qualifiers=$3

if [[ -n $qualifiers ]]; then
    echo "Searching for packages on which ${target_package} ${target_version} -q ${target_qualifiers} depends"
else
    echo "Searching for packages on which ${target_package} ${target_version} depends"
fi

basedir=$PWD

packagearray=""


function errmsg() {
    local msg=$1
    echo $msg >&2
    exit 1
}

which parse_product_deps.py || \
    errmsg "Unable to find needed \"parse_product_deps.py\" script in executable paths (check PATH variable)"

function package_dep() {

    local package=$1
    local version=$2
    local qualifiers=$3

    echo
    echo
    echo "Inside package_dep for $package $version ${qualifiers}, have packagearray = \"$packagearray\""

    if [[ "$packagearray" =~ " $package " ]] && ! [[ "$packagearray" =~ " $version " ]]; then
        echo "Error in package_deps.sh: version conflict found for package $package (a version other than $version has already been stored)" >&2
        exit 1
    elif [[ "$packagearray" =~ " $package " ]]; then
	echo "$package has already been processed"
	return
    else
	packagearray=${packagearray}" $package $version "
    fi

    if [[ -n "$qualifiers" ]]; then
	echo "Searching for packages on which $package version $version with qualifiers $qualifiers depends"
    else
	echo "Searching for packages on which $package version $version depends"
    fi

    # NOTE THE WHITESPACE BEFORE THE FIRST TOKEN AND AFTER THE LAST

    local irreducible_list=" art mpich mvapich2 artdaq_ganglia_plugin TRACE smc_compiler cetbuildtools xmlrpc_c artdaq_utilities "

    if [[ "$irreducible_list" =~ " $package " ]]; then
	echo "Found match for $package in $irreducible_list"
	return
    else
	echo "Did not find match for \" $package \" in \"${irreducible_list}\""
    fi

    # If the package isn't "irreducible", we'll need to find the
    # packages on which it immediately depends by checking out the
    # package and examining its product_deps file

    tmpdir=${basedir}/$( uuidgen )

    mkdir $tmpdir || errmsg "Problem creating $tmpdir"

    cd $tmpdir
    no_underscore_package=$(echo $package | tr "_" "-") # "_"'s in package names are replaced with "_" in ups


    git clone http://cdcvs.fnal.gov/projects/${no_underscore_package} || \
	errmsg "Problem cloning http://cdcvs.fnal.gov/projects/$no_underscore_package"

    cd $no_underscore_package
    git checkout $version || \
	errmsg "Problem performing git checkout on (possibly nonexistent) tag $version"
    cd ..
    
    cmd="parse_product_deps.py ${no_underscore_package}/ups/product_deps $package $version $qualifiers"

    while read packageinfo; do
	
	packagename=$(echo $packageinfo | sed -r 's/^(\S+):.*/\1/' )
	packageversion=$(echo $packageinfo | sed -r 's/^\S+:\s*(\S+).*/\1/' )
	packagequals=$(echo $packageinfo | sed -r 's/^\S+:\s*\S+\s+(\S+).*/\1/' )

	package_dep $packagename $packageversion $packagequals
    done < <( $cmd )
    
    rm -rf $tmpdir
}

package_dep $target_package $target_version $target_qualifiers

echo "Final packagearray is: $packagearray"
