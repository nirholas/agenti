import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface WebUiStackProps extends cdk.StackProps {
  /** AgentCore Runtime ARN */
  agentRuntimeArn?: string;
  /** Agent wallet address for balance display */
  walletAddress?: string;
}

export class WebUiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: WebUiStackProps) {
    super(scope, id, props);

    // Get runtime ARN from props or environment
    const agentRuntimeArn = props?.agentRuntimeArn || 
      process.env.AGENT_RUNTIME_ARN || 
      '';

    const walletAddress = props?.walletAddress ||
      process.env.WALLET_ADDRESS ||
      '';

    // =========================================================================
    // API Lambda - Proxy to AgentCore Runtime
    // =========================================================================

    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'api_handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        AGENT_RUNTIME_ARN: agentRuntimeArn,
        WALLET_ADDRESS: walletAddress,
      },
    });

    // Grant permission to invoke AgentCore Runtime
    apiHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: agentRuntimeArn
        ? [agentRuntimeArn]
        : ['*'],  // Fallback to wildcard only if ARN not provided
    }));

    // API Gateway with proper IAM controls (no open Lambda policies)
    // Note: API Gateway has 29s timeout limit - complex payment flows may timeout
    const api = new apigateway.RestApi(this, 'WebUiApi', {
      restApiName: 'x402-web-ui-api',
      description: 'API proxy for x402 web UI to AgentCore Runtime (29s timeout limit)',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(apiHandler);

    // Routes
    api.root.addResource('health').addMethod('GET', lambdaIntegration);
    api.root.addResource('info').addMethod('GET', lambdaIntegration);
    api.root.addResource('invoke').addMethod('POST', lambdaIntegration);
    api.root.addResource('wallet').addMethod('GET', lambdaIntegration);

    // =========================================================================
    // Static Website Hosting
    // =========================================================================

    const websiteBucket = new s3.Bucket(this, 'WebUiBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'WebUiOAI',
      { comment: 'OAI for x402 Web UI' }
    );

    websiteBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'WebUiDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, { originAccessIdentity }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // Deploy web-ui dist folder
    new s3deploy.BucketDeployment(this, 'WebUiDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../web-ui/dist'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'WebUiUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Web UI URL',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint (29s timeout limit)',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}
