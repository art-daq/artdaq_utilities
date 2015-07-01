#!/bin/env bash

# Expectations in this script are as follows:

# 1) Usage is:

# ./create_jenkins_build.sh \
# <name of target package> \
# <commit hash, tag or branch for the build-framework package version you want> \
# (optionally, a nonzero value indicating you want to build and install the target package in a local ./products directory)
# (optionally, a colon-separated qualifier list meant to override the default qualifier list in ups/product_deps)

# Furthermore:

# 2) The head of the master branch for the target package contains the
# version for which we want to perform a Jenkins build

# 3) ups is setup s.t. the packages the target package depends on are
# all installed in the directories found in the $PRODUCTS environment
# variable

# 4) If the target package isn't also already installed in one of
# those products directories, the user should supply a nonzero value
# (conventionally "1") as the third argument to the script

# 5) If the default qualifier list at the top of the ups/product_deps
# file isn't what's desired, then override it with colon-separated
# qualifiers as the fourth argument


if [[ "$#" < "2" || "$#" > "4" ]]; then
    echo "Usage: ./"$(basename $0)" <packagename> <build-framework commit hash, tag or branch> (nonzero value => build and install target package first) (colon-separated qualifier list override)" 
    exit 0
fi

if [[ -z $PRODUCTS ]]; then
    echo "You don't appear to have any products directories set up"
    echo "All packages (including $1) must be installed in the products directories; exiting..."
    exit 1
fi

basedir=$PWD

packagename=$1
upspackagename=$( echo $packagename | tr "-" "_")

build_framework_commit=$2

install_target_package=$3

buildfile=artdaq-utilities/for_jenkins/build-${upspackagename}.sh
edited_buildfile=${basedir}/$(uuidgen)

# This file will contain the result of the "ups depend" command run on
# the target package

packagedepsfile=${basedir}/$(uuidgen)

# The version and qualifier variables for the target package are filled via the
# "parse_package_info" function

packageversion=
package_e_qual=
package_s_qual=
package_all_quals_colondelim=$4
package_all_quals_spacedelim=



# Using a "main" function to store the main program flow is basically
# a way to use functions which haven't yet been defined, making this
# script more readable

function main() {

# Set up a pre-existing products directory (will use for "ups depend")

# Recall that we check at the start of the script to make sure PRODUCTS is set...
existing_products_dir=$( echo $PRODUCTS | tr ":" "\n" | head -1 )
	
if [[ -z $existing_products_dir ]]; then
    echo "Unable to locate a products directory!"
    exit 1
elif [[ ! -e $existing_products_dir ]]; then
    echo "Problem locating $existing_products_dir from $PWD"
    exit 1
fi

source $existing_products_dir/setup


# Check out the target package if it's not already there, and use
# parse_package_info to either deduce the version and build qualifiers
# from the ups/product_deps file at the head of the master branch, or
# from the optional qualifier override list passed to the script

if [[ ! -e $packagename ]]; then
    git clone http://cdcvs.fnal.gov/projects/$packagename
fi

if [[ "$?" != "0" ]]; then
    echo "Problem attempting git clone of $packagename" >&2
    cleanup
    exit 1
fi

cd $packagename
git checkout master
cd ..

parse_package_info $packagename

echo "I think you want a Jenkins build of $packagename $packageversion," \
"build qualifiers $package_all_quals_spacedelim (or, $package_all_quals_colondelim )"

echo
echo "If I'm wrong, you have 5 seconds to hit ctrl-C"

sleep 5

# Build and install the target package into a local ./products
# directory if that option was chosen at the command line

if [[ -n $install_target_package && "$install_target_package" != "0" ]]; then
    install_package    
fi

# Use the "ups depend" command to find all the versions of the
# packages, and then save them in a temporary file. Please note that
# if ups depend doesn't find versions of the needed packages, it
# doesn't return nonzero -- thus we need to search the output for the
# token "ERROR"

# The various piped commands below translate from the usual output of
# the "ups depend" command to output that looks like:

# <package1> <version1>
# <package2> <version2>
# ...ETC...

ups depend $upspackagename v$packageversion -q prof:${package_all_quals_colondelim} 2>&1 | 
sed -r 's/^[_| ]+(\S+)\s+(\S+).*/\1 \2/' | 
awk '!seen[$0]++'  | 
tee $packagedepsfile

if [[ "$( grep ERROR $packagedepsfile )" != "" ]]; then
    echo "Please make sure all packages are installed in the products directories"
    echo "PRODUCTS = $PRODUCTS"
    cleanup
    exit 1
fi

# Now, check out artdaq-utilities, and edit the package's
# corresponding build file if necessary (meaning, if the particular
# build qualification in question isn't yet supported, automatically
# add a code snippet which WILL support it)

if [[ ! -e artdaq-utilities ]]; then
    git clone ssh://p-artdaq-utilities@cdcvs.fnal.gov/cvs/projects/artdaq-utilities
fi

if [[ "$?" != "0" ]]; then
    echo "Problem cloning artdaq-utilities!"
    cleanup
    exit 1
fi

if [[ ! -e $buildfile ]]; then
    echo "Unable to find ${buildfile}!"
    cleanup
    exit 1
fi

edit_buildfile

if [[ ! -e build-framework ]]; then

    # Read-only checkout - don't yet have write access to build-framework!

    git clone http://cdcvs.fnal.gov/projects/build-framework
fi

if [[ "$?" != "0" ]]; then
    echo "Problem cloning build-framework!"
    cleanup
    exit 1
fi

cd build-framework
git checkout $build_framework_commit

if [[ "$?" != "0" ]]; then
    echo "Problem with git checkout $build_framework_commit in build-framework"
    cleanup
    exit 1
fi

# Make sure that all packages (except the target package) are what we
# expect them to be in build-framework's CMakeLists.txt file

while read line ; do

    package=$( echo $line | awk '{print $1}' )
    version=$( echo $line | awk '{print $2}' )

    echo $package $version

    if [[ "$package" != "$upspackagename" ]]; then

	grepstring="create_product_variables\s*\(\s*$package\s*"
	res=$( egrep "$grepstring" CMakeLists.txt )

	if [[ "$res" == "" ]]; then
	    echo "Error: unable to find $package $version among the create_product_variables calls in $PWD/CMakeLists.txt"
	    cleanup
	    exit 1
	fi

	sedstring="s/(.*create_product_variables.*)${package}\s+\S+(.*)/\1${package}  ${version}\2/";

	sed -ri "$sedstring" CMakeLists.txt 2>&1 > /dev/null
	    
    fi

done < $packagedepsfile

# Since all the packages listed in CMakeLists.txt that the target
# package depends on are the versions we expect, now update the target
# package version in the CMakeLists.txt file

sedstring="s/(.*create_product_variables.*)${upspackagename}\s+\S+(.*)/\1${upspackagename}  v${packageversion}\2/";
echo $sedstring
sed -ri "$sedstring" CMakeLists.txt

# Add a commit to build-framework here after a prompt?

# Now that we've got build-framework's CMakeLists.txt file, run cmake

cd ..
mkdir -p build_build-framework

# Is it necessary to explicitly check whether cmake actually works?

cd build_build-framework
cmake ../build-framework

cleanup

cd $basedir

ls -ltr build_build-framework/art_externals/${upspackagename}*

}

function cleanup() {
    rm -f $packagedepsfile
    rm -f $edited_buildfile
    rm -f $basedir/nu-*.html
}

function parse_package_info() {

    depsfile=${packagename}/ups/product_deps

    # For devel
    if [[ ! -e $depsfile ]]; then
	echo "Problem finding $depsfile!"
	cleanup
	exit 1
    fi

    sedstring='s!^\s*parent\s+'${upspackagename}'\s+v([0-9_]+)\s*$!\1!p'
    packageversion=$( sed -rn "$sedstring" $depsfile )

    echo "packageversion = ${packageversion}"

    # Only deduce the package qualifiers from the product_deps file if
    # they weren't already supplied as an argument to the script

    if [[ -z $package_all_quals_colondelim ]]; then
	sedstring='s!^\s*defaultqual\s+(\S+)\s*!\1!p'
	package_all_quals_colondelim=$( sed -rn "$sedstring" $depsfile)
    fi

    package_all_quals_spacedelim=$( echo $package_all_quals_colondelim | tr ":" " " )

    # And pluck out the e-qualifier (compiler version) and s-qualifier (art version) (if applicable)

    package_e_qual=$( echo $package_all_quals_spacedelim | sed -r 's/.*(e[0-9]+).*/\1/' )
    package_s_qual=$( echo $package_all_quals_spacedelim | sed -r 's/.*(s[0-9]+).*/\1/' )

}


function edit_buildfile() {
    
    # I'll need to give some careful thought to the possible permutations
    # of the build qualifiers
    
    possible_qualifiers="${package_e_qual} ${package_e_qual}:${package_s_qual} ${package_s_qual}:${package_e_qual}"

    for qual in $possible_qualifiers; do
	echo "Checking $qual"
	res=$( grep -r '^\s*'$qual'\s*)$' $buildfile )
	
	if [[ "$res" != "" ]]; then
	    break
	fi

    done

    if [[ "$res" != "" ]]; then
	echo "It appears your build qualifier is already supported in ${buildfile}; no edits will be made"
	return
    fi

    # If we're here, it means that we didn't find the build qualifier,
    # so add it to the switch statement

    # First, copy the part of the original buildfile up to the line at
    # which the case statement is located, using some sleight-of-hand
    # which takes advantage of the "-n" option to the cat command

    sedstring='/case \$\{qual_set\} in/p'

    insert_at_line=$( cat -n $buildfile | sed -rn "$sedstring" | awk '{print $1}')
    echo "insert_at_line = $insert_at_line"

    head -${insert_at_line} $buildfile > $edited_buildfile

    # Next, to fill in the body of the switch statement for the target
    # package, we'll deduce the relevant art package the target
    # package depends on, as well as the nutools package corresponding
    # to that art version

    local art_version=$( egrep "art\s+" $packagedepsfile | awk '{print $2}' )
    echo "art version appears to be $art_version"

    # For the nutools version, we need to make it to the web...
    # Idea is that it's the last listed nutools which we want

    found_nutools="0"

    # This wget gets the index.html file, which we'll parse for available nutools versions
    wget http://scisoft.fnal.gov/scisoft/bundles/nu/

    nutools_versions=$basedir/$(uuidgen)
    
    grep "v._.._.." index.html | sed -r 's/.*(v[0-9]_[0-9][0-9]_[0-9][0-9]).*/\1/' > $nutools_versions

    while read nutools_version ; do
	nutools_art_version=$( get_art_from_nutools $nutools_version )
	
	if [[ $nutools_art_version == $art_version ]]; then
	    found_nutools="1"
	    break
	fi
    done < $nutools_versions

    rm -f $nutools_versions

    if [[ "$found_nutools" == "0" ]]; then
	echo "Unable to deduce the nutools version"
	cleanup
	exit 1
    else
	echo "Desired nutools version is $nutools_version"
    fi


    cat <<EOF >> $edited_buildfile
  ${package_s_qual}:${package_e_qual})
     basequal=${package_e_qual}
     squal=${package_s_qual}
     artver=${art_version}
     nutoolsver=${nutools_version}
  ;;
EOF

    total_lines=$(wc -l $buildfile | awk '{print $1}' )
    echo "total_lines = $total_lines"
    echo "insert_at_line = $insert_at_line"

    let "tail_lines = $total_lines - $insert_at_line"
    echo "tail_lines = $tail_lines"
    

    tail -${tail_lines} $buildfile >> $edited_buildfile

    echo "THE FOLLOWING EDIT WILL BE MADE TO $buildfile UNLESS YOU HIT ctrl-C IN THE NEXT 5 SECONDS: "

    diff $buildfile $edited_buildfile
    sleep 5
    cp $edited_buildfile $buildfile
}

function get_art_from_nutools() {

    local nv=$1

    wget --quiet http://scisoft.fnal.gov/scisoft/bundles/nu/${nv}/nu-${nv}.html

    if [[ ! -e nu-${nv}.html ]]; then
	echo "Problem grabbing http://scisoft.fnal.gov/scisoft/bundles/nu/${nv}/nu-${nv}.html"
    fi

    nutools_art_listing=$( sed -rn 's/.*\s+art\s+.*(v[0-9]_[0-9][0-9]_[0-9][0-9]).*/\1/p' nu-${nv}.html )
    rm -f nu-${nv}.html
    echo $nutools_art_listing
}

function install_package() {
    
    cd $basedir

    if [[ ! -e products ]]; then

	mkdir products
	cp -R $existing_products_dir/.upsfiles products
	export PRODUCTS=./products:${PRODUCTS}
	echo "PRODUCTS = $PRODUCTS"
    fi

    if [[ ! -e build_${packagename} ]]; then
	mkdir -p build_${packagename}
    fi

    cd build_${packagename}
    . ../$packagename/ups/setup_for_development -p ${package_all_quals_spacedelim}
    buildtool -c -j 40 -i -I ../products

    if [[ "$?" != "0" ]]; then
	echo "There was a problem trying to build $packagename"
	cleanup
	exit 1
    fi
}


main $@
