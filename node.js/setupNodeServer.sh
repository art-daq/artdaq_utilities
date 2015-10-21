#!/bin/bash

npm install xml2js xmlrpc

# only set up the certificates if they're not there already
if ! [ -d certs ]; then
  mkdir certs
fi

if ! [ -e certs/server.crt ]; then
  cd certs
  openssl req -nodes -newkey rsa:2048 -keyout server.key -out server.csr -subj "/C=US/ST=IL/L=Batavia/O=FNAL.GOV/OU=SCD/CN=`hostname -f`"
  openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
  rm -f server.csr
  cd ..
fi

if ! [ -e certs/authorized_users ];then
  cd certs
  echo "`whoami`@FNAL.GOV" >>authorized_users
  cd ..
fi
