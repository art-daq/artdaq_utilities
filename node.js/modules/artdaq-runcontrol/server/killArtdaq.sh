#!/bin/bash

pid=$1
pids=$pid

child=`ps --ppid $pid|grep -v "PID"|awk '{print $1}'`
pids+=" "
pids+=$child

while [ $child ]; do
  child=`ps --ppid $child|grep -v "PID"|awk '{print $1}'`
  pids+=" "
  pids+=$child
done

kill $pids
