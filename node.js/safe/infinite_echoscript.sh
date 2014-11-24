#!/bin/bash
# October 29, 2014, ELF
# infinite_echoscript.sh: Test script which prints the line
# number and either "Output" or "Error" to StdOut or StdErr,
# respectively. Will continue to do this until killed

counter=0
while (true); do
if [ $RANDOM -gt 16535 ]; then
  echo "$counter: Output"
else
  echo "$counter: Error" >&2
fi

#usleep 500000
counter=$(($counter+1))
done
