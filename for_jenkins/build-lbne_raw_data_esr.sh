#!/bin/bash

# build lbne_raw_data
# use mrb
# designed to work on Jenkins

# qualifier is something like e15:nu:s65
# buildtype is debug or prof

echo "lbne-raw-data version: $LRD_VERSION"
echo "target qualifiers: $QUAL"
echo "build type: $BUILDTYPE"
echo "workspace: $WORKSPACE"

QUAL=`echo ${QUAL} | sed -e "s/-/:/g"`

# Don't do ifdh build on macos.

#if uname | grep -q Darwin; then
#  if ! echo $QUAL | grep -q noifdh; then
#    echo "Ifdh build requested on macos.  Quitting."
#    exit
#  fi
#fi

# Get number of cores to use.

if [ `uname` = Darwin ]; then
  #ncores=`sysctl -n hw.ncpu`
  #ncores=$(( $ncores / 4 ))
  ncores=4
else
  ncores=`cat /proc/cpuinfo 2>/dev/null | grep -c -e '^processor'`
fi
if [ $ncores -lt 1 ]; then
  ncores=1
fi
echo "Building using $ncores cores."

# Environment setup, uses /grid/fermiapp or cvmfs.

echo "ls /cvmfs/dune.opensciencegrid.org/products/dune/"
ls /cvmfs/dune.opensciencegrid.org/products/dune/
echo

echo "ls /cvmfs/larsoft.opensciencegrid.org/products"
ls /cvmfs/larsoft.opensciencegrid.org/products
echo

if [ `uname` = Darwin -a -f /grid/fermiapp/products/dune/setup_dune_fermiapp.sh ]; then
  source /grid/fermiapp/products/dune/setup_dune_fermiapp.sh || exit 1
elif [ -f /cvmfs/dune.opensciencegrid.org/products/dune/setup_dune.sh ]; then
  if [ -x /cvmfs/grid.cern.ch/util/cvmfs-uptodate ]; then
    /cvmfs/grid.cern.ch/util/cvmfs-uptodate /cvmfs/dune.opensciencegrid.org/products
  fi
  source /cvmfs/dune.opensciencegrid.org/products/dune/setup_dune.sh || exit 1
else
  echo "No setup file found."
  exit 1
fi

# Use system git on macos.

if ! uname | grep -q Darwin; then
  setup git || exit 1
fi

# skip around a version of mrb that does not work on macOS

if [ `uname` = Darwin ]; then
  if [[ x`which mrb | grep v1_17_02` != x ]]; then
    unsetup mrb || exit 1
    setup mrb v1_16_02 || exit 1
  fi
fi

setup gitflow || exit 1
export MRB_PROJECT=dune
echo "Mrb path:"
which mrb

# get the qualifier from product_deps

rm -rf $WORKSPACE/temp2 || exit 1
mkdir -p $WORKSPACE/temp2 || exit 1
cd $WORKSPACE/temp2 || exit 1
git clone http://cdcvs.fnal.gov/projects/lbne-raw-data || exit 1
git checkout $LRD_VERSION
# allow qualifier to be specified externally -- just one set for this build anyway.
# FQUAL=`grep $BUILDTYPE lbne-raw-data/ups/product_deps | grep ${QUAL}: | awk '{print $1}'`
# FQ1=`grep defaultqual lbne-raw-data/ups/product_deps | awk '{print $2}'`
FQUAL=${QUAL}:${BUILDTYPE}
echo "Full qualifier: $FQUAL"

#dla set -x
rm -rf $WORKSPACE/temp || exit 1
mkdir -p $WORKSPACE/temp || exit 1
mkdir -p $WORKSPACE/copyBack || exit 1
rm -f $WORKSPACE/copyBack/* || exit 1
cd $WORKSPACE/temp || exit 1

mrb newDev -v $LRD_VERSION -q $FQUAL || exit 1

#dla set +x
source localProducts*/setup || exit 1

# some shenanigans so we can use getopt v1_1_6
if [ `uname` = Darwin ]; then
#  cd $MRB_INSTALL
#  curl --fail --silent --location --insecure -O http://scisoft.fnal.gov/scisoft/packages/getopt/v1_1_6/getopt-1.1.6-d13-x86_64.tar.bz2 || \
#      { cat 1>&2 <<EOF
#ERROR: pull of http://scisoft.fnal.gov/scisoft/packages/getopt/v1_1_6/getopt-1.1.6-d13-x86_64.tar.bz2 failed
#EOF
#        exit 1
#      }
#  tar xf getopt-1.1.6-d13-x86_64.tar.bz2 || exit 1
  setup getopt v1_1_6  || exit 1
#  which getopt
fi

#dla set -x
cd $MRB_SOURCE  || exit 1
# check out a readonly version
mrb g -r -t $LRD_VERSION -d lbne_raw_data lbne-raw-data || exit 1

ups list -aK+ cetbuildtools || exit 1

cd $MRB_BUILDDIR || exit 1
mrbsetenv || exit 1
mrb b -j$ncores || exit 1
mrb mp -n lbne_raw_data -- -j$ncores || exit 1

# Extract flavor.

flvr=''
if uname | grep -q Darwin; then
  flvr=`ups flavor -2`
else
  flvr=`ups flavor -4`
fi


# Save artifacts.

mv *.bz2  $WORKSPACE/copyBack/ || exit 1

ls -l $WORKSPACE/copyBack/
cd $WORKSPACE || exit 1
rm -rf $WORKSPACE/temp || exit 1

#dla set +x

exit 0
