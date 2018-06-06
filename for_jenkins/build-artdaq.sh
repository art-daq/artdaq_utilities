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
nu_flag=0
basequal=
squal=
artver=

# Remove shared memory segments which have 0 nattach
killall art && sleep 5 && killall -9 art
killall transfer_driver
for key in `ipcs|grep " $USER "|grep " 0 "|awk '{print $1}'`;do ipcrm -M $key;done

for qual in ${qualarray[@]};do
	case ${qual} in
		e14)
			basequal=e14
			;;
        e15)
            basequal=e15
            ;;
		e17)
			basequal=e17
			;;
        c2)
            basequal=c2
            ;;
		nu)
			nu_flag=1
			;;
		s50)
			squal=s50
			artver=v2_07_03
            ;;
        s64)
            squal=s64
            artver=v2_10_02
            ;;
        s65)
            squal=s65
            artver=v2_10_03
            ;;
        s67)
            squal=s67
            artver=v2_11_01
            ;;
		esac
done

if [[ "x$squal" == "x" ]] || [[ "x$basequal" == "x" ]]; then
	echo "unexpected qualifier set ${qual_set}"
	usage
	exit 1
fi

basequal_dash=$basequal
if [ $nu_flag -eq 1 ];then
    basequal_dash=$basequal-nu
fi

case ${build_type} in
    debug) ;;
    prof) ;;
    *)
	echo "ERROR: build type must be debug or prof"
	usage
	exit 1
esac

dotver=`echo ${version} | sed -e 's/_/./g' | sed -e 's/^v//'`
artdotver=`echo ${artver} | sed -e 's/_/./g' | sed -e 's/^v//'`

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
./pullProducts ${blddir} ${flvr} art-${artver} ${basequal_dash} ${build_type}
if [ $nu_flag -eq 1 ] && [[ "x$nuver" != "x" ]];then ./pullProducts ${blddir} ${flvr} nu-${nuver} ${squal}-${basequal} ${build_type}; fi
./pullProducts ${blddir} ${flvr} artdaq-${version} ${squal}-${basequal_dash} ${build_type}
# remove any artdaq entities that were pulled so it will always be rebuilt
if [ -d ${blddir}/artdaq_utilities ]; then
  echo "Removing ${blddir}/artdaq_utilities"
  rm -rf ${blddir}/artdaq_utilities
  if [ `ls -l ${blddir}/artdaq_utilities*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_utilities*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq_core ]; then
  echo "Removing ${blddir}/artdaq_core"
  rm -rf ${blddir}/artdaq_core
  if [ `ls -l ${blddir}/artdaq_core*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq_core*.tar.bz2; fi
fi
if [ -d ${blddir}/artdaq ]; then
  echo "Removing ${blddir}/artdaq"
  rm -rf ${blddir}/artdaq
  if [ `ls -l ${blddir}/artdaq*.tar.bz2 | wc -l` -gt 0 ]; then rm -fv ${blddir}/artdaq*.tar.bz2; fi
fi

echo
echo "begin build"
echo
export CTEST_OUTPUT_ON_FAILURE=1
if [ $nu_flag -eq 0 ];then
./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} artdaq-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }
else
 # Build the nu version
./buildFW -t -b ${basequal} -l nu -s ${squal} ${blddir} ${build_type} artdaq-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }
fi

source ${blddir}/setups
upsflavor=`ups flavor`
echo "Fix Manifests"

artManifest=`ls ${blddir}/art-*_MANIFEST.txt|tail -1`
artdaqManifest=`ls ${blddir}/artdaq-*_MANIFEST.txt|tail -1`

cat ${artManifest} >>${artdaqManifest}
cat ${artdaqManifest}|grep -v source|sort|uniq >>${artdaqManifest}.tmp
mv ${artdaqManifest}.tmp ${artdaqManifest}

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
