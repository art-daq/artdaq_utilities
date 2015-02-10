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
target_env=${TARGET_ENV}

case ${qual_set} in
  s6:e6) 
     basequal=e6
     squal=s6
     artver=v1_12_05
     nutoolsver=v1_07_02
  ;;
  s5:e6) 
     basequal=e6
     squal=s5
     artver=v1_12_04
     nutoolsver=v1_07_00
  ;;
  s6:e5) 
     basequal=e5
     squal=s6
     artver=v1_12_05
     nutoolsver=v1_07_02
  ;;
  s5:e5) 
     basequal=e5
     squal=s5
     artver=v1_12_04
     nutoolsver=v1_07_00
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

echo "building the lbne_raw_data distribution for ${version} ${dotver} ${qual_set} ${build_type} ${target_env}"

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
./pullProducts ${blddir} source lbne_raw_data-${version} || \
      { cat 1>&2 <<EOF
ERROR: pull of lbne_raw_data-${version} failed
EOF
        exit 1
      }
mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1
# pulling binaries is allowed to fail
# we pull what we can so we don't have to build everything
if [ "${target_env}" == "offline" ]; then
  ./pullProducts ${blddir} ${flvr} nu-${nutoolsver} ${squal}-${basequal} ${build_type}
  ./pullProducts ${blddir} ${flvr} lbne_raw_data-${version} ${squal}-${basequal}-nu ${build_type}
else
  ./pullProducts ${blddir} ${flvr} art-${artver} ${basequal} ${build_type}
  ./pullProducts ${blddir} ${flvr} lbne_raw_data-${version} ${squal}-${basequal} ${build_type}
fi
# remove any lbne_raw_data entities that were pulled so it will always be rebuilt
if [ -d ${blddir}/lbne_raw_data ]; then
  echo "Removing ${blddir}/lbne_raw_data"
  rm -rf ${blddir}/lbne_raw_data
fi
if [ `ls -1 ${blddir}/lbne_raw_data*.tar.bz2 | wc -l 2>/dev/null` -gt 0 ]; then
  rm -fv ${blddir}/lbne_raw_data*.tar.bz2
fi

# pull cetbuildtools v4_05_00 specially
cd ${blddir} || exit 1
mytar="cetbuildtools-4.05.00-noarch.tar.bz2"
mydist="http://scisoft.fnal.gov/scisoft/packages/cetbuildtools/v4_05_00/${mytar}"
echo "pull ${mytar}"
curl --fail --silent --location --insecure -O ${mydist}
tar -xf ${mytar}

echo
echo "begin build"
echo
if [ "${target_env}" == "offline" ]; then
  mv buildFW buildFW.orig
  cp ../artdaq-utilities/for_jenkins/buildFW .
  ./buildFW -t -b ${basequal}:nu -s ${squal} ${blddir} ${build_type} lbne_raw_data-${version} || \
   { mv ${blddir}/*.log  $WORKSPACE/copyBack/
     exit 1 
   }
else
  ./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} lbne_raw_data-${version} || \
   { mv ${blddir}/*.log  $WORKSPACE/copyBack/
     exit 1 
   }
fi

echo
echo "move files"
echo
mv ${blddir}/*.bz2  $WORKSPACE/copyBack/
mv ${blddir}/*.txt  $WORKSPACE/copyBack/
mv ${blddir}/*.log  $WORKSPACE/copyBack/

exit 0
