1#!/bin/bash

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
copyback_deps=${COPYBACK_DEPS}

IFS_save=$IFS
IFS=":"
read -a qualarray <<<"$qual_set"
IFS=$IFS_save
basequal=
squal=
pyflag=
build_db=1

# Remove shared memory segments which have 0 nattach
killall art && sleep 5 && killall -9 art
killall transfer_driver
for key in `ipcs|grep " $USER "|grep " 0 "|awk '{print $1}'`;do ipcrm -M $key;done

for qual in ${qualarray[@]};do
    case ${qual} in
        e*) basequal=$qual;;
	c*) basequal=$qual;;
        py*) pyflag=$qual;;
        s*) squal=$qual;;
        nodb) build_db=0;;
    esac
done
export build_db

if [[ "x$squal" == "x" ]] || [[ "x$basequal" == "x" ]]; then
	echo "unexpected qualifier set ${qual_set}"
	usage
	exit 1
fi

wget https://raw.githubusercontent.com/art-daq/artdaq_demo/develop/ups/product_deps && \
artdaq_ver=`grep "^artdaq " product_deps|awk '{print $2}'` || \
$(echo "Unexpected version ${version}" && usage && exit 1)
rm product_deps
echo "Building against artdaq version ${artdaq_ver}"

basequal_dash=$basequal${pyflag:+-${pyflag}}

case ${build_type} in
    debug) ;;
    prof) ;;
    *)
	echo "ERROR: build type must be debug or prof"
	usage
	exit 1
esac

dotver=`echo ${version} | sed -e 's/_/./g' | sed -e 's/^v//'`
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
curl --fail --silent --location --insecure -O http://scisoft.fnal.gov/scisoft/bundles/tools/buildFW || exit 1
chmod +x buildFW

mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1

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
if [ -d ${blddir}/artdaq_mpich_plugin ]; then
  echo "Removing ${blddir}/artdaq_mpich_plugin"
  rm -rf ${blddir}/artdaq_mpich_plugin
  if [ `ls -l ${blddir}/artdaq_mpich_plugin*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_mpich_plugin*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_demo_hdf5 ]; then
  echo "Removing ${blddir}/artdaq_demo_hdf5"
  rm -rf ${blddir}/artdaq_demo_hdf5
  if [ `ls -l ${blddir}/artdaq_demo_hdf5*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_demo_hdf5*.tar.bz2; fi
fi

echo
echo "begin build"
echo
./buildFW -t -b ${basequal} ${pyflag:+-l ${pyflag}} -s ${squal} ${blddir} ${build_type} artdaq_demo-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }

source ${blddir}/setups
upsflavor=`ups flavor`
echo "Fix Manifests"

artdaqDemoManifest=`ls ${blddir}/artdaq_demo-*_MANIFEST.txt|tail -1`

cat ${artdaqDemoManifest}|grep -v source|sort|uniq >>${artdaqDemoManifest}.tmp
mv ${artdaqDemoManifest}.tmp ${artdaqDemoManifest}

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
