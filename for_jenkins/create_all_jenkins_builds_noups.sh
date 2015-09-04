#!/bin/env bash

if [[ "$#" != "2" ]]; then
    echo "Usage: ./"$(basename $0)" <packagename> <packageversion>"
    exit 0
fi

packagename=$1
upspackagename=$( echo $packagename | tr "-" "_")

packageversion=$2

# Save the output from this script for posterity

alloutput_file=$( date | awk -v "SCRIPTNAME=$(basename $0)" '{print SCRIPTNAME"_"$1"_"$2"_"$3"_"$4".script"}' )

stderr_file=$( date | awk -v "SCRIPTNAME=$(basename $0)" '{print SCRIPTNAME"_"$1"_"$2"_"$3"_"$4"_stderr.script"}' )

exec  > >(tee $alloutput_file)
exec 2> >(tee $stderr_file)

if [[ ! -e $packagename ]]; then
    echo "I don't see $packagename so I'll git clone it"
    git clone ssh://p-${packagename}@cdcvs.fnal.gov/cvs/projects/${packagename}
    
    if [[ "$?" != "0" ]]; then
	echo "Error: problem cloning $packagename" >&2 
	exit 1
    fi

    cd $packagename
    git checkout $packageversion

    if [[ "$?" != "0" ]]; then
	echo "Error: problem with checkout of $packageversion in $packagename ; could it be the tag doesn't exist?" >&2
	exit 1
    fi

    cd ..

fi

# Grab all the qualifiers in the ups/product_deps file- or set them
# manually, farther down this script

qualifier_list=$(uuidgen)

# The following set of sed commands essentially takes all the
# qualifiers in the first column of the block of text between
# "qualifier" and "end_qualifier_list" in the ups/product_deps file,
# strips away the debug/prof parts of the qualifier, makes sure there
# are no repeated qualifiers, and then stashes them in a temporary
# file referred to here as "qualifier_list"

# cat $packagename/ups/product_deps | \
# sed -r -n '/^\s*qualifier\s+/,/\s*end_qualifier_list/p' | \
# sed -r '1d;$d' | \
# sed -r 's/^\s*(\S+).*/\1/' | \
# sed -r 's/:debug//' | \
# sed -r 's/:prof//' | \
# #grep -v ":ib" | \
# awk 'seen[$0]++' > $qualifier_list

# If you want to manually set the qualifiers, comment out the "cat" of
# the product_deps file above, uncomment this following section, and
# edit it accordingly

cat <<EOF > $qualifier_list
e7:s8:eth
e7:s11:eth
e7:s14:eth
e6:s8:eth
e6:s11:eth
e6:s14:eth
EOF

failed_qualifiers=$(uuidgen)

while read qualifiers ; do

    echo "QUALIFIER SET: $qualifiers"
    $(dirname $0)/create_jenkins_build_noups.sh $packagename $packageversion $qualifiers

    if [[ "$?" != "0" ]]; then
	echo "There was a problem trying to create the buildcfg and source files for $packagename with qualifiers $qualifiers" >&2
	echo $qualifiers >> $failed_qualifiers
	continue
    else

	for file in build_build-framework/art_externals/${upspackagename}-*  ; do
	    echo From ${PWD}, mv $file $(basename $file).${qualifiers}
	    mv $file $(basename $file).${qualifiers}
	done
    fi

done < $qualifier_list

manifest_filename=$( ls -1 ${upspackagename}*-source_MANIFEST.txt.* | tail -1 | sed -r "s/(${upspackagename}.*\.txt).*$/\1/" )
buildcfg_filename=$( ls -1 ${upspackagename}*-buildcfg* | tail -1 | sed -r "s/(${upspackagename}.*)\..*/\1/" )

cat ${upspackagename}*-source_MANIFEST.txt.* | sort -n | uniq > $manifest_filename
cp -p $(ls -1 ${upspackagename}*-buildcfg* | tail -1 ) $buildcfg_filename

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
