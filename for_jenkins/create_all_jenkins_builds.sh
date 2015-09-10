#!/bin/env bash

if [[ "$#" < "2" || "$#" > "3" ]]; then
    echo "Usage: ./"$(basename $0)" <packagename> <packageversion> (qualifier list)"
    exit 0
fi

packagename=$1
upspackagename=$( echo $packagename | tr "-" "_")

packageversion=$2

qualifier_list=$3

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

# Grab all the qualifiers in the ups/product_deps file if a qualifier list wasn't supplied

if [[ -z "$qualifier_list" ]]; then

qualifier_list="qualifier_list_full.txt"

# The following set of sed commands essentially takes all the
# qualifiers in the first column of the block of text between
# "qualifier" and "end_qualifier_list" in the ups/product_deps file,
# strips away the debug/prof parts of the qualifier, makes sure there
# are no repeated qualifiers, and then stashes them in a temporary
# file referred to here as "qualifier_list"

set +C

cat $packagename/ups/product_deps | \
sed -r -n '/^\s*qualifier\s+/,/\s*end_qualifier_list/p' | \
sed -r '1d;$d' | \
sed -r '/^[ #\t]+/d' | \
sed -r '/^$/d' | \
sed -r 's/^\s*(\S+).*/\1/' | \
sed -r 's/:debug//' | \
sed -r 's/:prof//' | \
grep -v ":ib" | \
awk 'seen[$0]++' > $qualifier_list
fi

set -C

failed_qualifiers=$(uuidgen)
passed_qualifiers=$(uuidgen)

while read qualifiers ; do

    echo "QUALIFIER SET: $qualifiers"
    $(dirname $0)/create_jenkins_build.sh $packagename $packageversion $qualifiers

    if [[ "$?" != "0" ]]; then
	echo "There was a problem trying to create the buildcfg and source files for $packagename with qualifiers $qualifiers" >&2
	echo $qualifiers >> $failed_qualifiers
	continue
    else

	echo $qualifiers >> $passed_qualifiers

	for file in build_build-framework/art_externals/${upspackagename}-*  ; do
	    echo From ${PWD}, mv $file $(basename $file).${qualifiers}
	    set +C
	    mv $file $(basename $file).${qualifiers}
	    set -C
	done
    fi

done < $qualifier_list

manifest_filename=$( ls -1 ${upspackagename}*-source_MANIFEST.txt.* | tail -1 | sed -r "s/(${upspackagename}.*\.txt).*$/\1/" )
buildcfg_filename=$( ls -1 ${upspackagename}*-buildcfg* | tail -1 | sed -r "s/(${upspackagename}.*)\..*/\1/" )

cat ${upspackagename}*-source_MANIFEST.txt.* | sort -n | uniq > $manifest_filename

set +C
cp -p $(ls -1 ${upspackagename}*-buildcfg* | tail -1 ) $buildcfg_filename
set -C

echo
echo "Edits (if any) performed on artdaq-utilities; please commit them so Jenkins can see them"
cd artdaq-utilities
git diff
cd ..
echo
echo "Build configuration file is $buildcfg_filename - pls. check to ensure it supports all relevant art versions"
echo "Source manifest file is $manifest_filename"
echo

echo "Successfully processed qualifier combinations (if any):"

if [[ -e $passed_qualifiers ]]; then
    cat $passed_qualifiers
fi

echo
echo "Unsuccessfully processed qualifier combinations (if any):" >&2

if [[ -e $failed_qualifiers ]]; then
    cat $failed_qualifiers >&2
fi

rm -f $failed_qualifiers
rm -f $passed_qualifiers
