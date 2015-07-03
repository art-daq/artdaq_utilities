#!/bin/env bash

if [[ "$#" != "1" ]]; then
    echo "Usage: ./"$(basename $0)" <packagename>"
    echo "Also make sure that the packages of interest are installed in the directories referred to by \$PRODUCTS"
    exit 0
fi

packagename=$1
build_target_package="1"  # Set to "0" if this has already been done
			  # in the products directory or directories,
			  # "1" if you'd like the scripts to attempt
			  # the build

branch="for_art_v1_14" # The branch in build-framework from whose HEAD
		       # we'll edit the CMakeLists.txt file




# Save the output from this script for posterity

alloutput_file=$( date | awk -v "SCRIPTNAME=$(basename $0)" '{print SCRIPTNAME"_"$1"_"$2"_"$3"_"$4".script"}' )

stderr_file=$( date | awk -v "SCRIPTNAME=$(basename $0)" '{print SCRIPTNAME"_"$1"_"$2"_"$3"_"$4"_stderr.script"}' )

exec  > >(tee $alloutput_file)
exec 2> >(tee $stderr_file)


if [[ -z $PRODUCTS ]]; then
    echo "You don't appear to have any products directories set up"
    echo "All packages (including $1) must be installed in the products directories; exiting..."
    exit 1
else
    echo "PRODUCTS = $PRODUCTS"
    sleep 5
fi

if [[ ! -e $packagename ]]; then
    echo "I don't see $packagename so I'll git clone it"
    git clone ssh://p-${packagename}@cdcvs.fnal.gov/cvs/projects/${packagename}
    
    if [[ "$?" != "0" ]]; then
	echo "Error: problem cloning $packagename"
	exit 1
    fi
fi

# Grab all the qualifiers in the ups/product_deps file

qualifier_list=$(uuidgen)

# The following set of sed commands essentially takes all the
# qualifiers in the first column of the block of text between
# "qualifier" and "end_qualifier_list" in the ups/product_deps file,
# strips away the debug/prof parts of the qualifier, makes sure there
# are no repeated qualifiers, and then stashes them in a temporary
# file referred to here as "qualifier_list"

cat $packagename/ups/product_deps | \
sed -rn '/^\s*qualifier\s+/,/\s*end_qualifier_list/p' | \
sed -r '1d;$d' | \
sed -r 's/^\s*(\S+).*/\1/' | \
sed -r 's/:debug//' | \
sed -r 's/:prof//' | \
# grep -v ":ib" | \
awk 'seen[$0]++' > $qualifier_list

# If you want to manually set the qualifiers, comment out the "cat" of
# the product_deps file above, uncomment this following section, and
# edit it accordingly

#cat <<EOF > $qualifier_list
#e7:s11:eth
#e7:s8:eth
#e7:s7:eth
#EOF

failed_qualifiers=$(uuidgen)

while read qualifiers ; do

    $(dirname $0)/create_jenkins_build.sh $packagename $branch $build_target_package $qualifiers

    if [[ "$?" != "0" ]]; then
	echo "There was a problem trying to create the buildcfg and source files for $packagename with qualifiers $qualifiers" >&2
	echo $qualifiers >> $failed_qualifiers
    else

	for file in build_build-framework/art_externals/${packagename}-* ; do
	    mv $file $(basename $file).${qualifiers}
	done
    fi

done < $qualifier_list

manifest_filename=$( ls -1 $pkg*-source_MANIFEST.txt.* | head -1 | sed -r "s/($pkg.*\.txt).*$/\1/" )
buildcfg_filename=$( ls -1 $pkg*-buildcfg* | head -1 | sed -r "s/($pkg.*)\..*/\1/" )

cat ${packagename}*-source_MANIFEST.txt.* | sort -n | uniq > $manifest_filename
cp -p $(ls -1 $pkg*-buildcfg* | head -1 ) $buildcfg_filename

echo "Build configuration file is $buildcfg_filename"
echo "Source manifest file is $manifest_filename"


if [[ -s $failed_qualifiers ]]; then
    echo "Unable to correctly process $packagename for the following qualifier combinations: "
    cat $failed_qualifiers
    echo
    echo "Please find a system where $packagename is installed for these qualifiers, and run \"ups depend\" to manually determine dependencies"
    
fi

rm -f $qualifier_list
rm -f $failed_qualifiers
