#!/bin/bash

build_type=${build_type:-"artdaq"}
build_tag=${build_tag:-""}

ignorequals="nu|s66|s67|s68|s69|s70|s71|s72|s73|s74|s75|s76|s77|s78|s79|s80|s81|s82|s83|s84|s86|s89|s90|s91|s92|s93|s94|s95|s97|s98|s99|s115|ib|py3"
TOP_DIR=$PWD
MASTER_PRODUCTS=`cat ~/.base_products`
EXTRA_PRODUCTS=/cvmfs/fermilab.opensciencegrid.org/products/artdaq

ulimit -c unlimited

opt_clean=0;
counter=0
max_counter=$CETPKG_J #1
build_j=1 #$CETPKG_J
exit_script=0
if [ $max_counter -gt 4 ]; then
	build_j=$(($max_counter / 4))
	max_counter=4
fi
rm -f builds/build_*.log

if [[ "x$1" == "xc" ]]; then
	opt_clean=1
	shift
fi

function setup_build() {
	sourcedir=$1
	builddir=builds/build_$sourcedir
	btype=$2
	quals=$3
	qualdash=`echo $quals|sed 's/:/-/g'`
	shift;shift;shift
	source $MASTER_PRODUCTS/setup
	source $TOP_DIR/products/setup
	PRODUCTS=${PRODUCTS}${EXTRA_PRODUCTS:+:${EXTRA_PRODUCTS}}
	#echo PRODUCTS is $PRODUCTS
	buildname=${builddir}_${btype}-${qualdash}
	mkdir -p $TOP_DIR/${buildname}
	cd $TOP_DIR/${buildname}
	unsetup_all >/dev/null 2>&1
	ulimit -c unlimited
	source $TOP_DIR/$sourcedir/ups/setup_for_development ${btype:+-${btype}} $quals &>$TOP_DIR/${buildname}.log
}

function clean_build() {
	CETPKG_J=$build_j nice -n 10 buildtool -c &>>$TOP_DIR/${buildname}.log
}

function check_build() {
	if [ `ls -l|grep -c "tar.bz2"` -gt 0 ];then
		mv *.bz2 $TOP_DIR/builds/
		cd $TOP_DIR
		rm -f ${buildname}.log
	else
		echo "Build $sourcedir ${btype:+-${btype}} $quals FAILED"
		exit_script=1
	fi
}

function do_build_impl() {
	opts="-piI $TOP_DIR/products"
	if [ $opt_clean -eq 1 ];then
		opts="-c ${opts}"
	fi
	opt_t="-t"
	if [[ "$sourcedir" == "artdaq-utilities-database" ]]; then
		opt_t=""
	fi
	CETPKG_J=$build_j nice -n 10 buildtool $opt_t $opts &>>$TOP_DIR/${buildname}.log
}

function do_build_nq() {
	sourcedir=$1
	versiontag=$2
	shift;shift

	if [ $exit_script -eq 1 ];then exit;fi
	if [ ! -d $sourcedir ];then
		git clone git@github.com:art-daq/$sourcedir
	fi

	cd $sourcedir
	if [ `cat .git/config|grep -c gitflow` -eq 0 ];then
		git flow init -d
	fi

	git checkout $versiontag
	cd $TOP_DIR
	(
	setup_build $sourcedir

	do_build_impl $sourcedir
	check_build $sourcedir
	)
}

function maybe_calculate_coverage() {
	(
	sourcedir=$1
	btype=$2
	quals=$3
	
	do_coverage=0
	if [[ $quals =~ e20 ]] && [[ $btype == "d" ]];then
		do_coverage=1
		export USE_GCOV=1
	fi

	setup_build $@
	

	clean_build $@

	if [ $do_coverage -eq 1 ];then

		lcov -d . --zerocounters &>>$TOP_DIR/${buildname}.log
		lcov -c -i -d . -o ${sourcedir}.base &>>$TOP_DIR/${buildname}.log
	fi
	
	do_build_impl $@
		
	if [ $do_coverage -eq 1 ];then
		lcov -d . --capture --output-file ${sourcedir}.info &>>$TOP_DIR/${buildname}.log 2>&1
		lcov -a ${sourcedir}.base -a ${sourcedir}.info --output-file ${sourcedir}.total &>>$TOP_DIR/${buildname}.log 2>&1
		lcov --remove ${sourcedir}.total '/cvmfs/*' 'boost/*' '*/products/*' '*/builds/*' '/usr/include/curl/*' --output-file ${sourcedir}.info.cleaned &>>$TOP_DIR/${buildname}.log 2>&1
		genhtml --demangle-cpp -o coverage ${sourcedir}.info.cleaned &>>$TOP_DIR/${buildname}.log 2>&1
	fi

	check_build $@
	)
}

function do_build() {
	sourcedir=$1
	versiontag=$2
	shift;shift
	
	if [ $exit_script -eq 1 ];then exit;fi
	if [ ! -d $sourcedir ];then
		git clone git@github.com:art-daq/$sourcedir
	fi

	cd $sourcedir
	if [ `cat .git/config|grep -c gitflow` -eq 0 ];then
		git flow init -d
	fi
	git checkout $versiontag
	cd $TOP_DIR

	QUALS=`cat $sourcedir/ups/product_deps|grep -ve "^#"|awk '{print $1}'|grep -e "debug\|prof"|sed 's/:prof//g;s/:debug//g'|sort|uniq`

	build_count=0
	for btype in d p; do
		for qualset in ${QUALS}; do
			if [[ "$qualset" =~ $ignorequals ]]; then continue;fi
			build_count=$(($build_count + 1))
		done
	done
	build_counter=0

	for btype in d p; do
		for qualset in ${QUALS}; do
			if [[ "$qualset" =~ $ignorequals ]]; then continue;fi
			build_counter=$(($build_counter + 1))
			echo "Starting build $build_counter of $build_count for package $sourcedir"
			maybe_calculate_coverage $sourcedir $btype $qualset &
			counter=$(($counter + 1))
			if [ $counter -ge $max_counter ];then
				wait
				if [ $exit_script -eq 1 ];then exit;fi
				counter=0
			fi
		done
		wait
	done
}

#do_build_nq trace ${build_tag:-v3_17_05}
wait
#exit

#do_build artdaq_core ${build_tag:-v3_09_00}
#do_build artdaq_utilities ${build_tag:-v1_08_00}
wait
#exit

#do_build artdaq_mfextensions ${build_tag:-v1_08_00}
#do_build artdaq_epics_plugin ${build_tag:-v1_05_00}
#do_build artdaq_pcp_mmv_plugin ${build_tag:-v1_03_00}
wait
#exit

#do_build artdaq ${build_tag:-v3_12_00}
#do_build artdaq_core_demo ${build_tag:-v1_10_00}
wait
#exit

#do_build artdaq_demo ${build_tag:-v3_12_00}
#do_build_nq artdaq_daqinterface ${build_tag:-v3_12_00}
#do_build artdaq_demo_hdf5 ${build_tag:-v1_04_00}
wait 
#exit

#do_build artdaq_database ${build_tag:-v1_07_00}
wait 
#exit

do_build otsdaq ${build_tag:-v2_06_06}
wait
#exit

do_build otsdaq_utilities ${build_tag:-v2_06_06}
wait
#exit

do_build otsdaq_components ${build_tag:-v2_06_06}
do_build otsdaq_epics ${build_tag:-v2_06_06}
wait
#exit

do_build otsdaq_prepmodernization ${build_tag:-v2_06_06}
do_build otsdaq_demo ${build_tag:-v2_06_06}
wait


