#!/bin/bash
# October 30, 2014, ELF:
# inputtest.sh: A demonstrator of a script recieving StdIn data
#

echo "Please type something in..."

read something

echo "Good. Now type something else in..."

read -t 7 something_else

if [ "$something_else" != "$something" ] && [ "$something_else" != "" ]; then
  echo "Thanks!"
  exit 0
elif [ "$something_else" != "" ]; then
  echo "You didn't type something else!" >&2
  exit 1
else
  echo "Timeout Expired!" >&2
  exit 2
fi
