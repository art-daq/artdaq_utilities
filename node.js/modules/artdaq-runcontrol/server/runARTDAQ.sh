#!/bin/bash
echo $PWD
configFile="$PWD/modules/artdaq-configuration/server/$1"
echo "Config File is $configFile"
cp $configFile $2
artdaqDir=`grep -oE "<artdaqDir>(.*?)</artdaqDir>" $configFile|sed -r 's/<\/?artdaqDir>//g'`
echo $artdaqDir
setupScript=`grep -oE "<setupScript>(.*?)</setupScript>" $configFile|sed -r 's/<\/?setupScript>//g'`
echo "Sourcing $artdaqDir/$setupScript"
source $artdaqDir/$setupScript
export ARTDAQDEMO_BASE_PORT=$3
shift
shift
shift
stdbuf -o 0 $*
exit

