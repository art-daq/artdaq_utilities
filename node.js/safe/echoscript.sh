#!/bin/bash
# October 29, 2014, ELF
# echoscript.sh: Test script which prints the line
# number and either "Output" or "Error" to StdOut or StdErr,
# respectively. Runs 100 times and then exits.

counter=0
while [ $counter -lt 100 ]; do
if [ $RANDOM -gt 16535 ]; then
  echo "$counter: Output"
else
  echo "$counter: Error" >&2
fi

#usleep 500000
counter=$(($counter+1))
done
