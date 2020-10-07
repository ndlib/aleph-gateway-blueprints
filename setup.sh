#!/bin/bash
./oracle-install.sh || { echo "Failed to install oracle instant client."; exit 1; }

yarn install
