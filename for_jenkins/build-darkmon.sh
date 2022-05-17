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
version=${MYVER}
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

for qual in ${qualarray[@]};do
    case ${qual} in
        e*) basequal=$qual;;
        c*) basequal=$qual;;
        py*) pyflag=$qual;;
        s*) squal=$qual;;
    esac
done

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
curl --fail --silent --location --insecure -O http://scisoft.fnal.gov/scisoft/bundles/tools/buildFW || exit 1
chmod +x buildFW

mv ${blddir}/*source* ${srcdir}/

cd ${blddir} || exit 1

# remove any darkmon and darksidecore entities that were pulled so
# that they will always be rebuilt
if [ -d ${blddir}/darksidecore ]; then
  echo "Removing ${blddir}/darksidecore"
  rm -rf ${blddir}/darksidecore
fi
if [ `ls -1 ${blddir}/darksidecore*.tar.bz2 | wc -l 2>/dev/null` -gt 0 ]; then
  rm -fv ${blddir}/darksidecore*.tar.bz2
fi
if [ -d ${blddir}/darkmon ]; then
  echo "Removing ${blddir}/darkmon"
  rm -rf ${blddir}/darkmon
fi
if [ `ls -1 ${blddir}/darkmon*.tar.bz2 | wc -l 2>/dev/null` -gt 0 ]; then
  rm -fv ${blddir}/darkmon*.tar.bz2
fi

echo
echo "begin build"
echo
./buildFW -t -b ${basequal} ${pyflag:+-l ${pyflag}} -s ${squal} ${blddir} ${build_type} darkmon-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }
 
source ${blddir}/setups
upsflavor=`ups flavor`
echo "Fix Manifests"

artManifest=`ls ${blddir}/art-*_MANIFEST.txt|tail -1`
galleryManifest=`ls ${blddir}/gallery-*_MANIFEST.txt|tail -1`
darkmonManifest=`ls ${blddir}/darkmon-*_MANIFEST.txt|tail -1`

cat ${artManifest} >>${darkmonManifest}
cat ${galleryManifest} >>${darkmonManifest}

cat ${darkmonManifest}|grep -v source|sort|uniq >>${darkmonManifest}.tmp
mv ${darkmonManifest}.tmp ${darkmonManifest}

if [ $copyback_deps == "false" ]; then
  echo "Removing non-bundle products"
  for file in ${blddir}/*.bz2;do
    filebase=`basename $file`
    if [[ "${filebase}" =~ "darksidecore" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "darkmon" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "pqxx" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "artdaq_core" ]]; then
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
