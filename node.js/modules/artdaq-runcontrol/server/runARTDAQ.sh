#!/bin/bash
source $1/$2
export ARTDAQDEMO_BASE_PORT=$3
shift
shift
shift
stdbuf -o 0 $*
exit

