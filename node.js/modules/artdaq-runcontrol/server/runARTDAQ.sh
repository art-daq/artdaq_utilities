#!/bin/bash
source $1/$2
shift
shift
stdbuf -o 0 $*
exit

