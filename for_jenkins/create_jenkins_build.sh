#!/bin/env bash

# Expectations in this script are as follows:

# 1) The head of the master branch for the target package contains the
# version for which we want to perform a Jenkins build

# 2) ups is setup s.t. the target package and its dependencies are all
# installed in the products directories

if [[ "$#" != "2" ]]; then
    echo "Usage: $0 <packagename> <build-framework commit hash or tag>"
    exit 0
fi

if [[ "$PRODUCTS" == "" ]]; then
    echo "You don't appear to have any products directories set up"
    echo "All packages (including $1) must be installed in the products directories; exiting..."
    exit 1
fi

basedir=$PWD

packagename=$1
upspackagename=$( echo $packagename | tr "-" "_")

build_framework_commit=$2
#build_framework_commit=c7b33da4209d83040180c60a71322acbab5a3188

buildfile=artdaq-utilities/for_jenkins/build-${upspackagename}.sh
edited_buildfile=$(uuidgen)

# This file will contain the result of the "ups depend" command run on
# the target package

packagedepsfile=$(uuidgen)

# The version and qualifiers for the target package are found via the
# "parse_package_info" function

packageversion=
package_e_qual=
package_s_qual=



# Using a "main" function to store the main program flow is basically
# a way to use functions which haven't yet been defined, making this
# script more readable

function main() {

# Check out the package if it's not already there, and deduce the
# version and build qualifiers from the head of the master branch

# "if-then" is for devel
if [[ ! -e $packagename ]]; then
    git clone http://cdcvs.fnal.gov/projects/$packagename
fi

if [[ "$?" != "0" ]]; then
    echo "Problem attempting git clone of $packagename" >&2
    exit 1
fi

cd $packagename
git checkout master
cd ..

parse_package_info $packagename

echo "I think you want a Jenkins build of $packagename $packageversion," \
"build qualifier ${package_e_qual}:${package_s_qual}"

# Use the "ups depend" command to find all the versions of the
# packages, and then save them in a temporary file. Please note that
# if ups depend doesn't find versions of the needed packages, it
# doesn't return nonzero -- thus we need to search the output for the
# token "ERROR"

ups depend $upspackagename v$packageversion -q prof:${package_e_qual}:${package_s_qual} 2>&1 | 
sed -r 's/^[_| ]+(\S+)\s+(\S+).*/\1 \2/' | 
awk '!seen[$0]++'  | 
tee $packagedepsfile

if [[ "$( grep ERROR $packagedepsfile )" != "" ]]; then
    echo "Please make sure all packages are installed in the products directories"
    echo "PRODUCTS = $PRODUCTS"
#    rm -f $packagedepsfile
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
    exit 1
fi

if [[ ! -e $buildfile ]]; then
    echo "Unable to find ${buildfile}!"
    exit 1
fi

edit_buildfile

if [[ ! -e build-framework ]]; then

    # Developer checkout only - don't yet have write access to build-framework!

    git clone http://cdcvs.fnal.gov/projects/build-framework
fi

if [[ "$?" != "0" ]]; then
    echo "Problem cloning build-framework!"
    exit 1
fi

cd build-framework
git checkout $build_framework_commit

# Make sure that all packages (except the target package) are what we
# expect them to be in build-framework's CMakeLists.txt file

while read line ; do

    package=$( echo $line | awk '{print $1}' )
    version=$( echo $line | awk '{print $2}' )

    if [[ "$package" != "$upspackagename" ]]; then
	grepstring="create_product_variables\s*\(\s*$package\s*$version"
	res=$( egrep "$grepstring" CMakeLists.txt )

	if [[ "$res" == "" ]]; then
	    echo "Error: unable to find $package $version in the create_product_variables call in $PWD/CMakeLists.txt"
	    exit 1
	fi
    fi

done < $basedir/$packagedepsfile

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

# Is it necessary to check whether cmake actually works?

cd build_build-framework
cmake ../build-framework


# Cleanup
rm -f $packagedepsfile
rm -f $edit_buildfile

}

function parse_package_info() {

    depsfile=${packagename}/ups/product_deps

    # For devel
    if [[ ! -e $depsfile ]]; then
	echo "Problem finding $depsfile!"
	exit 1
    fi

    sedstring='s!^\s*parent\s+'${upspackagename}'\s+v([0-9_]+)\s*$!\1!p'
    packageversion=$( sed -rn "$sedstring" $depsfile )

    echo "packageversion = ${packageversion}"

    sedstring='s!^\s*defaultqual.*(e[0-9]+).*!\1!p'
    package_e_qual=$( sed -rn "$sedstring" $depsfile)

    sedstring='s!^\s*defaultqual.*(s[0-9]+).*!\1!p'
    package_s_qual=$( sed -rn "$sedstring" $depsfile)
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

    #echo "res is $res"

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

    wget http://scisoft.fnal.gov/scisoft/bundles/nu/
    nutools_version=$( grep "v._.._.." index.html | tail -1 | sed -r 's/.*(v[0-9]_[0-9][0-9]_[0-9][0-9]).*/\1/')

    echo "I think the nutools version needed is $nutools_version"

    # Crosscheck: let's see if we find the expected version of art
    # listed in the nutools file...
    
    wget http://scisoft.fnal.gov/scisoft/bundles/nu/${nutools_version}/nu-${nutools_version}.html

    if [[ ! -e nu-${nutools_version}.html ]]; then
	echo "Problem grabbing http://scisoft.fnal.gov/scisoft/bundles/nu/${nutools_version}/nu-${nutools_version}.html"
	exit 1
    fi

    nutools_art_listing=$( sed -rn 's/.*\s+art\s+.*(v[0-9]_[0-9][0-9]_[0-9][0-9]).*/\1/p' nu-${nutools_version}.html )

    if [[ $nutools_art_listing != $art_version ]]; then
	echo "Expected to find art version $art_version in nu-${nutools_version}.html ; found $nutools_art_listing instead"
	exit 1
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

    echo "THE FOLLOWING EDIT WAS MADE: "

    diff $buildfile $edited_buildfile
    sleep 0

}

main $@
