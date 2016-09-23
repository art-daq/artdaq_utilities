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
demo_version=${ARTDAQ_DEMO_VERSION}

case ${qual_set} in
    s21:e9)
	basequal=e9
	squal=s21
	artver=v1_17_03
	;;
    s34:e10)
	basequal=e10
	squal=s34
	artver=v1_17_08
	;;
    s35:e10)
	basequal=e10
	squal=s35
	artver=v2_01_02
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

case ${demo_version} in
   v2_08_03)
    artdaq_ver=v1_13_02
    ;;
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

echo "building the artdaq_demo distribution for ${version} ${dotver} ${qual_set} ${build_type}"

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
#./pullProducts ${blddir} source artdaq_demo-${demo_version}

mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1
# pulling binaries is allowed to fail
# we pull what we can so we don't have to build everything
./pullProducts ${blddir} ${flvr} art-${artver} ${basequal} ${build_type}
./pullProducts ${blddir} ${flvr} artdaq-${artdaq_ver} ${squal}-${basequal} ${build_type}
./pullProducts ${blddir} ${flvr} artdaq_demo-${demo_version} ${squal}-${basequal} ${build_type}
#./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} artdaq_demo-${demo_version}
set +x
source ./setups
set -x

# Remove any artdaq_database that came with the bundle
if [ -d ${blddir}/artdaq_database ]; then
  echo "Removing ${blddir}/artdaq_database"
  rm -rf ${blddir}/artdaq_database
fi

echo
echo "begin build"
echo
git clone http://cdcvs.fnal.gov/projects/artdaq-utilities-database ${srcdir}/artdaq-database
cd ${srcdir}/artdaq-database
git checkout master
cd ${blddir}
if [[ "${build_type}" == "prof" ]]; then
  build_flag="-p"
else
  build_flag="-d"
fi
set +x
source ${srcdir}/artdaq-database/ups/setup_for_development ${build_flag} ${basequal} ${squal}

ups active
buildtool -cp 2>&1 |tee build_artdaq-database.log || \
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
