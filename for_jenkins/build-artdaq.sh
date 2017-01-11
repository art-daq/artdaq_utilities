#!/bin/bash

# build in $WORKSPACE/build
# copyback directory is $WORKSPACE/copyBack

usage()
{
  cat 1>&2 <<EOF
Usage: $(basename ${0}) [-h]

Options:

  -h    This help.

EOF
}

working_dir=${WORKSPACE}
version=${VERSION}
qual_set="${QUAL}"
build_type=${BUILDTYPE}

case ${qual_set} in
s44:e10)
basequal=e10
squal=s44
artver=v2_04_01
;;
s43:e10)
       basequal=e10
       squal=s43
       artver=v2_05_00
       nutoolsver=v2_06_02
       ;;
	s41:e10)
	basequal=e10
	squal=s41
	artver=v2_03_00
    ;;
    *)
	echo "unexpected qualifier set ${qual_set}"
	usage
	exit 1
esac

case ${build_type} in
    debug) ;;
    prof) ;;
    *)
	echo "ERROR: build type must be debug or prof"
	usage
	exit 1
esac

dotver=`echo ${version} | sed -e 's/_/./g' | sed -e 's/^v//'`

echo "building the artdaq distribution for ${version} ${dotver} ${qual_set} ${build_type}"

OS=`uname`
if [ "${OS}" = "Linux" ]
then
    flvr=slf`lsb_release -r | sed -e 's/[[:space:]]//g' | cut -f2 -d":" | cut -f1 -d"."`
elif [ "${OS}" = "Darwin" ]
then
  flvr=d`uname -r | cut -f1 -d"."`
else 
  echo "ERROR: unrecognized operating system ${OS}"
  exit 1
fi
echo "build flavor is ${flvr}"
echo ""

qualdir=`echo ${qual_set} | sed -e 's%:%-%'`

set -x

srcdir=${working_dir}/source
blddir=${working_dir}/build
# start with clean directories
rm -rf ${blddir}
rm -rf ${srcdir}
rm -rf $WORKSPACE/copyBack 
# now make the dfirectories
mkdir -p ${srcdir} || exit 1
mkdir -p ${blddir} || exit 1
mkdir -p $WORKSPACE/copyBack || exit 1

cd ${blddir} || exit 1
curl --fail --silent --location --insecure -O http://scisoft.fnal.gov/scisoft/bundles/tools/pullProducts || exit 1
chmod +x pullProducts
# source code tarballs MUST be pulled first
./pullProducts ${blddir} source artdaq-${version} || \
      { cat 1>&2 <<EOF
ERROR: pull of artdaq-${version} failed
EOF
        exit 1
      }
./pullProducts ${blddir} source art-${artver} || \
    { cat 1>&2 <<EOF
WARNING: Could not pull art-${artver}, this may not be fatal (but probably is)
EOF
}

mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1
# pulling binaries is allowed to fail
# we pull what we can so we don't have to build everything
./pullProducts ${blddir} ${flvr} art-${artver} ${basequal} ${build_type}
./pullProducts ${blddir} ${flvr} artdaq-${version} ${squal}-${basequal} ${build_type}
# remove any artdaq entities that were pulled so it will always be rebuilt
if [ -d ${blddir}/artdaq/${version}.version ]; then
  echo "Removing ${blddir}/artdaq/${version}.version"
  rm -rf ${blddir}/artdaq/${version}.version
fi
if [ -d ${blddir}/artdaq/${version} ]; then
  echo "Removing ${blddir}/artdaq/${version}"
  rm -rf ${blddir}/artdaq/${version}
fi
if [ `ls -1 ${blddir}/artdaq*${dotver}*.tar.bz2 | wc -l` -gt 0 ]; then
  rm -fv ${blddir}/artdaq*${dotver}*.tar.bz2
fi

echo
echo "begin build"
echo
./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} artdaq-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }

echo "Fix Manifests"
cat art-${artver}-*-${basequal}-${build_type}_MANIFEST.txt >>artdaq-${version}-*-${squal}-${basequal}-${build_type}_MANIFEST.txt
cat artdaq-${version}-*-${squal}-${basequal}-${build_type}_MANIFEST.txt|sort|uniq >>artdaq-${version}-*-${squal}-${basequal}-${build_type}_MANIFEST.txt.tmp
mv artdaq-${version}-*-${squal}-${basequal}-${build_type}_MANIFEST.txt{.tmp,}

echo
echo "move files"
echo
mv ${blddir}/*.bz2  $WORKSPACE/copyBack/
mv ${blddir}/*.txt  $WORKSPACE/copyBack/
mv ${blddir}/*.log  $WORKSPACE/copyBack/

exit 0
