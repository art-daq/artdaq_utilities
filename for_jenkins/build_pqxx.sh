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

IFS_save=$IFS
IFS=":"
read -a qualarray <<<"$qual_set"
IFS=$IFS_save
basequal=
pyqual=

for key in `ipcs|grep " $USER "|grep " 0 "|awk '{print $1}'`;do ipcrm -M $key;done

for qual in ${qualarray[@]};do
	case ${qual} in
		e*) basequal=$qual;;
		c*) basequal=$qual;;
		p*)	pyqual=$qual;;
		esac
done

if [[ "x$basequal" == "x" ]]; then
	echo "unexpected qualifier set ${qual_set}"
	usage
	exit 1
fi

case ${build_type} in
	debug) ;;
	prof) ;;
	*)
	echo "ERROR: build type must be debug or prof"
	usage
	exit 1
esac

echo "building the pqxx distribution for ${version} ${qual_set} ${build_type}"

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
./pullProducts ${blddir} ${flvr} pqxx-${version} ${pyqual}-${basequal} ${build_type}
# remove any pqxx entities that were pulled so it will always be rebuilt
if [ -d ${blddir}/pqxx ]; then
  echo "Removing ${blddir}/pqxx"
  rm -rf ${blddir}/pqxx
  if [ `ls -l ${blddir}/pqxx*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/pqxx*.tar.bz2; fi
fi

echo
echo "begin build"
echo
export CTEST_OUTPUT_ON_FAILURE=1

./buildFW -t -b ${basequal} -l ${pyqual} ${blddir} ${build_type} pqxx-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }

 for file in ${blddir}/*.bz2;do
    filebase=`basename $file`
    if [[ "${filebase}" =~ "pqxx" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "postgresql" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "python" ]]; then
        echo "Not deleting ${filebase}"
    elif [[ "${filebase}" =~ "sqlite" ]]; then
        echo "Not deleting ${filebase}"
    else
        echo "Deleting ${filebase}"
		sed -i "/${filebase}/d" *_MANIFEST.txt
	    rm -f $file
    fi
  done

source ${blddir}/setups
upsflavor=`ups flavor`
echo "Fix Manifests"

pqxxManifest=`ls ${blddir}/pqxx-*_MANIFEST.txt|tail -1`

cat ${pqxxManifest}|grep -v source|sort|uniq >>${pqxxManifest}.tmp
mv ${pqxxManifest}.tmp ${pqxxManifest}

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
