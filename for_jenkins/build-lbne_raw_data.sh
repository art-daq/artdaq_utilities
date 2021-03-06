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

s65:e15)
	basequal=e15
	squal=s65
	artver=v2_10_03
	nutoolsver=v2_19_00
	;;

s62:e15)
	basequal=e15
	squal=s62
	artver=v2_09_06
	nutoolsver=v2_17_02
	;;

s62:e14)
	basequal=e14
	squal=s62
	artver=v2_09_06
	nutoolsver=v2_17_02
	;;


s56:e14)
	basequal=e14
	squal=s56
	artver=v2_08_04
	nutoolsver=v2_16_06
	;;


s54:e14)
	basequal=e14
	squal=s54
	artver=v2_08_03
	nutoolsver=v2_16_03
	;;

s53:e14)
	basequal=e14
	squal=s53
	artver=v2_08_02
	nutoolsver=v2_16_01
	;;

s50:e14)
	basequal=e14
	squal=s50
	artver=v2_07_03
	nutoolsver=v2_13_03
	;;

s48:e10)
       basequal=e10
       squal=s48
       artver=v2_06_03
       nutoolsver=v2_12_00
       ;;
 
s48:e14)
       basequal=e14
       squal=s48
       artver=v2_06_03
       nutoolsver=v2_12_00
       ;;
 
s43:e10)
       basequal=e10
       squal=s43
       artver=v2_05_00
       nutoolsver=v2_06_02
       ;;
 
s43:e9)
       basequal=e9
       squal=s43
       artver=v2_05_00
       nutoolsver=v2_06_02
       ;;
 
s44:e10)
       basequal=e10
       squal=s44
       artver=v2_04_01
       nutoolsver=v2_06_01
       ;;
 
s44:e9)
       basequal=e9
       squal=s44
       artver=v2_04_01
       nutoolsver=v2_06_01
       ;;
 
s42:e10)
       basequal=e10
       squal=s42
       artver=v2_04_00
       nutoolsver=v2_05_00
       ;;
 
s42:e9)
       basequal=e9
       squal=s42
       artver=v2_04_00
       nutoolsver=v2_05_00
       ;;
 
s41:e10)
       basequal=e10
       squal=s41
       artver=v2_03_00
       nutoolsver=v2_03_01
       ;;
 
s41:e9)
       basequal=e9
       squal=s41
       artver=v2_03_00
       nutoolsver=v2_03_01
       ;;
 
s39:e10)
       basequal=e10
       squal=s39
       artver=v2_02_02
       nutoolsver=v2_03_00
       ;;
 
s39:e9)
       basequal=e9
       squal=s39
       artver=v2_02_02
       nutoolsver=v2_03_00
       ;;
 
s38:e10)
       basequal=e10
       squal=s38
       artver=v2_02_01
       nutoolsver=v2_02_00
       ;;
 
s38:e9)
       basequal=e9
       squal=s38
       artver=v2_02_01
       nutoolsver=v2_02_00
       ;;
 
s36:e10)
       basequal=e10
       squal=s36
       artver=v2_00_03
       nutoolsver=v2_00_01
       ;;
 
s36:e9)
       basequal=e9
       squal=s36
       artver=v2_00_03
       nutoolsver=v2_00_01
       ;;
 
s33:e10)
       basequal=e10
       squal=s33
       artver=v2_00_02
       nutoolsver=v2_00_00
       ;;
 
s33:e9)
       basequal=e9
       squal=s33
       artver=v2_00_02
       nutoolsver=v2_00_00
       ;;
 
s31:e9)
       basequal=e9
       squal=s31
       artver=v1_18_05
       nutoolsver=v1_25_00
       ;;
 
s30:e9)
       basequal=e9
       squal=s30
       artver=v1_17_07
       nutoolsver=v1_22_00
       ;;
 
s28:e9)
       basequal=e9
       squal=s28
       artver=v1_17_06
       nutoolsver=v1_20_01
       ;;
 
s26:e9)
       basequal=e9
       squal=s26
       artver=v1_17_05
       nutoolsver=v1_18_01
       ;;
 
s24:e9)
       basequal=e9
       squal=s24
       artver=v1_17_04
       nutoolsver=v1_17_01
       ;;
 
s24:e7)
       basequal=e7
       squal=s24
       artver=v1_17_04
       nutoolsver=v1_17_01
       ;;
 
s21:e9)
       basequal=e9
       squal=s21
       artver=v1_17_03
       nutoolsver=v1_16_01
       ;;
 
s21:e7)
       basequal=e7
       squal=s21
       artver=v1_17_03
       nutoolsver=v1_16_01
       ;;
 
s20:e9)
       basequal=e9
       squal=s20
       artver=v1_17_02
       nutoolsver=v1_16_00
       ;;
 
s20:e7)
       basequal=e7
       squal=s20
       artver=v1_17_02
       nutoolsver=v1_16_00
       ;;
 
s18:e9)
       basequal=e9
       squal=s18
       artver=v1_16_02
       nutoolsver=v1_15_01
       ;;
 
s18:e7)
       basequal=e7
       squal=s18
       artver=v1_16_02
       nutoolsver=v1_15_01
       ;;
 
s16:e7)
       basequal=e7
       squal=s16
       artver=v1_16_00
       nutoolsver=v1_15_00
       ;;
 
  s15:e7)
     basequal=e7
     squal=s15
     artver=v1_15_02
     nutoolsver=v1_14_02
  ;;
  s14:e7)
     basequal=e7
     squal=s14
     artver=v1_15_01
     nutoolsver=v1_14_00
  ;;
  s12:e7)
     basequal=e7
     squal=s12
     artver=v1_14_03
     nutoolsver=v1_13_00
  ;;
  s11:e7)
     basequal=e7
     squal=s11
     artver=v1_14_02
     nutoolsver=v1_11_01
  ;;
  s8:e7)
     basequal=e7
     squal=s8
     artver=v1_13_02
     nutoolsver=v1_09_02
  ;;
  s7:e7)
     basequal=e7
     squal=s7
     artver=v1_13_01
     nutoolsver=v1_09_00
  ;;
  s7:e6)
     basequal=e6
     squal=s7
     artver=v1_13_01
     nutoolsver=v1_09_00
  ;;
  s6:e7)
     basequal=e7
     squal=s6
     artver=v1_12_05
     nutoolsver=v1_07_02
  ;;
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
if [ "${target_env}" == "offline" ]; then
  ./pullProducts ${blddir} source nu-${nutoolsver} || \
      { cat 1>&2 <<EOF
ERROR: pull of nu-${nutoolsver} failed
EOF
        exit 1
      }
fi
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
./buildFW -t -b ${basequal} -s ${squal} ${blddir} ${build_type} lbne_raw_data-${version} || \
 { mv ${blddir}/*.log  $WORKSPACE/copyBack/
   exit 1 
 }

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
