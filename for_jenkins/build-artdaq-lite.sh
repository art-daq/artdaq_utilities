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
demo_build=${DEMO_BUILD}
copyback_deps=${COPYBACK_DEPS}

IFS_save=$IFS
IFS=":"
read -a qualarray <<<"$qual_set"
IFS=$IFS_save
basequal=
squal=

# Remove shared memory segments which have 0 nattach
killall art && sleep 5 && killall -9 art
killall transfer_driver
for key in `ipcs|grep " $USER "|grep " 0 "|awk '{print $1}'`;do ipcrm -M $key;done

for qual in ${qualarray[@]};do
	case ${qual} in
        e*) basequal=${qual} ;;
        c*) basequal=${qual} ;;
        s*) squal=${qual} ;;
	esac
done

if [[ "x$squal" == "x" ]] || [[ "x$basequal" == "x" ]]; then
	echo "unexpected qualifier set ${qual_set}"
	usage
	exit 1
fi

basequal_dash=$basequal

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
curl --fail --silent --location --insecure -O http://scisoft.fnal.gov/scisoft/bundles/tools/buildFW || exit 1
chmod +x buildFW

mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1
# pulling binaries is allowed to fail
# we pull what we can so we don't have to build everything
./pullProducts ${blddir} ${flvr} artdaq-${version} ${squal}-${basequal_dash} ${build_type}

echo
echo "begin build"
echo
export CTEST_OUTPUT_ON_FAILURE=1
./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} artdaq-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }
 if [[ "${demo_build}" != "false" ]]; then
./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} artdaq_demo-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }
 fi
source ${blddir}/setups
upsflavor=`ups flavor`
echo "Fix Manifests"

artManifest=`ls ${blddir}/art-*_MANIFEST.txt|tail -1`
artdaqManifest=`ls ${blddir}/artdaq-*_MANIFEST.txt|tail -1`
demoManifest=`ls ${blddir}/artdaq_demo-*_MANIFEST.txt|tail -1`

cat ${artManifest} >>${artdaqManifest}
cat ${artdaqManifest}|grep -v source|grep -v mrb|sort|uniq >>${artdaqManifest}.tmp
mv ${artdaqManifest}.tmp ${artdaqManifest}

if [ -f ${demoManifest} ];then
   cat ${artdaqManifest} >>${demoManifest}
   cat ${demoManifest}|grep -v source|sort|uniq >>${demoManifest}.tmp
   mv ${demoManifest}.tmp ${demoManifest}
fi

if [ $copyback_deps == "false" ]; then
  echo "Removing non-bundle products"
  for file in ${blddir}/*.bz2;do
    filebase=`basename $file`
    if [[ "${filebase}" =~ "artdaq" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "epics" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "qt" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "mrb" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "swig" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "hdf5" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "mongodb" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "nodejs" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "TRACE" ]]; then
        echo "Not deleting ${filebase}"
    else
        echo "Deleting ${filebase}"
	    rm -f $file
    fi
  done
  rm -f ${blddir}/art-*_MANIFEST.txt
fi

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
