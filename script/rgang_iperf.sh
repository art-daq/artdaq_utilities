#! /bin/sh
 # This file (rgang_iperf.sh) was created by Ron Rechenmacher <ron@fnal.gov> on
 # Mar 17, 2016. "TERMS AND CONDITIONS" governing this file are in the README
 # or COPYING file. If you do not have such a file, one can be obtained by
 # contacting Ron or Fermi Lab in Batavia IL, 60510, phone: 630-840-3000.
 # $RCSfile: rgang_iperf.sh,v $
 # rev='$Revision: 1.12 $$Date: 2016/04/05 01:58:13 $'


USAGE="\
usage: `basename $0` <rgang_node_spec>
options:
--rgang=path/to/rgang
--local
--time=test_time_s
--rcvbuf=#[KM]   could be space or comma list
--sndbuf=#[KM]
--num-tests=#    default=1
-q
--bw=#[mg]       megabit or gigabits
--permutate
--leave-files --keep-files
--megabits       instead of default gigabits for throughput
--use-itf=       for testing interface different than the one used for the rgang ssh
"
VUSAGE="Note: "

RGANG=`which rgang`
test -z "$RGANG" && RGANG=`which rgang.py`
IPERF=`which iperf`
opt_time=10
num_tests=1
num_servers=1
format=g

eval env_opts=\${`basename $0 | sed 's/\.sh$//' | tr 'a-z-' 'A-Z_'`_OPTS-} # can be args too
eval "set -- $env_opts \"\$@\""
# Process script arguments and options
op1chr='rest=`expr "$op" : "[^-]\(.*\)"`; test -n "$rest" && set -- "-$rest" "$@"'
op1arg='rest=`expr "$op" : "[^-]\(.*\)"`; test -n "$rest" && set -- "$rest"  "$@"'
reqarg='test -z "${1+1}" &&echo opt -$op requires arg. &&echo "$USAGE" &&exit'
args= do_help= opt_v=0
while [ -n "${1-}" ];do
    if expr "x${1-}" : 'x-' >/dev/null;then
        op=`expr "x$1" : 'x-\(.*\)'`; shift   # done with $1
        leq=`expr "x$op" : 'x-[^=]*\(=\)'` lev=`expr "x$op" : 'x-[^=]*=\(.*\)'`
        test -n "$leq"&&eval "set -- \"\$lev\" \"\$@\""&&op=`expr "x$op" : 'x\([^=]*\)'`
        case "$op" in
        \?*|h*)       eval $op1chr; do_help=1;;
        v*)           eval $op1chr; opt_v=`expr $opt_v + 1`;;
        q*)           eval $op1chr; opt_v=`expr $opt_v - 1`;opt_q=1;;
        x*)           eval $op1chr; test $opt_v -ge 1 && set -xv || set -x;;
        -help)        do_help=1;;
        -rgang)       eval $reqarg; RGANG=$1;               shift;;
        -time)        eval $reqarg; opt_time=$1;            shift;;
        -local)       opt_local=1;;
        -rcvbuf)      eval $reqarg; opt_rcvbuf=$1;          shift;;
        -sndbuf)      eval $reqarg; opt_sndbuf=$1;          shift;;
        -num-tests)   eval $reqarg; num_tests=$1;           shift;;
        -bw|-BW)      eval $reqarg; opt_BW=$1;              shift;;
        -permutate)   opt_permutate=1;;
        -leave-files) leave_files=1;;
        -keep-files)  leave_files=1;;
        -servers)     eval $reqarg; num_servers=$1;         shift;;
        -megabits)    format=m;;
        -use-itf)     eval $reqarg; opt_IF=$1;              shift;;
        -*)           echo "unknown long option -$op";  do_help=1;;
        *)            echo unknown option `expr "$op" : '\(.\)'`; do_help=1;;
        esac
    else
        aa=`echo "$1" | sed -e "s/'/'\"'\"'/g"` args="$args '$aa'"; shift
    fi
done
eval "set -- $args \"\$@\""; unset args aa

test $# -gt 1 && { echo 'Too many arguments. $#='$#; do_help=1; }
test $# -ne 1 && do_help=1
test -z "$RGANG" && { echo rgang not found; do_help=1; }
test -z "$IPERF" && { echo iperf not found; do_help=1; }
test -n "${do_help-}" && { echo "$USAGE";test $opt_v -ge 1 && echo "$VUSAGE"; exit; }
set -u

node_spec=$1

data_file=rgang_iperf.data
srvr_ofile=/tmp/iperf_srvr.$$.out   # define before it could possibly be used
clnt_ofile=/tmp/iperf_clnt.$$.out
nodes_file=/tmp/iperf.$$.nodes
cleanup() {
    if [ -n "${srvr_pid-}" ];then
        for pp in ${srvr_pid-};do
            kill -0 $pp 2>/dev/null && \
            { echo cleanup; exec >/dev/null 2>&1; kill -HUP $pp; }
        done
    fi
    test -z "${leave_files-}" && rm -f $srvr_ofile* $clnt_ofile* $nodes_file*
}
trap cleanup EXIT
vecho() { num=$1; shift; test $opt_v -ge $num && eval echo "\"`date`: $@\""; }

IP2if()
{ # strange - some systems have the default route first -- need to sort these by metric to get them last???
  route -n | sed -n '/^[0-9]/p' | sort -rnk5 \
  |awk "function numit(ip){n=split(ip,a,\".\")+1;r=0;while(--n)r+=lshift(a[n],(4-n)*8);return r}/^[0-9]/{if(and(numit(\$3),numit(\"$1\"))==numit(\$1)){print\$8;exit 0}}"
}
if2IP()    { /sbin/ifconfig $1 | sed -n '/inet addr:/{s/.*addr://;s/ .*//;p;q;}'; }

lcl_stats_mark() {
    stats0=`/sbin/ifconfig $IF | awk '/RX packets/{print $3,$4,$5,$6}'`
    vecho 2 "initial RX stats: $stats0"
}
lcl_stats_delta() {
    stats1=`/sbin/ifconfig $IF | awk '/RX packets/{print $3,$4,$5,$6}'`
    perl -e '
    @stats0 = split " ","'"$stats0"'"; # tricky shell quoting
    @stats1 = split " ","'"$stats1"'"; # tricky shell quoting
    foreach $ii (0..$#stats0)
    {   @xx0 = split ":", $stats0[$ii];
        @xx1 = split ":", $stats1[$ii];
        #printf "%s:%d ", $xx1[0],$xx1[1]-$xx0[1];
        printf "%d ", $xx1[1]-$xx0[1];
    }
    printf "\n";'
}
# the following adds the numbers in the lines: deltaRetrans: 3638 3599 39
tot_delt_retrans()
{   perl -e '
    while(<>){
        if(/deltaRetrans: *(\d+) *(\d+) *(\d+)/){$rt1+=$1;$rt2+=$2;$rt3+=$3;}
    }
    printf "%d %d %d\n",$rt1,$rt2,$rt3;
'
}


$RGANG --list $node_spec >$nodes_file
num_nodes=`cat $nodes_file | wc -l`
first_node=`head -1 $nodes_file`
vecho 2 first_node=$first_node
ping_out=`ping -c10 -i.2 -q $first_node`
IP=`echo "$ping_out" | /bin/grep -m1 --only-matching '[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*'`
avg_ms=`echo "$ping_out" | /bin/grep '^rtt' | cut -d/ -f5`
min_ms=`echo "$ping_out" | sed -n '/^rtt/{s/.* = //;s/\/.*//;p;}'`
vecho 2 IP=$IP min_ms=$min_ms avg_ms=$avg_ms
test -n "${opt_IF-}" && IF=$opt_IF || IF=`IP2if $IP`
vecho 2 IF=$IF

set_cpulist_from_IF()
{ itf=$1
  nn_files=`/bin/ls /sys/class/net/$itf/slave*/device/numa_node /sys/class/net/$itf/device/numa_node 2>/dev/null`
  numa_node=-1
  for nnf in $nn_files;do
    # just use first non -1
    test "x`cat $nnf`" != 'x-1' -a "x$numa_node" = 'x-1' && numa_node=`cat $nnf`
    #pull real itf from path
    dev_itf=`expr "$nnf" : '.*/\([^/]*\)/device' | sed s/slave_//`
    vecho 1 "`ethtool --show-pause $dev_itf`"
  done
  vecho 2 numa_node=$numa_node
  cpulist=0
  if [ "x$numa_node" = 'x-1' -a -f /sys/devices/system/node/node0/cpulist ];then
    cpulist=`cat /sys/devices/system/node/node0/cpulist`
  elif [ -f "/sys/devices/system/node/node$numa_node/cpulist" ];then
    cpulist=`cat "/sys/devices/system/node/node$numa_node/cpulist"`
  fi
}
set_cpulist_from_IF $IF
vecho 1 cpulist=$cpulist

if [ -n "${opt_BW-}" ];then
    BWnum=`expr "$opt_BW" : '\([0-9]*\)'`
    BWsuf=`expr "$opt_BW" : '[0-9]* *\(.*\)'`
    case "$BWsuf" in
    *g*) Mb=`expr $BWnum \* 1000`;;
    *)   Mb=$BWnum;;
    esac
else
    Mb=0
    uev_files=`/bin/ls /sys/class/net/$IF/slave*/device/uevent /sys/class/net/$IF/device/uevent 2>/dev/null`
    for uevf in $uev_files;do
        . $uevf;   : set PCI_SLOT_NAME
        gg=`lspci -s $PCI_SLOT_NAME | egrep -o '[0-9]*(-Gigabit|GbE)' | grep -o '[0-9]*'`
        Mb=`expr $Mb + $gg \* 1000 2>/dev/null`
    done
    vecho 2 BW=$Mb Mb
fi
if [ -n "$Mb" -a "$Mb" != 0 ];then
    MB=`expr $Mb / 8`
    BWdly_B=`awk "BEGIN{print $MB*$min_ms*1000/2;exit}"`   # 1/2 rtt
    vecho 0 "BW:${Mb}Mb minRTT:${min_ms}ms linkBW*delay: $BWdly_B Bytes"
else
    vecho 0 "\
linkBW (and linkBW*delay) could not be determined - consider --bw=#[mg] option"
fi

if [ -z "${opt_local-}" ];then
    myIP=`if2IP $IF`
    vecho 1 myIP=$myIP
else
    test -z "${RGANG_RSH-}" \
        && RGANG_RSH="ssh -x -oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null -oLogLevel=ERROR"
    RGANG_RSH="$RGANG_RSH -R5001:localhost:5001"
    export RGANG_RSH
    myIP=localhost
fi

test $opt_time -gt 10 && interval=--interval=10 || interval=

rcmd0='
IP2if()
{ /sbin/route -n | sed -n "/^[0-9]/p" | sort -rnk5 \
  |awk "function numit(ip){n=split(ip,a,\".\")+1;r=0;while(--n)r+=lshift(a[n],(4-n)*8);return r}/^[0-9]/{if(and(numit(\$3),numit(\"$1\"))==numit(\$1)){print\$8;exit 0}}"
}
retrans()
{   netstat -s | perl -e '"'"'
    $rt_general  = 0;
    while (<>)
    {   if    (/(\d+).*retrans/i) { $rt_general += $1; }
        elsif (/Retrans.*: (\d+)/){ $rt_specific += $1;}
        if (/(\S+)Retrans.*: (\d+)/) { $retrans{$1} = $2; }
    }
    # DO NOT HAVE SPACES AT BEGINNING OF OUTPUT -- IT WILL MESS UP DELTA.
    if ($rt_specific ne "")
    {   printf "%7d %7d",
            $rt_general, $rt_general-$rt_specific;
        foreach $key (keys %retrans) { printf " %7d", $retrans{$key}; }
        printf "\n";
    }
    else { printf "%d\n", $rt_general; }'"'"'
}
markRetrans() { retrans0=`retrans`; }
deltaRetrans() 
{   retrans1=`retrans`
    perl -e '"'"'
    @retrans0 = split " ","'"'"'"$retrans0"'"'"'"; # tricky shell quoting
    @retrans1 = split " ","'"'"'"$retrans1"'"'"'"; # tricky shell quoting
    foreach $ii (0..$#retrans0)
    {   printf " %7d", $retrans1[$ii] - $retrans0[$ii];
    }
    printf "\n";'"'"'
}
itf=`IP2if '$myIP'`
echo send itf=$itf
/sbin/ifconfig $itf | /bin/egrep "MTU"
ff=/sys/class/net/$itf/device/numa_node
test -f $ff && { numa_node=`cat $ff`; cpulist=`cat /sys/devices/system/node/node$numa_node/cpulist`; } || cpulist=0
'
rcmd1="num_nodes=$num_nodes num_servers=$num_servers"
rcmd2='poff=`awk "BEGIN{nps=$num_nodes/$num_servers;xx=$RGANG_MACH_ID/nps;print int(xx);exit;}"`
port=`expr 5001 + $poff`
markRetrans;taskset -c $cpulist '"\
iperf -c $myIP --reportexclude=CMSV --format=$format --port=\$port --time=$opt_time $interval"'
echo deltaRetrans: `deltaRetrans`
/sbin/ethtool --show-pause $itf
dmesg | tail -20 | grep $itf | tail -5'

vecho 1 rcmd size: `echo "$rcmd0$rcmd1;$rcmd2" | wc -c`

inc=`expr $num_nodes / 4`
lst=`expr $inc \* 3`
files=$nodes_file
if [ -n "${opt_permutate-}" ];then
    for nn in `seq $inc $inc $lst`;do
        head -n -$nn $nodes_file >$nodes_file.$nn
        files="$nodes_file.$nn $files"
    done
fi

test $format = g && fmt=Gb || fmt=Mb
printf "\
#___________date____________ _%s/s_ errs drop ovrun frame __rmt_retrans__ nodes win(K) inflight(K)\n" $fmt |tee $data_file
#un Mar 20 15:06:21 CDT 2016  16.70  283    0     0   283 16598 16375 223     5   85.3
for nfile in $files;do

    num_nodes=`cat $nfile | wc -l`
    if   [ -n "${opt_rcvbuf-}" ];then
        rcvbufs=`echo $opt_rcvbuf |sed 's/,/ /g'`   # could be multiple
    elif [ -n "${opt_permutate-}" -a -n "${BWdly_B-}" ];then
        rcvbufs="default `expr $BWdly_B / $num_nodes / 2`"
        rcvbufs="$rcvbufs `expr $BWdly_B / $num_nodes`"
        rcvbufs="$rcvbufs `expr $BWdly_B / $num_nodes \* 2`"
    else
        rcvbufs=default
    fi
    rcmd1="num_nodes=$num_nodes num_servers=$num_servers"

    for rbuf in $rcvbufs;do
        test "$rbuf" = "default" && window= || window=--window=$rbuf
        srvr_pid= last_seq=`expr $num_servers - 1`
        for poff in `seq 0 $last_seq`;do
            port=`expr 5001 + $poff`
            #note taskset -c needs space between it and $cpulist
            taskset -c $cpulist $IPERF -s --port=$port --format=K $window >$srvr_ofile.$poff 2>&1 &
            srvr_pid="$srvr_pid $!"
        done
        vecho 2 iperf server pid=$srvr_pid
        sleep .5 # give server a chance to output info for next line
        rwin=`awk '/TCP window/{print $4;exit;}' $srvr_ofile.0`
        inflight=`awk "BEGIN{print $num_nodes * $rwin;exit;}"`

        nn=`expr $num_tests + 1` # so while num_test=`expr... gives expect results
        while nn=`expr $nn - 1`;do
            lcl_stats_mark
            test 3 -gt $opt_v \
                && { $RGANG $nfile "$rcmd0$rcmd1;$rcmd2" >$clnt_ofile 2>&1; echo $? >$clnt_ofile.sts; } \
                || ( $RGANG $nfile "$rcmd0$rcmd1;$rcmd2" 2>&1; echo $? >$clnt_ofile.sts ) | tee $clnt_ofile
            rgang_sts=`cat $clnt_ofile.sts`
            test 0 -ne $rgang_sts && echo "Warning: rgang returned non-zero exit status ($rgang_sts)"
            lcl_delt=`lcl_stats_delta`
            rmt_delt=`grep deltaRetrans $clnt_ofile | tot_delt_retrans`
            tot_Xb=`awk "/ 0\.0-$opt_time\./"'{tot+=$7}END{print tot}' $clnt_ofile`
            # NOTE $rmt_delt is 3 numbers
            printf "`date` %6.2f %4d %4d %5d %5d %5d %5d %3d %5d %6.1f %7.1f\n" \
                $tot_Xb $lcl_delt $rmt_delt $num_nodes $rwin $inflight |tee -a $data_file
        done

        # The next 4 lines are use to assure "Hangup/exit" msg from sh is not seen
        exec 3>&1 4>&2 >/dev/null 2>&1 # save stdout/err then redirect
        for pp in $srvr_pid;do kill -HUP $pp; done
        srvr_pid=
        sleep 1
        exec 1>&3 2>&4 3>&- 4>&-       # restore/release
        vecho 3 "server output:
`cat $srvr_ofile.*`"

    done

done
