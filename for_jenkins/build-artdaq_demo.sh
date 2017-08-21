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
	s50:e14)
		basequal=e14
		squal=s50
		artver=v2_07_03
		;;
    s48:e14)
        basequal=e14
        squal=s48
        artver=v2_06_03
        ;;
    s48:e10)
        basequal=e10
        squal=s48
        artver=v2_06_03
        ;;
    s47:e14)
        basequal=e14
        squal=s47
        artver=v2_06_02
        ;;
    s47:e10)
        basequal=e10
        squal=s47
        artver=v2_06_02
        ;;
    s46:e10)
        basequal=e10
        squal=s46
        artver=v2_06_01
        ;;
    s46:e14)
        basequal=e14
        squal=s46
        artver=v2_06_01
        ;;
    *)
	echo "unexpected qualifier set ${qual_set}"
	usage
	exit 1
esac

case ${version} in
  v2_09_00)
    artdaq_ver=v2_00_00
    ;;
  v2_09_01)
    artdaq_ver=v2_01_00
    ;;
  v2_09_02)
    artdaq_ver=v2_02_01
    ;;
  v2_09_03)
    artdaq_ver=v2_02_03
    ;;
  v2_10_00)
    artdaq_ver=v2_03_00
    ;;
  v2_10_01)
    artdaq_ver=v2_03_01
    ;;
v2_10_02)
    artdaq_ver=v2_03_02
    ;;
  *)
    echo "Unexpected artdaq_demo version ${version}"
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
art_dotver=`echo ${artver} | sed -e 's/_/./g' | sed -e 's/^v//'`
artdaq_dotver=`echo ${artdaq_ver} | sed -e 's/_/./g' | sed -e 's/^v//'`

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
# source code tarballs MUST be pulled first
./pullProducts ${blddir} source artdaq_demo-${version} || \
      { cat 1>&2 <<EOF
ERROR: pull of artdaq_demo-${version} failed
EOF
        exit 1
      }
./pullProducts ${blddir} source artdaq-${artdaq_ver} || \
    { cat 1>&2 <<EOF
WARNING: Could not pull artdaq-${artdaq_ver}, this may not be fatal (but probably is)
EOF
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
./pullProducts ${blddir} ${flvr} artdaq-${artdaq_ver} ${squal}-${basequal} ${build_type}
./pullProducts ${blddir} ${flvr} artdaq_demo-${version} ${squal}-${basequal} ${build_type}
# remove any artdaq_demo entities that were pulled so it will always be rebuilt
if [ -d ${blddir}/artdaq_demo ]; then
  echo "Removing ${blddir}/artdaq_demo"
  rm -rf ${blddir}/artdaq_demo
  if [ `ls -l ${blddir}/artdaq_demo*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_demo*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_ganglia_plugin ]; then
  echo "Removing ${blddir}/artdaq_ganglia_plugin"
  rm -rf ${blddir}/artdaq_ganglia_plugin
  if [ `ls -l ${blddir}/artdaq_ganglia_plugin*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_ganglia_plugin*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_epics_plugin ]; then
  echo "Removing ${blddir}/artdaq_epics_plugin"
  rm -rf ${blddir}/artdaq_epics_plugin
  if [ `ls -l ${blddir}/artdaq_epics_plugin*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_epics_plugin*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_mfextensions ]; then
  echo "Removing ${blddir}/artdaq_mfextensions"
  rm -rf ${blddir}/artdaq_mfextensions
  if [ `ls -l ${blddir}/artdaq_mfextensions*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_mfextensions*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_database ]; then
  echo "Removing ${blddir}/artdaq_database"
  rm -rf ${blddir}/artdaq_database
  if [ `ls -l ${blddir}/artdaq_database*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_database*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_daqinterface ]; then
  echo "Removing ${blddir}/artdaq_daqinterface"
  rm -rf ${blddir}/artdaq_daqinterface
  if [ `ls -l ${blddir}/artdaq_daqinterface*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_daqinterface*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_node_server ]; then
  echo "Removing ${blddir}/artdaq_node_server"
  rm -rf ${blddir}/artdaq_node_server
  if [ `ls -l ${blddir}/artdaq_node_server*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_node_server*.tar.bz2; fi
fi

echo
echo "begin build"
echo
./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} artdaq_demo-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }

source ${blddir}/setups
upsflavor=`ups flavor`
echo "Fix Manifests"
cat ${blddir}/art-${art_dotver}-${upsflavor}-${basequal}-${build_type}_MANIFEST.txt >>${blddir}/artdaq_demo-${dotver}-${upsflavor}-${squal}-${basequal}-${build_type}_MANIFEST.txt
cat ${blddir}/artdaq-${artdaq_dotver}-${upsflavor}-${squal}-${basequal}-${build_type}_MANIFEST.txt >>${blddir}/artdaq_demo-${dotver}-${upsflavor}-${squal}-${basequal}-${build_type}_MANIFEST.txt
cat ${blddir}/artdaq_demo-${dotver}-${upsflavor}-${squal}-${basequal}-${build_type}_MANIFEST.txt|sort|uniq >>${blddir}/artdaq_demo-${dotver}-${upsflavor}-${squal}-${basequal}-${build_type}_MANIFEST.txt.tmp
mv ${blddir}/artdaq_demo-${dotver}-${upsflavor}-${squal}-${basequal}-${build_type}_MANIFEST.txt{.tmp,}

echo
echo "move files"
echo
mv ${blddir}/*.bz2  $WORKSPACE/copyBack/
mv ${blddir}/*.txt  $WORKSPACE/copyBack/
mv ${blddir}/*.log  $WORKSPACE/copyBack/

echo
echo "cleanup"
echo
rm -rf ${blddir}
rm -rf ${srcdir}

exit 0
