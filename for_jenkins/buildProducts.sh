#!/bin/bash

build_type=${build_type:-"artdaq"}
build_tag=${build_tag:-""}

ignorequals="nu|s50|s53|s54|s56|s57|s58|s60|s61|s62|s63|s66|s68|s69|ib"
TOP_DIR=$PWD
MASTER_PRODUCTS=/home/eflumerf/products

ulimit -c unlimited

opt_clean=0;
counter=0
max_counter=$((`cat /proc/cpuinfo|grep processor|tail -1|awk '{print $3}'` + 1))
build_j=1
if [ $max_counter -gt 4 ]; then
	build_j=$(($max_counter / 4))
	max_counter=4
fi
rm -f build_*.log

if [[ "x$1" == "xc" ]]; then
    opt_clean=1
	shift
fi

function do_build_impl() {
    (
		sourcedir=$1
		builddir=build_$sourcedir
		btype=$2
		quals=$3
		qualdash=`echo $quals|sed 's/:/-/g'`
		shift;shift;shift
		source $MASTER_PRODUCTS/setup
		source $TOP_DIR/products/setup
		buildname=${builddir}_${btype}-${qualdash}
		mkdir -p $TOP_DIR/${buildname}
		cd $TOP_DIR/${buildname}
		unsetup_all >/dev/null 2>&1
		source $TOP_DIR/$sourcedir/ups/setup_for_development -$btype $quals &>$TOP_DIR/${buildname}.log
		opts="-piI $TOP_DIR/products"
		if [ $opt_clean -eq 1 ];then
			opts="-c ${opts}"
		fi
		opt_t="-t"
		if [[ "$sourcedir" == "artdaq-utilities-database" ]]; then
			opt_t=""
		fi
		CETPKG_J=$build_j nice -n 10 buildtool $opt_t $opts &>>$TOP_DIR/${buildname}.log
		if [ `ls -l|grep -c "tar.bz2"` -gt 0 ];then
			mv *.bz2 $TOP_DIR/
			cd $TOP_DIR
			rm -f ${buildname}.log
		fi
    )
}

function do_build_nq() {
	sourcedir=$1
	versiontag=$2
	shift;shift

	if [ ! -d $sourcedir ];then
		git clone http://cdcvs.fnal.gov/projects/$sourcedir
	fi

	cd $sourcedir
    if [ `cat .git/config|grep -c gitflow` -eq 0 ];then
        git flow init -d
    fi
	git checkout $versiontag
	cd $TOP_DIR

	do_build_impl $sourcedir 
}

function do_build() {
	sourcedir=$1
	versiontag=$2
	shift;shift
	
	if [ ! -d $sourcedir ];then
		git clone http://cdcvs.fnal.gov/projects/$sourcedir
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
			do_build_impl $sourcedir $btype $qualset &
			counter=$(($counter + 1))
			if [ $counter -ge $max_counter ];then
				wait
				counter=0
			fi
		done
	done
}

if [[ "$build_type" == "mu2e" ]]; then
	if [[ "$build_tag" == "develop" ]]; then
		do_build pcie_linux_kernel_module develop
		do_build mu2e_artdaq-core develop
		wait 

		do_build mu2e_artdaq develop
		wait
	else
		do_build pcie_linux_kernel_module v1_11_01
		do_build mu2e_artdaq-core v1_02_03
		wait 

		do_build mu2e_artdaq v1_02_03
		wait
	fi
elif [[ "$build_type" == "ots" ]];then

	if [[ "$build_tag" == "develop" ]]; then
		do_build otsdaq develop
		wait 

		do_build otsdaq-utilities develop
		wait

		do_build components develop
		wait

		do_build otsdaq-demo develop
		do_build fermilabtestbeam develop
		do_build prepmodernization develop
		wait
	else
		do_build otsdaq v1_01_04
		wait 

		do_build otsdaq-utilities v1_01_04
		wait

		do_build components v1_01_04
		wait

		do_build otsdaq-demo v1_01_04
		do_build fermilabtestbeam v1_01_04
		do_build prepmodernization v1_01_04
		wait
	fi

else # artdaq

	if [[ "$build_tag" == "develop" ]]; then

		do_build_nq trace-git master
		wait

		do_build artdaq-core develop
		do_build artdaq-utilities develop
		wait

		do_build mf-extensions-git develop
		do_build artdaq-utilities-ganglia-plugin develop
		do_build artdaq-utilities-epics-plugin develop
		wait

		do_build artdaq develop
		do_build artdaq-core-demo develop
		wait

		#do_build artdaq-demo develop
		#do_build artdaq-utilities-database develop
		#do_build_nq artdaq-utilities-daqinterface develop
		wait 

		#do_build artdaq-utilities-node-server develop
		wait
	else
		do_build_nq trace-git v3_13_07
		wait

		do_build artdaq-core v3_04_04
#		do_build artdaq-utilities v1_04_08
		wait

#		do_build mf-extensions-git v1_03_02a
#        do_build artdaq-utilities-epics-plugin v1_02_05b
#		do_build artdaq-utilities-ganglia-plugin v1_02_11b
		wait

#		do_build artdaq v3_03_01
#		do_build artdaq-core-demo v1_06_12a
		wait

#		do_build artdaq-demo v3_03_01
#		do_build artdaq-utilities-database v1_04_66
#		do_build_nq artdaq-utilities-daqinterface v3_03_01
#		do_build artdaq-utilities-mpich-plugin v1_00_04
		wait 

#		do_build artdaq-utilities-node-server v1_01_01c
		wait

	fi
fi
