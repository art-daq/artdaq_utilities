#!/bin/env bash

if [[ "$#" != "3" ]]; then
    echo "Usage: ./"$(basename $0)" <packagename> <packageversion> <colon-separated qualifier list>" 
    exit 0
fi

packagename=$1
upspackagename=$( echo $packagename | tr "-" "_")
packageversion=$2

package_all_quals_colondelim=$3

source "$(dirname "$0")"/utils.sh

safety_check

basedir=$PWD

scriptdir=$(dirname $0)
if [[ "$scriptdir" =~ ".." || "$scriptdir" =~ "." ]]; then

    echo "I see an indication of a relative path (\".\" or \"..\") in ${scriptdir}; prepending $PWD"
    scriptdir=$PWD/$(dirname $0)
fi


buildfile=artdaq-utilities/for_jenkins/build-${upspackagename}.sh
edited_buildfile=${basedir}/$(uuidgen)

# This file will contain the list of packages (and their versions)
# which the target package depends on

packagedepsfile=${basedir}/$(uuidgen)

# The version and qualifier variables for the target package are filled via the
# "parse_package_info" function

package_e_qual=
package_s_qual=

# Using a "main" function to store the main program flow is basically
# a way to use functions which haven't yet been defined, making this
# script more readable

function main() {

package_e_qual=$( echo $package_all_quals_colondelim | sed -r 's/.*(e[0-9]+).*/\1/' )
package_s_qual=$( echo $package_all_quals_colondelim | sed -r 's/.*(s[0-9]+).*/\1/' )
    
echo "I think you want a Jenkins build of $packagename $packageversion," \
    "build qualifiers $package_all_quals_colondelim"

[[ -e $scriptdir/package_deps.sh ]] || errmsg "Unable to find package_deps.sh in $scriptdir"

checkout_directory=$basedir/jenkins_product_deps_dir

if [[ ! -e $checkout_directory ]]; then
    mkdir $checkout_directory
fi

# Assumption below in the awk script which filters the output of
# package_deps.sh is that we want to see all remaining lines in the
# output that appears after the line containing "Final packagearray
# is"

# Also, cetbuildtools is removed as this is not properly a package on
# which the target package will depend, and
# artdaq_ganglia_plugin/artdaq_utilities/artdaq_epics_plugin are removed as this does not
# appear in build-framework's CMakeLists.txt file

# Finally: note that the output of package_deps.sh is sent into a
# temporary file rather than directly into bunch of pipes; this is
# because we want to test its error code, not the error code of the
# last pipe'd command

cmd="$scriptdir/package_deps.sh $packagename $packageversion $package_all_quals_colondelim $checkout_directory"

tmpfile=$(uuidgen)
$cmd 2>&1 > $tmpfile

if [[ "$?" == "0" ]]; then 
    cat $tmpfile | \
	grep -v cetbuildtools | \
	grep -v artdaq_ganglia_plugin | \
	grep -v artdaq_epics_plugin | \
	grep -v artdaq_utilities | \
	awk '/Final packagearray is/{showline=1;next}showline' > $packagedepsfile
    rm -f $tmpfile
else
    rm -f $tmpfile
    cleanup
    errmsg "Problem executing \"$cmd\""
fi


major_art_version=$( sed -r -n 's/^art\s+(v[0-9]_[0-9]{2}).*/\1/p' $packagedepsfile )
full_art_version=$( sed -r -n 's/^art\s+(v[0-9]_[0-9]{2}_[0-9]+).*/\1/p' $packagedepsfile )

if [[ "$major_art_version" == "v2_01" ]]; then
    build_framework_branch="master"
elif [[ "$major_art_version" == "v2_00" ]]; then
    build_framework_branch="for_art_v2_00"
elif [[ "$major_art_version" == "v1_19" ]]; then
    build_framework_branch="for_art_v1_19"
elif [[ "$major_art_version" == "v1_18" ]]; then
    build_framework_branch="for_art_v1_18"
elif [[ "$major_art_version" == "v1_17" ]]; then
    build_framework_branch="for_art_v1_17"
elif [[ "$major_art_version" == "v1_16" ]]; then
    build_framework_branch="for_art_v1_16"
elif [[ "$major_art_version" == "v1_15" ]]; then
    build_framework_branch="for_art_v1_15"
elif [[ "$major_art_version" == "v1_14" ]]; then
    build_framework_branch="for_art_v1_14"
elif [[ "$major_art_version" == "v1_13" ]]; then
    build_framework_branch="for_art_v1_13"
else
    cleanup
    errmsg "Unable to determine the art version"
fi

# Now, check out artdaq-utilities, and edit the package's
# corresponding build file if necessary (meaning, if the particular
# build qualification in question isn't yet supported, automatically
# add a code snippet which WILL support it)

if [[ ! -e artdaq-utilities ]]; then

    git clone ssh://p-artdaq-utilities@cdcvs.fnal.gov/cvs/projects/artdaq-utilities || \
	( cleanup; errmsg "Problem cloning artdaq-utilities!" )
fi

[[ -e $buildfile ]] || (cleanup; errmsg "Unable to find ${buildfile}!")

edit_buildfile

if [[ ! -e build-framework ]]; then

    # Read-only checkout - don't yet have write access to build-framework!

    git clone http://cdcvs.fnal.gov/projects/build-framework || \
	( cleanup; errmsg "Problem cloning build-framework!" )
fi

cd build-framework
git reset HEAD --hard

git checkout $build_framework_branch || \
    (cleanup; errmsg "Problem with git checkout $build_framework_commit in build-framework" )

commits_ago="-1"

for i in {0..100}; do 
    res=$( git show HEAD~${i}:CMakeLists.txt | grep -E "\(\s*art\s+${full_art_version}" )
    
    if [[ -n $res ]]; then 
	commits_ago=$i; 
	break; 
    fi; 
done

[[ "$commits_ago" != "-1" ]] || \
    errmsg "Unable to determine where on the $build_framework_branch branch of build-framework the CMakeLists.txt file for art $full_art_version is"

echo "Will try to descend $commits_ago commits down the $build_framework_branch of build-framework"
git checkout HEAD~${i} || errmsg "Problem descending $commits_ago commits down the $build_framework_branch of build-framework"


# Make sure that all packages (except the target package) are what we
# expect them to be in build-framework's CMakeLists.txt file

while read line ; do

    package=$( echo $line | awk '{print $1}' )
    version=$( echo $line | awk '{print $2}' )

    echo $package $version
    
    underscored_package=$( echo $package | tr "-" "_" )

    if [[ "${underscored_package}" != "$upspackagename" ]]; then

	grepstring="create_product_variables\s*\(\s*${underscored_package}\s*"
	res=$( grep -E "$grepstring" CMakeLists.txt )

	[[ "$res" != "" ]] || \
	    ( cleanup; errmsg "Error: unable to find ${underscored_package} $version among the create_product_variables calls in $PWD/CMakeLists.txt" )

	sedstring="s/(.*create_product_variables.*\(\s*)${underscored_package}\s+\S+(.*)/\1${underscored_package}  ${version}\2/";

	sed -r -i "$sedstring" CMakeLists.txt 2>&1 > /dev/null
    fi

done < $packagedepsfile

# Since all the packages listed in CMakeLists.txt that the target
# package depends on are the versions we expect, now update the target
# package version in the CMakeLists.txt file

sedstring="s/(.*create_product_variables.*\(\s*)${upspackagename}\s+\S+(.*)/\1${upspackagename}  ${packageversion}\2/";
sed -r -i "$sedstring" CMakeLists.txt

# Now that we've got build-framework's CMakeLists.txt file, run cmake

cd ..
mkdir -p build_build-framework

cd build_build-framework
cmake ../build-framework || \
    (cleanup; errmsg "Problem running cmake on build-framework!")

cleanup

cd $basedir

#ls -ltr build_build-framework/art_externals/${upspackagename}*

}

function cleanup() {
    rm -f $packagedepsfile
    rm -f $edited_buildfile
    rm -f $basedir/nu-*.html
}

function edit_buildfile() {
    
    # I'll need to give some careful thought to the possible permutations
    # of the build qualifiers
    
    possible_qualifiers="${package_e_qual} ${package_e_qual}:${package_s_qual} ${package_s_qual}:${package_e_qual}"

    for qual in $possible_qualifiers; do
	res=$( grep -r '^\s*'$qual'\s*)\s*$' $buildfile )
	
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

    # To fill in the body of the switch statement for the target
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

# Now construct a sed command which will append the new qualifiers
# after the "case ${qual_set} in" line in the build script - observe
# that since I'm putting the command in double quotes since variables
# need to be subbed in, I need to perform a combination of escapes for
# both the shell and for sed (with its "-r", extended regular
# expression, option)


sedstring="/case \\\$\{qual_set\} in/a\
    ${package_s_qual}:${package_e_qual})\n\
       basequal=${package_e_qual}\n\
       squal=${package_s_qual}\n\
       artver=${art_version}\n\
       nutoolsver=${nutools_version}\n\
       ;;\n\
 "

sed -r "$sedstring" $buildfile > $edited_buildfile

    echo "THE FOLLOWING EDIT WILL BE MADE TO $buildfile: "

    diff $buildfile $edited_buildfile
    cp $edited_buildfile $buildfile
}

function get_art_from_nutools() {

    local nv=$1

    wget --quiet http://scisoft.fnal.gov/scisoft/bundles/nu/${nv}/nu-${nv}.html

    if [[ ! -e nu-${nv}.html ]]; then
	echo "Problem grabbing http://scisoft.fnal.gov/scisoft/bundles/nu/${nv}/nu-${nv}.html"
    fi

    nutools_art_listing=$( sed -r -n 's/.*\s+art\s+.*(v[0-9]_[0-9][0-9]_[0-9][0-9]).*/\1/p' nu-${nv}.html )
    rm -f nu-${nv}.html
    echo $nutools_art_listing
}


main $@
