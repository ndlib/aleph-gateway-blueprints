#!/bin/bash
# In CodePipeline, we won't have the client libraries. Assume the lambda layer has already been deployed
# Check if one of the required files exists. If it does, assume it's already been installed and skip this step.
if [[ ${CI:=false} != true && (! -f './oracle-instant-client/lib/libociicus.so') ]]
then
  ./oracle-install.sh || { echo "Failed to install oracle instant client."; exit 1; }
fi

yarn install
