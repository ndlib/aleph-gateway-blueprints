#!/bin/bash
# In CodePipeline, we won't have the client libraries. Assume the lambda layer has already been deployed
if [ ${CI:=false} != true ]
then
  ./oracle-install.sh || { echo "Failed to install oracle instant client."; exit 1; }
fi

yarn install
