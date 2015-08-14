#!/bin/bash
echo $PWD
artdaqDir=$1
setupScript=$2
fileName=$3
echo "Sourcing $artdaqDir/$setupScript"
source $artdaqDir/$setupScript
stdbuf -o 0 art -c $artdaqDir/artdaq-demo/artdaq-demo/ArtModules/fcl/udpDump.fcl $fileName
exit

