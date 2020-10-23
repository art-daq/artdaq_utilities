#! /bin/sh
 # This file (rgang_iperf.sh) was created by Ron Rechenmacher <ron@fnal.gov> on
 # Mar 17, 2016. "TERMS AND CONDITIONS" governing this file are in the README
 # or COPYING file. If you do not have such a file, one can be obtained by
 # contacting Ron or Fermi Lab in Batavia IL, 60510, phone: 630-840-3000.
 # $RCSfile: rgang_iperf.sh,v $
 # rev='$Revision: 1.57 $$Date: 2020/10/11 21:28:34 $'


USAGE="\
usage: `basename $0` <rgang_node_spec>
options:
--rgang=path/to/rgang
--iperf=path/to/iperf
--time=test_time_s  dflt:%d
-n, --num=       #[kmgKMG]    number of bytes to transmit (instead of -t)
--rcvbuf=#[KM]   server rcvbuf. Space/comma list (for multiple tests). \"default\" (which is likely 43656) can be used. (server limit: net.core.rmem_max)
--sndbuf=#[KM]   client/sender sndbuf. \"default\" can be used. (client limit: net.core.wmem_max)
-P, --parallel # number of parallel_connection
--num-tests=#    default=1
-v               more verbose (i.e. -vvv to see rgang output)
-q               more quiet
-d               do dualtest (a bidirectional test simultaneously)
-r               do tradeoff test
--local          for reverse tunneling clients through ssh
-l,--len=        set length of read/write buffer to n (default 8 KB)
--bw=#[mg]       megabit or gigabits
--bwudp=#[mg]    udp bw test (iperf sender opt)
--bandwidth=#[KMG] bandwidth in bits/sec (0 for unlimited) (iperf client opt)
--permutate      given serveral nodes, run tests with all, then tests with fewer -- can show effect of small rcvbuf
-k,--leave-files --keep-files    (i.e. data file in pwd and others in /tmp)
--megabits       instead of default gigabits for throughput
--use-itf=       for testing interface different than the one used for the rgang ssh
--shark[=count]  enable tshark capture/analysis optionally with a limited number of packets
--congestion_control=  cubic or reno  -- set on client/sender side only
--txqueuelen=    set client/sndr side txqueuelen
--app_win=       set server/rcvr side
--adv_win_scale= set server/rcvr side
--max_backlog=   set server/rcvr side
--initrwnd[=N]   set server/rcvr side  initial window N*mss or (without =N) reset to default
--flow=<on|off>  turn interface flow control (via ethtool) on/off (both local and remote)
--servers=       number of servers - clients get divided among the servers (so flows is still nodes*parallel)
--skip=          pass this param to rgang
"
hdr="\
#____________date____________ _%s/s_ errs drop ovrun frame ___rmt_retrans___ flows inflight(K) _rcv(K) snd(K)  rcalc(K)\n"
VUSAGE="\
In the header:
$hdr
errs drop ovrun frame = local device errors from ifconfig
snd(K) = if the snd(K) value (which is the snd socket buffer size reported by the report clients)
         has an asterisk (*) then all clients are not the same. If the kernel allows the full sndbuf setting,
         the value of snd(K) should be twice the value specified.
rcalc = rcalc is the result of calculations on rcvbuf base on values of net.ipv4.adv_win_scale and net.ipv4.app_win
Note: if net.ipv4.tcp_moderate_rcvbuf (`sysctl net.ipv4.tcp_moderate_rcvbuf`) is 1, the kernel tries to
automatically increase the rcvbuf between net.ipv4.tcp_rmem[1] and net.ipv4.tcp_rmem[2] - only in extreme memory
pressure cases, does rcvbuf go down (to net.ipv4.tcp_rmem[0]). See Documentation/networking/ip-sysctl.txt.
`sysctl net.ipv4.tcp_rmem`

Examples:
rgang_iperf.sh localhost
rgang -n2 mu2edaq\{04,07,10,12} \\
'PATH=~/bin:~/script:/sbin:\$PATH; rgang_iperf.sh --skip=\`hostname -s\` mu2edaq\{,}\{04,07,10,12} '\\
'--servers=2 --time=20 --len=64K --rcvbuf=8K -P6'
"

RGANG=`which rgang`
test -z "$RGANG" && RGANG=`which rgang.py`
IPERF=`which iperf`
test -z "$IPERF" && IPERF=`which iperf3`
opt_time=10
num_tests=1
num_servers=1
format=g
MTUX=4   # factor used in max function used in determining max_rwin. It seems values of 0,1,4 are valid depending upon kernel version
leave_files=0

eval env_opts=\${`basename $0 | sed 's/\.sh$//' | tr 'a-z-' 'A-Z_'`_OPTS-} # can be args too
eval "set -- $env_opts \"\$@\""
# Process script arguments and options
op1chr='rest=`expr "$op" : "[^-]\(.*\)"`; test -n "$rest" && set -- "-$rest" "$@"'
op1arg='rest=`expr "$op" : "[^-]\(.*\)"`; test -n "$rest" && set -- "$rest"  "$@"'
reqarg="$op1arg;"'test -z "${1+1}" &&echo opt -$op requires arg. &&printf "$USAGE" $opt_time &&exit'
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
        P*|-parallel) eval $reqarg; opt_P=$1;               shift;;
        r*)           eval $op1chr; trade_off='-r';;
        d*)           eval $op1chr; dualtest='-d';;
        -help)        do_help=1;;
        -rgang)       eval $reqarg; RGANG=$1;               shift;;
        -iperf)       eval $reqarg; IPERF=$1;               shift;;
        -time)        eval $reqarg; opt_time=$1;            shift;;
        -local)       opt_local=1;;
        -rcvbuf)      eval $reqarg; opt_rcvbuf=$1;          shift;;
        -sndbuf)      eval $reqarg; opt_sndbuf=$1;          shift;;
        -num-tests)   eval $reqarg; num_tests=$1;           shift;;
        n*|-num)      eval $reqarg; opt_num=$1;             shift;;
        l*|-len)      eval $reqarg; opt_len=$1;             shift;;
        -bw|-BW)      eval $reqarg; opt_BW=$1;              shift;;
        -bwudp)       eval $reqarg; opt_bwudp=$1;           shift;;
        -bandwidth)   eval $reqarg; opt_bandwidth=$1;       shift;;
        -permutate)   opt_permutate=1;;
        -leave-files)               leave_files=`expr $leave_files + 1`;;
        k*)           eval $op1chr; leave_files=`expr $leave_files + 1`;;
        -keep*)                     leave_files=`expr $leave_files + 1`;;
        -servers)     eval $reqarg; num_servers=$1;         shift;;
        -megabits)    format=m;;
        -use-itf)     eval $reqarg; opt_IF=$1;              shift;;
        -shark)       test -z "$leq"&&opt_shark= ||{ opt_shark=$1;shift;};;
        -congestion_control) eval $reqarg; congestion_control=$1;shift;;
        -txqueuelen)  eval $reqarg; opt_txqueuelen=$1;      shift;;
        -app_win)     eval $reqarg; opt_app_win=$1;         shift;;
        -adv_win_scale) eval $reqarg; opt_adv_win_scale=$1; shift;;
        -max_backlog) eval $reqarg; opt_max_backlog=$1;     shift;;
        -initrwnd)    test -z "$leq"&&opt_initrwnd= || { opt_initrwnd=$1;shift;};;
        -flow)        eval $reqarg; opt_flow=$1;            shift;;
        -mtux)        eval $reqarg; MTUX=$1;                shift;;
        -skip)        eval $reqarg; skip=$1;                shift;;
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
test -n "${do_help-}" && { printf "$USAGE" $opt_time;test $opt_v -ge 1 && echo "$VUSAGE"; exit; }
set -u

node_spec=$1

data_file=rgang_iperf.data
srvr_ofile=/tmp/iperf_srvr.$$.out   # define before it could possibly be used
clnt_ofile=/tmp/iperf_clnt.$$.out
nodes_file=/tmp/iperf.$$.nodes
shark_file_prefix=/tmp/iperf_shark
cleanup() {
    if [ -n "${srvr_pid-}" ];then
        for pp in ${srvr_pid-};do
            kill -0 $pp 2>/dev/null && \
            { echo cleanup; exec >/dev/null 2>&1; kill -HUP $pp; }
        done
    fi
    test 1 -ge $leave_files && rm -f $srvr_ofile* $clnt_ofile* $nodes_file* $shark_file_prefix*
    test 0 -ge $leave_files && rm -f $data_file
}
trap cleanup EXIT
vecho() { num=$1; shift; test $opt_v -ge $num && echo "`date`: $@"; }

# make sure /sbin is in PATH (instead of using /sbin/route and /sbin/ifconfig throughout the script)
echo ":$PATH:" | grep :/sbin: >/dev/null || PATH=/sbin:$PATH


IP2if()
{ # strange - some systems have the default route first -- need to sort these by metric to get them last???
  # stranger -
#/nfs/home/ron
#np04-srv-004 :^) route -n
#Kernel IP routing table
#Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
#0.0.0.0         10.73.138.1     0.0.0.0         UG    100    0        0 enp8s0f0
#10.73.136.0     0.0.0.0         255.255.255.0   U     0      0        0 bond0
#10.73.138.0     0.0.0.0         255.255.255.0   U     100    0        0 enp8s0f0
#128.142.0.0     10.73.136.1     255.255.0.0     UG    0      0        0 bond0
#169.254.0.0     0.0.0.0         255.255.0.0     U     1006   0        0 bond0
#188.184.0.0     10.73.136.1     255.255.128.0   UG    0      0        0 bond0
#188.185.128.0   10.73.136.1     255.255.128.0   UG    0      0        0 bond0
#192.168.122.0   0.0.0.0         255.255.255.0   U     0      0        0 virbr0
#--2018-08-24_04:03:08--
  # So, use ^[1-9] to filter out ^0.0.0.0 -- then, if no match, default last. Is this right???
  table=`route -n | sed -n '/^[1-9]/p' | sort -rnk5`
  awk_fun="function numit(ip){n=split(ip,a,\".\")+1;r=0;while(--n)r+=lshift(a[n],(4-n)*8);return r}
/^[0-9]/{if(and(numit(\$3),numit(\"$1\"))==numit(\$1)){print\$8;exit 0}}"
  If=`echo "$table" | awk "$awk_fun"`
  test -z "$If" && If=`route -n | sed -n '/^[0-9]/p' | sort -rnk5 | awk '/^0.0.0.0/{print$8;exit}'`
  echo $If
}
if2IP()    { /sbin/ifconfig $1 | sed -n '/inet /{s/.*inet //;s/addr://;s/ .*//;p;q;}'; }
IP2routeshow()
{ ip=$1
  ip route show \
  |awk 'BEGIN{ip="'$ip'"}
function numit(ss){n=split(ss,aa,/\./)+1;r=0;while(--n)r+=lshift(aa[n],(4-n)*8);return r}
function mask(bnum){bb=32-bnum;return compl(2^bb-1)}
/^[1-9]/{split($0,a,/[/ ]/);if(and(numit(ip),mask(a[2]))==numit(a[1]))print}
'
}

lcl_stats_mark() {
    # need to print 4 numbers
    stats0=`/sbin/ifconfig $IF | awk '/RX packets:/{print $3,$4,$5,$6} /RX errors/{print $2":"$3,$4":"$5,$6":"$7,$8":"$9}'`
    # SL6: RX packets:233338996 errors:0 dropped:0 overruns:0 frame:0
    # SL7: RX errors 0  dropped 0  overruns 0  frame 0
    vecho 2 "initial RX stats: $stats0"
}
lcl_stats_delta() {
    stats1=`/sbin/ifconfig $IF | awk '/RX packets:/{print $3,$4,$5,$6} /RX errors/{print $2":"$3,$4":"$5,$6":"$7,$8":"$9}'`
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


$RGANG ${skip:+--skip=$skip} --list $node_spec >$nodes_file
num_nodes=`cat $nodes_file | wc -l`
first_node=`head -1 $nodes_file`
vecho 2 first_node=$first_node
ping_out=`ping -c10 -i.2 -q $first_node`
IP=`echo "$ping_out" | /bin/grep -m1 --only-matching '[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*'`
avg_ms=`echo "$ping_out" | /bin/grep '^rtt' | cut -d/ -f5`
min_ms=`echo "$ping_out" | sed -n '/^rtt/{s/.* = //;s/\/.*//;p;}'`
vecho 2 IP=$IP min_ms=$min_ms avg_ms=$avg_ms
test -n "${opt_IF-}" && IF=$opt_IF || IF=`IP2if $IP`
MTU=`ifconfig $IF | sed -n -e '/[Mm][Tt][Uu]/{s/.*[Mm][Tt][Uu][: ]*//;s/ .*//;p}'`
vecho 2 IF=$IF MTU=$MTU

set_cpulist_from_IF()
{ itf=$1
  nn_files=`/bin/ls /sys/class/net/$itf/slave*/device/numa_node /sys/class/net/$itf/device/numa_node 2>/dev/null`
  numa_node=-1 dev_itf_list=
  for nnf in $nn_files;do
    # just use first non -1
    test "x`cat $nnf`" != 'x-1' -a "x$numa_node" = 'x-1' && numa_node=`cat $nnf`
    #pull real itf from path
    dev_itf=`expr "$nnf" : '.*/\([^/]*\)/device' | sed s/slave_//`
    echo "$dev_itf_list" | grep $dev_itf >/dev/null && continue
    dev_itf_list="$dev_itf_list
$dev_itf"
    test -n "${opt_flow-}" && ethtool -A $dev_itf autoneg off rx $opt_flow tx $opt_flow
    vecho 0 "`ethtool --show-pause $dev_itf | grep RX`"
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
vecho 0 "`ifconfig $IF | grep -i MTU`"

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
    BWdly_B=`awk "BEGIN{print $MB*$min_ms*1000;exit}"`  # min send window to achive BW (full RTT to get ack from BWdly_B's ago).
    vecho 0 "BW:${Mb}Mb minRTT:${min_ms}ms linkBW*delay: $BWdly_B Bytes"
else
    vecho 0 "\
linkBW (and linkBW*delay) could not be determined - consider --bw=#[mg] option"
fi

#--------------

human2num() # $1=100K
{   hh=$1
    if   nn=`expr "$hh" : '\([0-9]*\)[kK]$'`; then  nn=`expr $nn \* 1024`
    elif nn=`expr "$hh" : '\([0-9]*\)[mM]$'`; then  nn=`expr $nn \* 1024 \* 1024`
    elif nn=`expr "$hh" : '\([0-9]*\)[gG]$'`; then  nn=`expr $nn \* 1024 \* 1024 \* 1024`
    else nn=$hh
    fi
    echo $nn
}
calc() { awk "BEGIN{OFMT=\"${2-%.0f}\";print $1;exit}"; }

if [ -n "${opt_rcvbuf-}" ];then
    max_rcvbuf=0
    for rr in `echo $opt_rcvbuf |sed 's/,/ /g'`;do
        test $rr = default && continue
        xx=`human2num $rr` && test $xx -gt $max_rcvbuf && max_rcvbuf=$xx
    done
    # 124928 is default for 2.6.32-504.30.3
    test $max_rcvbuf -gt `cat /proc/sys/net/core/rmem_max` && echo $xx >|/proc/sys/net/core/rmem_max
fi
if [ -n "${opt_sndbuf-}" ];then
    sb_max=0
    for sb in `echo "${opt_sndbuf-}" | sed 's/,/ /g'`;do
        test $sb = default && continue
        xx=`human2num $sb`;
        test $xx -gt $sb_max && sb_max=$xx
    done
    test $sb_max -gt 124928 && opt_wmem_max=$sb_max # 124928 is default for 2.6.32-504.30.3
else
    opt_sndbuf="default"
fi
test -z "${opt_P-}"             && opt_P=1
test -n "${opt_adv_win_scale-}" && echo $opt_adv_win_scale >|/proc/sys/net/ipv4/tcp_adv_win_scale
test -n "${opt_app_win-}"       && echo $opt_app_win       >|/proc/sys/net/ipv4/tcp_app_win
test -n "${opt_max_backlog-}"   && echo $opt_max_backlog   >|/proc/sys/net/core/netdev_max_backlog
adv_win_scale=`cat /proc/sys/net/ipv4/tcp_adv_win_scale`
app_win=`cat /proc/sys/net/ipv4/tcp_app_win`

vecho 0 "
`grep . /proc/sys/net/{core/{rmem_max,netdev_max_backlog},ipv4/tcp_{moderate_rcvbuf,adv_win_scale,app_win,rmem}}`"

if [ -z "${opt_local-}" ];then
    myIP=`if2IP $IF`
    vecho 1 IF=$IF myIP=$myIP
else
    test -z "${RGANG_RSH-}" \
        && RGANG_RSH="ssh -x -oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null -oLogLevel=ERROR"
    RGANG_RSH="$RGANG_RSH -R5001:localhost:5001"
    export RGANG_RSH
    myIP=localhost
fi

test -n "${opt_initrwnd+1}" && {
routeline=`IP2routeshow $myIP | sed -e 's/ initrwnd .*//'`
/sbin/ip route change `IP2routeshow $myIP | sed -e 's/ initrwnd [0-9]*//'` ${opt_initrwnd:+initrwnd $opt_initrwnd}
/sbin/ip route flush cache
/sbin/ip route show | grep "$routeline"
}

#test $opt_time -gt 10 && interval=--interval=10 || interval=
interval=--interval=1

expr "$IPERF" : '.*3$' >/dev/null && IPERF3_OPTS=-4 || IPERF3_OPTS=

rcmd0='
IP2if()
{ awk_script="function numit(ip){n=split(ip,a,\".\")+1;r=0;while(--n)r+=lshift(a[n],(4-n)*8);return r}/^[0-9]/{if(and(numit(\$3),numit(\"$1\"))==numit(\$1)){print\$8;exit 0}}"
  if_=`/sbin/route -n | sed -n "/^[0-9]/p" | grep -v "^0.0.0.0" | sort -rnk5 |awk "$awk_script"`
  test -n "$if_" && echo $if_ || /sbin/route -n | sed -n "/^[0-9]/p" | sort -rnk5 |awk "$awk_script"
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
'"${opt_txqueuelen+/sbin/ifconfig \$itf txqueuelen $opt_txqueuelen}
"'/sbin/ifconfig $itf | /bin/egrep -i "MTU|txqueuelen"
ff=/sys/class/net/$itf/device/numa_node
test -f $ff && { numa_node=`cat $ff`; cpulist=`cat /sys/devices/system/node/node$numa_node/cpulist`; } || cpulist=0
echo cpulist=$cpulist
'
test `whoami` = root && rcmd0="${rcmd0}/sbin/ip route flush cache
${congestion_control+echo $congestion_control >|/proc/sys/net/ipv4/tcp_congestion_control}
${opt_wmem_max+echo $opt_wmem_max >|/proc/sys/net/core/wmem_max}
"
# tcp_adv_win_scale and tcp_app_win do not apply to send cwnd (congestion window)
#test -n "${opt_adv_win_scale-}" && rcmd0="${rcmd0}echo $opt_adv_win_scale >|/proc/sys/net/ipv4/tcp_adv_win_scale
#"
#test -n "${opt_app_win-}"       && rcmd0="${rcmd0}echo $opt_app_win       >|/proc/sys/net/ipv4/tcp_app_win
#"
test -n "${opt_flow-}" && rcmd0="${rcmd0}ethtool -A \$itf autoneg off rx $opt_flow tx $opt_flow
"
rcmd0="${rcmd0}grep . /proc/sys/net/{core/wmem_max,ipv4/tcp_{congestion_control,no_metrics_save}}
"

# NOTE: it's important to snarf at least 72 bytes to get the tcp options where the
# "window scale" is, so the analysis can completely/accurately determine the window.
test -n "${opt_shark+1}" && rcmd0="${rcmd0}tshark -i\$itf -w/tmp/tshark.dat -s80 ${opt_shark:+-c$opt_shark} -q port 5001 >/tmp/tshark.out 2>&1 & sleep .5
"

rcmd1="num_nodes=$num_nodes num_servers=$num_servers"

# try for 4 permutations -- but deal with small number of initial nodes
inc=`expr $num_nodes / 4`; test $inc -eq 0 && inc=1
lst=`expr $inc \* 3`
files=$nodes_file   # all nodes (whole list) 1st -- to get wmem from all (below)
if [ -n "${opt_permutate-}" ];then
    echo seq $inc $inc $lst
    for nn in `seq $inc $inc $lst`;do
        head -n -$nn $nodes_file >$nodes_file.$nn
        test -s $nodes_file.$nn || continue
        files="$files $nodes_file.$nn"
    done
    grep . $files
fi

if [ -n "${opt_num-}" ];then
    # adjust number of bytes to send based on num_nodes and opt_P
    tmp_num=`human2num $opt_num`
    tmp_num=`expr $tmp_num / \( $num_nodes \* $opt_P \)`
    vecho 1 "adjusting opt_num depending on num_nodes and opt_P from $opt_num to $tmp_num"
    opt_num=$tmp_num; unset tmp_num
fi

test $format = g && fmt=Gb || fmt=Mb
printf "$hdr" $fmt |tee $data_file
#____________date____________ _%s/s_ errs drop ovrun frame __rmt_retrans__ flows inflight(K) rcv(K) snd(K) rcalc(K)\n
#un Mar 20 15:06:21 CDT 2016  16.70  283    0     0   283 16598 16375 223     5     488.0    85.3  
for nfile in $files;do  # for when opt_permutate

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
    rcmd1="num_nodes=$num_nodes num_servers=$num_servers"    # redo in case of opt_permutate

    if [ -n "${opt_shark+1}" ];then
        ip_list=
        for nn in `cat $nfile`;do
            ip=`ping -c1 -q $nn | /bin/grep -m1 --only-matching '[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*'`
            ip_list="$ip_list $ip"
        done
    fi

    for Para in `echo "$opt_P" | sed 's/,/ /g'`;do
      for wrrd_len in `echo "${opt_len:-default}" | sed 's/,/ /g'`;do
        test $wrrd_len = default && wrrd_len=

        for sbuf in `echo "$opt_sndbuf" | sed 's/,/ /g'`;do
            test $sbuf = default && sbuf=
            vecho 2 sbuf=$sbuf

            rcmd2='poff=`awk "BEGIN{nps=$num_nodes/$num_servers;xx=$RGANG_MACH_ID/nps;print int(xx);exit;}"`
port=`expr 5001 + $poff`
markRetrans;'
rcmd3="taskset -c \$cpulist $IPERF $IPERF3_OPTS -c $myIP ${trade_off-} ${dualtest-} ${wrrd_len:+-l$wrrd_len}"
rcmd3="$rcmd3 ${sbuf:+-w$sbuf} ${opt_bwudp+-b$opt_bwudp -u} --format=k --port=\$port ${Para:+-P$Para} --time=$opt_time"
rcmd3="$rcmd3 ${opt_bandwidth+-b$opt_bandwidth} ${opt_num:+--num=$opt_num} $interval"
rcmd4='
echo deltaRetrans: `deltaRetrans`
/sbin/ethtool --show-pause $itf
dmesg | tail -20 | grep $itf | tail -5'

            test -n "${opt_shark+1}" && rcmd4="$rcmd4"'
killall tshark
tshark -nn -r /tmp/tshark.dat | awk '"'"'
/5001 >/{ack=gensub(/.*Ack=([0-9]*).*/,"\\1",1);win=gensub(/.*Win=([0-9]*).*/,"\\1",1)
}
/> 5001/{
 seq=strtonum(gensub(/.*Seq=([0-9]*).*/,"\\1",1))
 if(seq>prev_seq){
  len=gensub(/.*Len=([0-9]*).*/,"\\1",1)
  infl=seq+len-ack
  winpct=infl*100/win
  winpcttot+=winpct
  if(winpct>winpctmax)winpctmax=winpct
  if(infl>max)max=infl
  ++cnt;tot+=infl
 }else{ ++retrans }
 prev_seq=seq
}
END{
printf("inflight:%5.1f,%6.1f,%4.1f%%,%5.1f%% retrans:%d/%d\n",tot/cnt/1024,max/1024,winpcttot/cnt,winpctmax,retrans,retrans+cnt)
}'"'"

            vecho 2 rcmd size: `echo "$rcmd0$rcmd1;$rcmd2$rcmd3$rcmd4" | wc -c`
            vecho 1 "The iperf client cmd is: $rcmd3"

            for rbuf in $rcvbufs;do
                if [ "$rbuf" = "default" ];then
                    window=
                    # NOTE: empirically (i.e. tshark), it works out if I double the value in tcp_rmem
                    #rbuf_bytes=`awk '{print$3}' /proc/sys/net/ipv4/tcp_rmem`
                    rb=`awk '{print$3/2}' /proc/sys/net/ipv4/tcp_rmem` # it's 4M is equiv to SO_RCVBUF 2M
                else
                    window=--window=$rbuf
                    rb=`human2num $rbuf`
                fi
                rbuf_bytes=`expr $rb \* 2`


                # RUN THE iperf SERVER
                last_seq=`expr $num_servers - 1` srvr_pid=
                for poff in `seq 0 $last_seq`;do
                    port=`expr 5001 + $poff`
                    #note taskset -c needs space between it and $cpulist
                    test $poff -eq 0 && vecho 1 \
"The iperf server cmd is: taskset -c $cpulist $IPERF $IPERF3_OPTS -s ${opt_bwudp+-u} ${wrrd_len:+-l$wrrd_len} $interval --port=$port --format=K $window >$srvr_ofile.$poff 2>&1 &"
                          taskset -c $cpulist $IPERF $IPERF3_OPTS -s ${opt_bwudp+-u} ${wrrd_len:+-l$wrrd_len} $interval --port=$port --format=K $window >$srvr_ofile.$poff 2>&1 &
                    srvr_pid="$srvr_pid $!"
                done

                vecho 2 iperf server pid=$srvr_pid
                sleep .5 # give server a chance to output info for next lines
                if [ -z "${opt_bwudp-}" ];then
                    rbufK=`awk "BEGIN{printf\"%.1f\n\",$rb/1024}"`
                    rbufB=$rbuf_bytes
                    #set -x
                    if   [ $adv_win_scale -gt 0 -a $app_win -eq 0 ];then
                        max_rwinK=`awk "BEGIN{printf\"%.1f\",($rbufB - $rbufB/2^$adv_win_scale)/1024}"`
                    elif [ $adv_win_scale -le 0 -a $app_win -eq 0 ];then
                        max_rwinK=`awk "BEGIN{printf\"%.1f\",($rbufB - ($rbufB-$rbufB/2^- $adv_win_scale))/1024}"`
                    elif [ $adv_win_scale -gt 0 -a $app_win -ne 0 ];then  # note: appwin cannot be negative
                        awresB=`awk "function max(x,y){return x>y?x:y}BEGIN{print max($rbufB/2^$app_win,$MTUX*$MTU);exit}"`
                        rbufB2=`expr $rbufB - $awresB`
                        windowB=`awk "BEGIN{printf\"%.1f\",$rbufB2 - $rbufB2/2^$adv_win_scale}"`
                        max_rwinK=`awk "BEGIN{printf\"%.1f\",($windowB)/1024}"`
                    else
                        awresB=`awk "function max(x,y){return x>y?x:y}BEGIN{print max($rbufB/2^$app_win,$MTUX*$MTU);exit}"`
                        rbufB2=`expr $rbufB - $awresB`
                        windowB=`awk "BEGIN{printf\"%.1f\",$rbufB2 - ($rbufB2-$rbufB2/2^- $adv_win_scale)}"`
                        max_rwinK=`awk "BEGIN{printf\"%.1f\",$windowB/1024}"`
                    fi
                    #set +x
                else
                    rbufK=`awk '/UDP buffer/{print $4;exit;}' $srvr_ofile.0`
                    max_rwinK=$rbufK
                fi
                inflight=`awk "BEGIN{print $num_nodes * $max_rwinK${Para:+ * $Para};exit;}"`  # note: * num_parallel
                flows=`awk "BEGIN{print $num_nodes${Para:+ * $Para};exit;}"`

                nn=`expr $num_tests + 1` # so while num_test=`expr... gives expect results
                while nn=`expr $nn - 1`;do
                    if [ -n "${opt_shark+1}" ];then
                        node_cnt=0 shark_pid_list=
                        # assume all on same IF
                        taskset -c $cpulist tshark -i$IF -q -w$shark_file_prefix.$$.$port.$node_cnt ${opt_shark:+-c$opt_shark} -s80 -q port $port >$shark_file_prefix.$$.$port.$node_cnt.out 2>&1 &
                        shark_pid_list="$shark_pid_list $!"
                    fi

                    # RUN THE iperf CLIENTs
                    lcl_stats_mark
                    test $opt_v -le 3\
                        && { $RGANG $nfile "$rcmd0$rcmd1;$rcmd2$rcmd3$rcmd4" >$clnt_ofile 2>&1; echo $? >$clnt_ofile.sts; } \
                        || ( $RGANG $nfile "$rcmd0$rcmd1;$rcmd2$rcmd3$rcmd4" 2>&1; echo $? >$clnt_ofile.sts ) | tee $clnt_ofile
                    rgang_sts=`cat $clnt_ofile.sts`
                    test 0 -ne $rgang_sts && echo "Warning: rgang returned non-zero exit status ($rgang_sts)"
                    lcl_delt=`lcl_stats_delta`  # quadruple (4 numbers)
                    ( echo test `expr $num_tests + 1 - $nn`:; cat $clnt_ofile ) >>$clnt_ofile.all_tests

                    if [ -z "${opt_bwudp-}" ];then
                        rmt_delt=`grep deltaRetrans $clnt_ofile | tot_delt_retrans` # triplet (3 numbers)
                    else
                        tail_lines=`expr 3 \* $num_servers`
                        drop_pcnt=`tail -n$tail_lines $srvr_ofile.0 | awk '/[0-9]\/[0-9]/{split($(NF-1),a,/\//);d+=a[1];t+=a[2];}END{printf "%4.1f\n",100*d/t;}'`
                        rmt_delt="0 $drop_pcnt% 0"   # should be noted somewhere that w/UDP, not "retrans", but "drop%"
                    fi
                    test $format = g && mORg=1000000 || mORg=1000
                    # [  3]  0.0- 1.0 sec  320000 KBytes  2621440 Kbits/sec
                    # [  3]  0.0-20.2 sec  7983744 KBytes  3243172 Kbits/sec
                    # [  3]  0.0- 1.0 sec  429312 KBytes  3516924 Kbits/sec
                    # [  3]  0.0-20.2 sec  10055252 KBytes  4086747 Kbits/sec
                    # [  3]  0.0- 1.0 sec  273792 KBytes  2242904 Kbits/sec
                    # [  3]  0.0-20.2 sec  5805696 KBytes  2358249 Kbits/sec
                    if [ -n "${opt_num-}" ];then
                        # time will vary in this mode:
                        # ignoring [SUM] (when -P >1) -- when $7 is not a number, 0 is added
                        tot_Xb=`awk "/ 0\.00*- *[1-9][0-9]*\./"'{if(NF<=9)tot+=$7}'"END{print tot/$mORg}" $clnt_ofile`
                    else
                        # iperf v2 will have 8 fields on the " 0\.00*-$opt_time\." line, where as iperf v3 will have 9 for rcv and 10 for snd (we just want the rcv)
                        tot_Xb=`awk "/ 0\.00*-$opt_time\./"'{if(NF<=9)tot+=$7}'"END{print tot/$mORg}" $clnt_ofile`
                    fi
                    SndBuf=`awk '/TCP win/{win[ii++]=$4}END{zz=" ";for(xx=1;xx<ii;++xx){if(win[xx]!=win[xx-1]){zz="*";break}}print win[0] zz}' $clnt_ofile`
                    # NOTE $rmt_delt is 3 numbers
                    printf "%29s %6.2f %4d %4d %5d %5d %6d %6s %3d %5d  %9.1f  %7.1f %7s %7s\n" "`date`"\
                        $tot_Xb $lcl_delt $rmt_delt $flows $inflight $rbufK "$SndBuf" "$max_rwinK" |tee -a $data_file

                    vecho 1 "
`egrep -i 'mtu|no_metrics_save' $clnt_ofile`"
                    if [ -n "${opt_shark+1}" ];then
                        kill $shark_pid_list 2>/dev/null
                        inflights=`grep inflight $clnt_ofile`
                        grep -i drop $shark_file_prefix.$$.$port.0.out
                        cc=0
                        for ip in $ip_list;do
                            wins=`tshark -r$shark_file_prefix.$$.$port.0 -n -R "ip.host==$ip" 2>/dev/null | awk "\
/$port >/"'{
  win=strtonum(gensub(/.*Win=([0-9]*).*/,"\\\\1",1))
  if (tot==0) {
    initial=win; min=win; max=win
  }
  if (win > max) { max=win }
  if (win < min) { min=win }
  tot+=win; ++cnt;
}
END{ave=tot/cnt;printf("%4.1f %4.1f %5.1f %5.1f",initial/1024,min/1024,ave/1024,max/1024)}'`
                            cc=`expr $cc + 1`
                            echo "wins=$wins "`echo "$inflights" | sed -n -e"${cc}p"`
                        done
                    fi
                done  # num_tests

                # The next 4 lines are use to assure "Hangup/exit" msg from sh is not seen
                exec 3>&1 4>&2 >/dev/null 2>&1 # save stdout/err then redirect
                for pp in $srvr_pid;do kill -HUP $pp; done
                srvr_pid=
                sleep 1
                exec 1>&3 2>&4 3>&- 4>&-       # restore/release
                vecho 3 "server output:
`cat $srvr_ofile.*`"

            done  # rcvbufs
        done # sndbufs
      done # wrrd_len ($opt_len)
    done # opt_P (parallel)
    if [ -z "${do_this_once-}" ];then
        do_this_once=x
        vecho 2 "remote (client) info:"
        vecho 2 "`echo;egrep -i 'wmem_max|congestion_control|txqueuelen|TX|MTU' $clnt_ofile`"
    fi

done  # files
