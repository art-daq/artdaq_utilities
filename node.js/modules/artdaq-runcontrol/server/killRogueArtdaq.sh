#!/bin/bash

kill -9 `ps -fu $USER|grep pmt.rb|awk '{print $2}'`
kill -9 `ps -fu $USER|grep start2x2x2System.sh|awk '{print $2}'`
