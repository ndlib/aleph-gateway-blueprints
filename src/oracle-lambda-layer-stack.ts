import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as ssm from '@aws-cdk/aws-ssm'
import fs = require('fs')

export default class OracleLambdaLayerStack extends cdk.Stack {
  readonly layer: lambda.LayerVersion
  readonly param: ssm.StringParameter

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Check for one of the required files. We assume if they have this they probably ran the script to copy everything.
    if (!process.env.CI && !fs.existsSync('./oracle-instant-client/lib/libociicus.so')) {
      throw new Error('Oracle instant client files appear to be missing. Please read the README.')
    }

    this.layer = new lambda.LayerVersion(this, 'OracleLayerVersion', {
      layerVersionName: `oracle-lambda-layer`,
      code: new lambda.AssetCode('./oracle-instant-client'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
      description: 'A layer with Oracle Instant Client for connecting to an Oracle database inside a lambda.',
    })

    // Output layer version to parameter store so that we can import that with the service stack.
    // This allows us to update the lambda layer in place, then update the service stack (usually immediately after)
    // to get the latest version of the layer.
    this.param = new ssm.StringParameter(this, 'OracleLayerVersionParameter', {
      parameterName: `/all/oracle-lambda-layer/layer-version-arn`,
      description: 'ARN for the lambda layer including the version number.',
      stringValue: this.layer.layerVersionArn,
    })
  }
}
