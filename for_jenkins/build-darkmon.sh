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
  e6) 
     basequal=e6
     artver=v1_12_05
  ;;
  e5) 
     basequal=e5
     artver=v1_12_05
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

echo "building the darkmon distribution for ${version} ${dotver} ${qual_set} ${build_type}"

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
./pullProducts ${blddir} source darkmon-${version} || \
      { cat 1>&2 <<EOF
ERROR: pull of darkmon-${version} failed
EOF
        exit 1
      }
mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1
# pulling binaries is allowed to fail
# we pull what we can so we don't have to build everything
./pullProducts ${blddir} ${flvr} art-${artver} ${basequal} ${build_type}
./pullProducts ${blddir} ${flvr} darkmon-${version} ${basequal} ${build_type}
# remove any darkmon and darksidecore entities that were pulled so
# that they will always be rebuilt
if [ -d ${blddir}/darksidecore/${version}.version ]; then
  echo "Removing ${blddir}/darksidecore/${version}.version"
  rm -rf ${blddir}/darksidecore/${version}.version
fi
if [ -d ${blddir}/darksidecore/${version} ]; then
  echo "Removing ${blddir}/darksidecore/${version}"
  rm -rf ${blddir}/darksidecore/${version}
fi
if [ `ls -1 ${blddir}/darksidecore*${dotver}*.tar.bz2 | wc -l` -gt 0 ]; then
  rm -fv ${blddir}/darksidecore*${dotver}*.tar.bz2
fi
if [ -d ${blddir}/darkmon/${version}.version ]; then
  echo "Removing ${blddir}/darkmon/${version}.version"
  rm -rf ${blddir}/darkmon/${version}.version
fi
if [ -d ${blddir}/darkmon/${version} ]; then
  echo "Removing ${blddir}/darkmon/${version}"
  rm -rf ${blddir}/darkmon/${version}
fi
if [ `ls -1 ${blddir}/darkmon*${dotver}*.tar.bz2 | wc -l` -gt 0 ]; then
  rm -fv ${blddir}/darkmon*${dotver}*.tar.bz2
fi

echo
echo "begin build"
echo
./buildFW -t -b ${basequal} ${blddir} ${build_type} darkmon-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }

echo
echo "move files"
echo
mv ${blddir}/*.bz2  $WORKSPACE/copyBack/
mv ${blddir}/*.txt  $WORKSPACE/copyBack/
mv ${blddir}/*.log  $WORKSPACE/copyBack/

exit 0
