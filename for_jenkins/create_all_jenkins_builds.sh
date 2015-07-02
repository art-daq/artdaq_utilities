#!/bin/env bash

if [[ "$#" != "1" ]]; then
    echo "Usage: ./"$(basename $0)" <packagename>"
    exit 0
fi

packagename=$1

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
awk 'seen[$0]++' > $qualifier_list

# grep -v ":ib" | \

echo "PRODUCTS = $PRODUCTS"
sleep 5

while read qualifiers ; do

    echo $(dirname $0)/create_jenkins_build.sh $packagename for_art_v1_14 1 $qualifiers
    $(dirname $0)/create_jenkins_build.sh $packagename for_art_v1_14 1 $qualifiers

    if [[ "$?" != "0" ]]; then
	echo "There was a problem trying to create the buildcfg and source files for $packagename with qualifiers $qualifiers" >&2
    fi

    for file in build_build-framework/art_externals/${packagename}-* ; do
	mv $file $(basename $file).${qualifiers}
    done

done < $qualifier_list

rm -f $qualifier_list
