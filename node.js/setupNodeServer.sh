#!/bin/bash

npm install xml2js xmlrpc
mkdir certs
cd certs
openssl req -nodes -newkey rsa:2048 -keyout server.key -out server.csr -subj "/C=US/ST=IL/L=Batavia/O=FNAL.GOV/OU=SCD/CN=`hostname`"
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
rm -f server.csr
echo "`whoami`@FNAL.GOV" >>authorized_users
cd ..
