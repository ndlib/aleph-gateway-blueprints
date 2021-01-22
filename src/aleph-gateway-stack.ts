import * as cdk from '@aws-cdk/core'
import { Fn, SecretValue } from '@aws-cdk/core'
import apigateway = require('@aws-cdk/aws-apigateway')
import lambda = require('@aws-cdk/aws-lambda')
import { RetentionDays } from '@aws-cdk/aws-logs'
import { StringParameter } from '@aws-cdk/aws-ssm'
import { Vpc, SecurityGroup, Subnet } from '@aws-cdk/aws-ec2'

export interface IAlephGatewayStackProps extends cdk.StackProps {
  readonly stage: string
  readonly lambdaCodePath: string
  readonly sentryProject: string
  readonly sentryVersion: string
  readonly secretsPath: string
  readonly networkStackName: string
}

export default class AlephGatewayStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: IAlephGatewayStackProps) {
    super(scope, id, props)

    // LAMBDAS
    const paramStorePath = `/all/aleph-gateway/${props.stage}`
    const env = {
      SENTRY_DSN: StringParameter.valueForStringParameter(this, `${paramStorePath}/sentry_dsn`),
      SENTRY_ENVIRONMENT: props.stage,
      SENTRY_RELEASE: `${props.sentryProject}@${props.sentryVersion}`,
      ALEPH_URL: StringParameter.valueForStringParameter(this, `${paramStorePath}/aleph_url`),
      AUTHORIZED_CLIENTS: StringParameter.valueForStringParameter(this, `${paramStorePath}/authorized_clients`),
      DEFAULT_LIBRARY: 'ndu50',
    }
    const dbEnv = {
      ALEPH_ORACLE_USER: SecretValue.secretsManager(props.secretsPath, { jsonField: 'db_user' }).toString(),
      ALEPH_ORACLE_PWD: SecretValue.secretsManager(props.secretsPath, { jsonField: 'db_password' }).toString(),
      ALEPH_ORACLE_HOST: SecretValue.secretsManager(props.secretsPath, { jsonField: 'db_host' }).toString(),
      ALEPH_ORACLE_PORT: SecretValue.secretsManager(props.secretsPath, { jsonField: 'db_port' }).toString(),
      ALEPH_ORACLE_SID: SecretValue.secretsManager(props.secretsPath, { jsonField: 'db_sid' }).toString(),
    }

    // VPC needed to access certain APIs.
    const vpcId = Fn.importValue(`${props.networkStackName}:VPCID`)
    const lambdaVpc = Vpc.fromVpcAttributes(this, 'LambdaVpc', {
      vpcId,
      availabilityZones: [Fn.select(0, Fn.getAzs()), Fn.select(1, Fn.getAzs())],
      publicSubnetIds: [
        Fn.importValue(`${props.networkStackName}:PublicSubnet1ID`),
        Fn.importValue(`${props.networkStackName}:PublicSubnet2ID`),
      ],
      privateSubnetIds: [
        Fn.importValue(`${props.networkStackName}:PrivateSubnet1ID`),
        Fn.importValue(`${props.networkStackName}:PrivateSubnet2ID`),
      ],
    })
    const subnetId = StringParameter.valueForStringParameter(this, `${paramStorePath}/subnetid`)
    const availabilityZone = StringParameter.valueForStringParameter(this, `${paramStorePath}/subnet-az`)
    // Subnet.fromSubnetId doesn't get availability zone, which is apparently necessary for some constructs
    const subnet = Subnet.fromSubnetAttributes(this, 'VpcSubnet', {
      subnetId: subnetId,
      availabilityZone: availabilityZone,
    })

    const securityGroupId = StringParameter.valueForStringParameter(this, `${paramStorePath}/securitygroupid`)
    const securityGroup = SecurityGroup.fromSecurityGroupId(this, 'LambdaSecurityGroup', securityGroupId)

    const oracleLayerArn = StringParameter.valueForStringParameter(this, `/all/oracle-lambda-layer/layer-version-arn`)
    const oracleLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OracleLambdaLayer', oracleLayerArn)

    const borrowedLambda = new lambda.Function(this, 'BorrowedFunction', {
      functionName: `${props.stackName}-borrowed`,
      description: 'Get items loaned to the user.',
      code: lambda.Code.fromAsset(props.lambdaCodePath),
      handler: 'borrowed.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: env,
      vpc: lambdaVpc,
      vpcSubnets: {
        subnets: [subnet],
      },
      securityGroups: [securityGroup],
    })

    const pendingLambda = new lambda.Function(this, 'PendingFunction', {
      functionName: `${props.stackName}-pending`,
      description: 'Get pending loan items for a user.',
      code: lambda.Code.fromAsset(props.lambdaCodePath),
      handler: 'pending.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: env,
      vpc: lambdaVpc,
      vpcSubnets: {
        subnets: [subnet],
      },
      securityGroups: [securityGroup],
    })

    const itemLambda = new lambda.Function(this, 'ItemFunction', {
      functionName: `${props.stackName}-item`,
      description: 'Get aleph item details by system number.',
      code: lambda.Code.fromAsset(props.lambdaCodePath),
      handler: 'item.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: env,
      vpc: lambdaVpc,
      vpcSubnets: {
        subnets: [subnet],
      },
      securityGroups: [securityGroup],
    })

    const renewLambda = new lambda.Function(this, 'RenewFunction', {
      functionName: `${props.stackName}-renew`,
      description: 'Renew an item loaned from aleph.',
      code: lambda.Code.fromAsset(props.lambdaCodePath),
      handler: 'renew.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: env,
      vpc: lambdaVpc,
      vpcSubnets: {
        subnets: [subnet],
      },
      securityGroups: [securityGroup],
    })

    const userInfoLambda = new lambda.Function(this, 'UserInfoFunction', {
      functionName: `${props.stackName}-userInfo`,
      description: 'Gets account information for a user from Aleph.',
      code: lambda.Code.fromAsset(props.lambdaCodePath),
      handler: 'directQuery/userInfo.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...env,
        ...dbEnv,
      },
      vpc: lambdaVpc,
      vpcSubnets: {
        subnets: [subnet],
      },
      securityGroups: [securityGroup],
      layers: [oracleLayer],
    })

    const circHistoryLambda = new lambda.Function(this, 'CircHistoryFunction', {
      functionName: `${props.stackName}-circhistory`,
      description: `Query aleph for user's circulation history`,
      code: lambda.Code.fromAsset(props.lambdaCodePath),
      handler: 'directQuery/circHistory.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...env,
        ...dbEnv,
      },
      vpc: lambdaVpc,
      vpcSubnets: {
        subnets: [subnet],
      },
      securityGroups: [securityGroup],
      layers: [oracleLayer],
    })

    const queryLambda = new lambda.Function(this, 'QueryFunction', {
      functionName: `${props.stackName}-query`,
      description: `Query aleph for records by issn or isbn.`,
      code: lambda.Code.fromAsset(props.lambdaCodePath),
      handler: 'directQuery/query.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...env,
      },
      vpc: lambdaVpc,
      vpcSubnets: {
        subnets: [subnet],
      },
      securityGroups: [securityGroup],
    })

    // API GATEWAY
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: props.stackName,
      description: 'Aleph Gateway API',
      endpointExportName: `${props.stackName}-api-url`,
      deployOptions: {
        stageName: props.stage,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowCredentials: false,
        statusCode: 200,
      },
    })
    api.addRequestValidator('RequestValidator', {
      validateRequestParameters: true,
    })

    const authMethodOptions = {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
        handler: lambda.Function.fromFunctionArn(
          this,
          'AuthorizerFunction',
          `arn:aws:lambda:${this.region}:${this.account}:function:lambda-auth-${props.stage}`,
        ),
        identitySource: 'method.request.header.Authorization',
        authorizerName: 'jwt',
        resultsCacheTtl: cdk.Duration.minutes(5),
      }),
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    }

    const endpointData = [
      { path: '/borrowed', method: 'GET', lambda: borrowedLambda, requiresAuth: true },
      { path: '/pending', method: 'GET', lambda: pendingLambda, requiresAuth: true },
      { path: '/renew', method: 'POST', lambda: renewLambda, requiresAuth: true },
      { path: '/user', method: 'GET', lambda: userInfoLambda, requiresAuth: true },
      { path: '/circhistory', method: 'GET', lambda: circHistoryLambda, requiresAuth: true },
      { path: '/query', method: 'GET', lambda: queryLambda, requiresAuth: false },
    ]
    endpointData.forEach((endpoint) => {
      const newResource = api.root.resourceForPath(endpoint.path)
      const methodOptions = endpoint.requiresAuth ? authMethodOptions : undefined
      newResource.addMethod(endpoint.method, new apigateway.LambdaIntegration(endpoint.lambda), methodOptions)
    })
    // This one is special because it uses a path param and it doesn't require authorization
    const itemResource = api.root.addResource('{systemId}')
    const itemIntegration = new apigateway.LambdaIntegration(itemLambda, {
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
      requestParameters: {
        'integration.request.path.systemId': 'method.request.path.systemId',
      },
    })
    const itemMethodOptions = {
      requestParameters: {
        'method.request.path.systemId': true,
      },
    }
    itemResource.addMethod('GET', itemIntegration, itemMethodOptions)

    // Output API url to ssm so we can import it in the QA project
    new StringParameter(this, 'ApiUrlParameter', {
      parameterName: `${paramStorePath}/api-url`,
      description: 'Path to root of the API gateway.',
      stringValue: api.url,
    })
  }
}
