#!/bin/env bash

# Expectations in this script are as follows:

# 1) Usage is:

# ./create_jenkins_build.sh \
# <name of target package> \
# <version of target package> \
# <commit hash, tag or branch for the build-framework package version you want> \
# <the colon-separated qualifier list>


if [[ "$#" != "4" ]]; then
    echo "Usage: ./"$(basename $0)" <packagename> <packageversion> <build-framework commit hash, tag or branch> <colon-separated qualifier list>" 
    exit 0
fi

packagename=$1
upspackagename=$( echo $packagename | tr "-" "_")
packageversion=$2


build_framework_commit=$3
package_all_quals_colondelim=$4

# Since we'll be creating temporary directories, checking out
# packages, etc., we don't want to be in the directory structure of
# the artdaq-utilities package itself

res=$( echo $PWD | sed -r -n '/\/artdaq-utilities\//p' )

if [[ -n "$res" ]]; then
    echo "Directory you're in (${PWD}) appears to be part of the artdaq-utilities package itself; please execute this script outside of the package so as not to confuse git" >&2
    exit 1
fi


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

if [[ ! -e $scriptdir/package_deps.sh ]]; then
    echo "Unable to find package_deps.sh in $scriptdir" >&2
    exit 1
fi

# Assumption below in the awk script which filters the output of
# package_deps.sh is that we want to see all remaining lines in the
# output that appears after the line containing "Final packagearray
# is"

# Also, cetbuildtools is removed as this is not properly a package on
# which the target package will depend, and
# artdaq_ganglia_plugin/artdaq_utilities are removed as this does not
# appear in build-framework's CMakeLists.txt file

tmpfile=$(uuidgen)

$scriptdir/package_deps.sh $packagename $packageversion $package_all_quals_colondelim 2>&1 | \
    tee $tmpfile

cat $tmpfile | \
grep -v cetbuildtools | \
grep -v artdaq_ganglia_plugin | \
grep -v artdaq_utilities | \
awk '/Final packagearray is/{showline=1;next}showline' > $packagedepsfile

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
	    echo "JCF, 8/26/15 - is this actually an error?"
	    cleanup
	    exit 1
	fi

	sedstring="s/(.*create_product_variables.*\(\s*)${package}\s+\S+(.*)/\1${package}  ${version}\2/";

	sed -r -i "$sedstring" CMakeLists.txt 2>&1 > /dev/null
	    
    fi

done < $packagedepsfile

# Since all the packages listed in CMakeLists.txt that the target
# package depends on are the versions we expect, now update the target
# package version in the CMakeLists.txt file

sedstring="s/(.*create_product_variables.*\(\s*)${upspackagename}\s+\S+(.*)/\1${upspackagename}  ${packageversion}\2/";
echo $sedstring
sed -r -i "$sedstring" CMakeLists.txt

# Add a commit to build-framework here after a prompt?

# Now that we've got build-framework's CMakeLists.txt file, run cmake

cd ..
mkdir -p build_build-framework

# Is it necessary to explicitly check whether cmake actually works?

cd build_build-framework
cmake ../build-framework

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

    insert_at_line=$( cat -n $buildfile | sed -r -n "$sedstring" | awk '{print $1}')
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

    nutools_art_listing=$( sed -r -n 's/.*\s+art\s+.*(v[0-9]_[0-9][0-9]_[0-9][0-9]).*/\1/p' nu-${nv}.html )
    rm -f nu-${nv}.html
    echo $nutools_art_listing
}


main $@
