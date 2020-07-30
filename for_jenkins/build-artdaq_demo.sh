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
copyback_deps=${COPYBACK_DEPS}

IFS_save=$IFS
IFS=":"
read -a qualarray <<<"$qual_set"
IFS=$IFS_save
basequal=
squal=
artver=
pyflag=
build_db=1

# Remove shared memory segments which have 0 nattach
killall art && sleep 5 && killall -9 art
killall transfer_driver
for key in `ipcs|grep " $USER "|grep " 0 "|awk '{print $1}'`;do ipcrm -M $key;done

for qual in ${qualarray[@]};do
	case ${qual} in
        e15)
            basequal=e15
            ;;
		e17)
			basequal=e17
			;;
        e19)
            basequal=e19
            ;;
        c2)
            basequal=c2
            ;;
        c7)
            basequal=c7
            ;;
        py2)
            pyflag=py2
            ;;
        py3)
            pyflag=py3
            ;;
        s67)
            squal=s67
            artver=v2_11_01
            ;;
        s73)
            squal=s73
            artver=v2_11_05
            ;;
        s82)
            squal=s82
            artver=v3_02_04
            ;;
		s83)
			squal=s83
			artver=v3_02_05
			;;
		s85)
			squal=s85
			artver=v2_13_00
			;;
        s87)
            squal=s87
            artver=v3_03_00
            ;;
        s89)
            squal=s89
            artver=v3_03_01
            ;;
		s92)
			squal=s92
			artver=v3_02_06c
			;;
		s94)
			squal=s94
			artver=v3_04_00
			;;
        s96)
            squal=s96
            artver=v3_05_00
            ;;
        nodb)
            build_db=0
            ;;
		esac
done
export build_db

if [[ "x$squal" == "x" ]] || [[ "x$basequal" == "x" ]]; then
	echo "unexpected qualifier set ${qual_set}"
	usage
	exit 1
fi

wget https://cdcvs.fnal.gov/redmine/projects/artdaq-demo/repository/revisions/${version}/raw/ups/product_deps && \
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
curl --fail --silent --location --insecure -O http://scisoft.fnal.gov/scisoft/bundles/tools/buildFW || exit 1
chmod +x buildFW

mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1
# pulling binaries is allowed to fail
# we pull what we can so we don't have to build everything
#./pullProducts ${blddir} ${flvr} art-${artver} ${basequal_dash} ${build_type}
#./pullProducts ${blddir} ${flvr} artdaq-${artdaq_ver} ${squal}-${basequal_dash} ${build_type}
#./pullProducts ${blddir} ${flvr} artdaq_demo-${version} ${squal}-${basequal_dash} ${build_type}
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

artManifest=`ls ${blddir}/art-*_MANIFEST.txt|tail -1`
artdaqManifest=`ls ${blddir}/artdaq-*_MANIFEST.txt|tail -1`
artdaqDemoManifest=`ls ${blddir}/artdaq_demo-*_MANIFEST.txt|tail -1`

cat ${artManifest} >>${artdaqManifest}
cat ${artdaqManifest} >>${artdaqDemoManifest}
cat ${artdaqManifest}|grep -v source|grep -v mrb|sort|uniq >>${artdaqManifest}.tmp
mv ${artdaqManifest}.tmp ${artdaqManifest}
cat ${artdaqDemoManifest}|grep -v source|sort|uniq >>${artdaqDemoManifest}.tmp
mv ${artdaqDemoManifest}.tmp ${artdaqDemoManifest}

if [ $copyback_deps == "false" ]; then
  echo "Removing art bundle products"
  for file in ${blddir}/*.bz2;do
    if [[ "${file}" =~ "artdaq" ]]; then
        echo "Not deleting ${file}"
    elif [[ "${file}" =~ "nodejs" ]]; then
        echo "Not deleting ${file}"
    elif [[ "${file}" =~ "smc_compiler" ]]; then
        echo "Not deleting ${file}"
    elif [[ "${file}" =~ "swig" ]]; then
        echo "Not deleting ${file}"
    elif [[ "${file}" =~ "TRACE" ]]; then
        echo "Not deleting ${file}"
    elif [[ "${file}" =~ "xmlrpc" ]]; then
        echo "Not deleting ${file}"
    else
        echo "Deleting ${file}"
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
