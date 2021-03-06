# aleph-gateway-blueprints

## Description
Infrastructure for [aleph-gateway](https://github.com/ndlib/aleph-gateway) microservice.

## Setup
[Download Oracle instant client](https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html) version 19.8 of the "Basic Light Package".

- instantclient-basiclite-linux.x64-19.8.0.0.0dbru.zip

Place the zip at the repo root, then run `./setup.sh`, which will in turn run `./oracle-install.sh`, unpacking the zip.
The necessary files will be copied to `oracle-instant-client/lib`, which should already contain `libaio.so.1`. This is a dependency for the instant client to work, and cannot be compiled on Mac, so it is checked in precompiled.

## Deployment
### Service deployment
```
cdk deploy -c stage=dev aleph-gateway-dev
```

### Pipeline deployment
In order for the CodePipeline to build successfully, the `oracle-lambda-layer` stack should be deployed. If this is the first time deploying to the aws account, download the Oracle Instant Client as described above, then deploy the stack:
```
cdk deploy oracle-lambda-layer
```
Once this stack is in place, deploy the pipeline:
```
cdk deploy aleph-gateway-pipeline -c slackNotifyStackName=slack-approval-bot-wse-notifier
```
