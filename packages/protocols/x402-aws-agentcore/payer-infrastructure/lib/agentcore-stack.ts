import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as s3_assets from 'aws-cdk-lib/aws-s3-assets';
import * as path from 'path';
import * as fs from 'fs';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

/**
 * Rate limiting configuration for the AgentCore Gateway.
 */
export interface RateLimitConfig {
  /** Requests per second per client (default: 10) */
  requestsPerSecond: number;
  /** Burst capacity for handling traffic spikes (default: 20) */
  burstCapacity: number;
  /** Rate limit by IAM principal or IP address */
  limitBy: 'IAM_PRINCIPAL' | 'IP_ADDRESS';
  /** Enable rate limit alarms */
  enableAlarms: boolean;
  /** Threshold percentage for rate limit warning alarm (default: 80) */
  warningThresholdPercent: number;
}

/**
 * Gateway target configuration for MCP tool server.
 */
export interface GatewayTargetConfig {
  /** Name of the target */
  name: string;
  /** Description of the target */
  description: string;
  /** Target URL (CloudFront distribution URL) */
  targetUrl: string;
  /** Path to OpenAPI spec file (relative to payer-agent directory) */
  openApiSpecPath?: string;
}

/**
 * CDK Stack for Bedrock AgentCore infrastructure.
 * 
 * Note: AgentCore CDK L2 constructs are under development (RFC #785).
 * This stack uses L1 constructs and IAM roles for AgentCore integration.
 * 
 * For production deployment, use the AgentCore CLI or console to create:
 * - AgentCore Runtime
 * - AgentCore Gateway
 * - AgentCore Memory (optional)
 * 
 * Gateway Configuration:
 * - IAM SigV4 authentication for secure API access
 * - Rate limiting to prevent abuse
 * - CORS support for web clients
 * - CloudWatch logging and metrics
 */

export interface AgentCoreStackProps extends cdk.StackProps {
  /** Rate limiting configuration */
  rateLimitConfig?: Partial<RateLimitConfig>;
  /** Gateway target configuration for MCP tool server */
  gatewayTargetConfig?: GatewayTargetConfig;
  /** CloudFront distribution URL for seller infrastructure */
  sellerCloudFrontUrl?: string;
}

export class AgentCoreStack extends cdk.Stack {
  public readonly gatewayRole: iam.Role;
  public readonly gatewayLogGroup: logs.LogGroup;
  public readonly rateLimitAlarmTopic: sns.Topic;
  public readonly rateLimitConfig: RateLimitConfig;
  public readonly openApiSpecAsset: s3_assets.Asset;
  public readonly gatewayTargetRole: iam.Role;

  constructor(scope: Construct, id: string, props?: AgentCoreStackProps) {
    super(scope, id, props);

    // Get seller CloudFront URL from props, environment, or payer-agent/.env
    let sellerCloudFrontUrl = props?.sellerCloudFrontUrl
      || process.env.X402_SELLER_CLOUDFRONT_URL;
    if (!sellerCloudFrontUrl) {
      const envPath = path.join(__dirname, '../../payer-agent/.env');
      if (fs.existsSync(envPath)) {
        const match = fs.readFileSync(envPath, 'utf-8').match(/^SELLER_API_URL=(.+)$/m);
        if (match) sellerCloudFrontUrl = match[1].trim();
      }
    }
    sellerCloudFrontUrl = sellerCloudFrontUrl || 'https://REPLACE_WITH_CLOUDFRONT_URL.cloudfront.net';

    // Initialize rate limit configuration with defaults
    this.rateLimitConfig = {
      requestsPerSecond: props?.rateLimitConfig?.requestsPerSecond ?? 10,
      burstCapacity: props?.rateLimitConfig?.burstCapacity ?? 20,
      limitBy: props?.rateLimitConfig?.limitBy ?? 'IAM_PRINCIPAL',
      enableAlarms: props?.rateLimitConfig?.enableAlarms ?? true,
      warningThresholdPercent: props?.rateLimitConfig?.warningThresholdPercent ?? 80,
    };

    // ==========================================
    // OpenAPI Spec Asset for Gateway Target
    // ==========================================
    // Upload the OpenAPI spec to S3 for use by AgentCore Gateway
    this.openApiSpecAsset = new s3_assets.Asset(this, 'OpenApiSpecAsset', {
      path: path.join(__dirname, '../../payer-agent/openapi/content-tools.yaml'),
    });

    // Secret for CDP API credentials
    const cdpSecret = new secretsmanager.Secret(this, 'CdpApiSecret', {
      secretName: 'x402-payer-agent/cdp-credentials',
      description: 'Coinbase Developer Platform API credentials for x402 payer agent',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          CDP_API_KEY_NAME: 'REPLACE_WITH_YOUR_KEY_NAME',
        }),
        generateStringKey: 'CDP_API_KEY_PRIVATE_KEY',
      },
    });

    // IAM Role for AgentCore Runtime
    const agentRuntimeRole = new iam.Role(this, 'AgentRuntimeRole', {
      roleName: 'x402-payer-agent-runtime-role',
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'IAM role for x402 payer agent running on AgentCore Runtime',
    });

    // Bedrock model access
    // Note: Cross-region inference profiles (us.anthropic.claude-*) route to different regions,
    // so we need to allow all regions for foundation models.
    agentRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        // Foundation models in all regions (for cross-region inference)
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        // Cross-region inference profiles
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
      ],
    }));

    // Secrets Manager access
    agentRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [cdpSecret.secretArn],
    }));

    // CloudWatch Logs access
    agentRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/*`,
      ],
    }));

    // ECR access for container-based deployment
    agentRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
      ],
      resources: ['*'],
    }));

    agentRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchCheckLayerAvailability',
      ],
      resources: [
        `arn:aws:ecr:${this.region}:${this.account}:repository/x402-payer-agent`,
      ],
    }));

    // IAM Role for AgentCore Gateway (for API access)
    this.gatewayRole = new iam.Role(this, 'GatewayRole', {
      roleName: 'x402-payer-agent-gateway-role',
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'IAM role for x402 payer agent Gateway',
    });

    // Gateway permissions to invoke the Runtime
    this.gatewayRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeAgent',
        'bedrock:InvokeAgentWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:agent/*`,
        `arn:aws:bedrock:${this.region}:${this.account}:agent-alias/*`,
      ],
    }));

    // Gateway CloudWatch Logs permissions
    this.gatewayRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/gateway/*`,
      ],
    }));

    // ==========================================
    // Gateway Target Role (for MCP Tool Server)
    // ==========================================
    // This role allows the Gateway to invoke external targets (CloudFront/API Gateway)
    // and access the OpenAPI specification for tool discovery.
    //
    // Trust Relationship:
    // - bedrock-agentcore.amazonaws.com: AgentCore Gateway service
    // - bedrock.amazonaws.com: Bedrock service (for agent invocations)
    //
    // Permissions:
    // - S3: Read OpenAPI spec for tool schema discovery
    // - API Gateway: Invoke private API targets (if configured)
    // - CloudWatch Logs: Write target invocation logs
    // - Lambda: Invoke Lambda targets (if configured)
    // - STS: Assume cross-account roles (for multi-account setups)
    //
    this.gatewayTargetRole = new iam.Role(this, 'GatewayTargetRole', {
      roleName: 'x402-payer-agent-gateway-target-role',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
      ),
      description: 'IAM role for AgentCore Gateway to invoke external targets (MCP tool server)',
    });

    // ==========================================
    // S3 Permissions (OpenAPI Spec Access)
    // ==========================================
    // Gateway needs to read the OpenAPI spec to discover tool schemas
    // and generate MCP tool definitions for agent discovery.
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'OpenApiSpecAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:GetObjectVersion',
        's3:GetObjectAttributes',
      ],
      resources: [
        this.openApiSpecAsset.bucket.arnForObjects('*'),
        // Also allow access to any OpenAPI specs in a dedicated bucket
        `arn:aws:s3:::${this.account}-agentcore-openapi-specs/*`,
      ],
    }));

    // S3 bucket listing for spec discovery
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'OpenApiSpecBucketList',
      effect: iam.Effect.ALLOW,
      actions: [
        's3:ListBucket',
        's3:GetBucketLocation',
      ],
      resources: [
        this.openApiSpecAsset.bucket.bucketArn,
        `arn:aws:s3:::${this.account}-agentcore-openapi-specs`,
      ],
    }));

    // ==========================================
    // API Gateway Permissions (Private Targets)
    // ==========================================
    // For private API Gateway targets, the Gateway needs execute-api:Invoke
    // Note: CloudFront is public and doesn't require IAM permissions,
    // but we include API Gateway permissions for future private targets.
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ApiGatewayInvoke',
      effect: iam.Effect.ALLOW,
      actions: [
        'execute-api:Invoke',
        'execute-api:ManageConnections',
      ],
      resources: [
        // Allow invoking any API Gateway in this account
        `arn:aws:execute-api:${this.region}:${this.account}:*/*/*/*`,
        // Allow invoking API Gateways in us-east-1 (Lambda@Edge region)
        `arn:aws:execute-api:us-east-1:${this.account}:*/*/*/*`,
      ],
    }));

    // ==========================================
    // Lambda Permissions (Lambda Targets)
    // ==========================================
    // For Lambda function targets, the Gateway needs lambda:InvokeFunction
    // This enables direct Lambda invocation without going through API Gateway.
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'LambdaInvoke',
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction',
        'lambda:InvokeAsync',
      ],
      resources: [
        // Allow invoking Lambda functions with x402 prefix
        `arn:aws:lambda:${this.region}:${this.account}:function:x402-*`,
        // Allow invoking Lambda@Edge functions in us-east-1
        `arn:aws:lambda:us-east-1:${this.account}:function:x402-*`,
      ],
    }));

    // ==========================================
    // CloudWatch Logs Permissions
    // ==========================================
    // Gateway Target needs to write logs for debugging and monitoring
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogsWrite',
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams',
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/gateway-target/*`,
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/gateway-target/*:*`,
      ],
    }));

    // ==========================================
    // CloudWatch Metrics Permissions
    // ==========================================
    // Gateway Target needs to publish custom metrics for monitoring
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchMetricsPublish',
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
      ],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'cloudwatch:namespace': [
            'X402PayerAgent/ContentTools',
            'X402PayerAgent/Gateway',
            'AWS/Bedrock',
          ],
        },
      },
    }));

    // ==========================================
    // STS Permissions (Cross-Account Access)
    // ==========================================
    // For multi-account setups where targets are in different accounts,
    // the Gateway needs to assume roles in those accounts.
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CrossAccountAssumeRole',
      effect: iam.Effect.ALLOW,
      actions: [
        'sts:AssumeRole',
      ],
      resources: [
        // Scoped to this account — add additional account IDs here for multi-account setups
        `arn:aws:iam::${this.account}:role/x402-gateway-target-*`,
      ],
      conditions: {
        StringEquals: {
          'sts:ExternalId': 'x402-gateway-target',
        },
      },
    }));

    // ==========================================
    // Secrets Manager Permissions (Target Credentials)
    // ==========================================
    // For targets that require authentication, the Gateway may need
    // to retrieve credentials from Secrets Manager.
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SecretsManagerRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:x402-gateway-target/*`,
      ],
    }));

    // ==========================================
    // KMS Permissions (Encrypted Secrets)
    // ==========================================
    // For secrets encrypted with customer-managed KMS keys
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'KmsDecrypt',
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:GenerateDataKey',
      ],
      resources: [
        `arn:aws:kms:${this.region}:${this.account}:key/*`,
      ],
      conditions: {
        StringEquals: {
          'kms:ViaService': `secretsmanager.${this.region}.amazonaws.com`,
        },
      },
    }));

    // ==========================================
    // X-Ray Tracing Permissions
    // ==========================================
    // For distributed tracing of target invocations
    this.gatewayTargetRole.addToPolicy(new iam.PolicyStatement({
      sid: 'XRayTracing',
      effect: iam.Effect.ALLOW,
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
      ],
      resources: ['*'],
    }));

    // CloudWatch Log Group for Gateway Target
    const gatewayTargetLogGroup = new logs.LogGroup(this, 'GatewayTargetLogGroup', {
      logGroupName: '/aws/bedrock-agentcore/gateway-target/x402-content-tools',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudWatch Log Group for Gateway
    this.gatewayLogGroup = new logs.LogGroup(this, 'GatewayLogGroup', {
      logGroupName: '/aws/bedrock-agentcore/gateway/x402-payer-agent',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ==========================================
    // Rate Limiting Infrastructure
    // ==========================================

    // SNS Topic for rate limit alarms
    this.rateLimitAlarmTopic = new sns.Topic(this, 'RateLimitAlarmTopic', {
      topicName: 'x402-payer-agent-rate-limit-alarms',
      displayName: 'x402 Payer Agent Rate Limit Alarms',
    });

    // CloudWatch Metric Filter for throttled requests
    const throttledRequestsMetricFilter = new logs.MetricFilter(this, 'ThrottledRequestsMetricFilter', {
      logGroup: this.gatewayLogGroup,
      metricNamespace: 'X402PayerAgent/Gateway/RateLimiting',
      metricName: 'ThrottledRequests',
      filterPattern: logs.FilterPattern.literal('ThrottlingException'),
      metricValue: '1',
      defaultValue: 0,
    });

    // CloudWatch Metric Filter for total requests
    const totalRequestsMetricFilter = new logs.MetricFilter(this, 'TotalRequestsMetricFilter', {
      logGroup: this.gatewayLogGroup,
      metricNamespace: 'X402PayerAgent/Gateway/RateLimiting',
      metricName: 'TotalRequests',
      filterPattern: logs.FilterPattern.literal('InvokeAgent'),
      metricValue: '1',
      defaultValue: 0,
    });

    // Throttled Requests Alarm
    const throttledRequestsAlarm = new cloudwatch.Alarm(this, 'ThrottledRequestsAlarm', {
      alarmName: 'x402-payer-agent-throttled-requests',
      alarmDescription: 'Alarm when requests are being throttled due to rate limiting',
      metric: new cloudwatch.Metric({
        namespace: 'X402PayerAgent/Gateway/RateLimiting',
        metricName: 'ThrottledRequests',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add alarm action to notify via SNS
    if (this.rateLimitConfig.enableAlarms) {
      throttledRequestsAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.rateLimitAlarmTopic)
      );
    }

    // High Request Rate Alarm (approaching rate limit)
    const highRequestRateAlarm = new cloudwatch.Alarm(this, 'HighRequestRateAlarm', {
      alarmName: 'x402-payer-agent-high-request-rate',
      alarmDescription: `Alarm when request rate exceeds ${this.rateLimitConfig.warningThresholdPercent}% of rate limit`,
      metric: new cloudwatch.Metric({
        namespace: 'X402PayerAgent/Gateway/RateLimiting',
        metricName: 'TotalRequests',
        statistic: 'Sum',
        period: cdk.Duration.seconds(60),
      }),
      // Threshold is 80% of requests per minute (requestsPerSecond * 60 * warningThresholdPercent/100)
      threshold: Math.floor(this.rateLimitConfig.requestsPerSecond * 60 * (this.rateLimitConfig.warningThresholdPercent / 100)),
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    if (this.rateLimitConfig.enableAlarms) {
      highRequestRateAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.rateLimitAlarmTopic)
      );
    }

    // IAM Policy for clients to invoke the Gateway
    const gatewayInvokePolicy = new iam.ManagedPolicy(this, 'GatewayInvokePolicy', {
      managedPolicyName: 'x402-payer-agent-gateway-invoke',
      description: 'Policy allowing invocation of the x402 payer agent Gateway',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:InvokeAgent',
            'bedrock:InvokeAgentWithResponseStream',
          ],
          resources: [
            `arn:aws:bedrock:${this.region}:${this.account}:agent/*`,
            `arn:aws:bedrock:${this.region}:${this.account}:agent-alias/*`,
          ],
        }),
      ],
    });

    // ==========================================
    // Gateway Target Managed Policy
    // ==========================================
    // This managed policy can be attached to other roles that need
    // to invoke Gateway targets (e.g., for testing or automation).
    const gatewayTargetPolicy = new iam.ManagedPolicy(this, 'GatewayTargetPolicy', {
      managedPolicyName: 'x402-payer-agent-gateway-target',
      description: 'Policy for invoking x402 Gateway targets (MCP tool server)',
      statements: [
        // S3 access for OpenAPI specs
        new iam.PolicyStatement({
          sid: 'OpenApiSpecAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:GetObjectVersion',
          ],
          resources: [
            this.openApiSpecAsset.bucket.arnForObjects('*'),
          ],
        }),
        // API Gateway invocation
        new iam.PolicyStatement({
          sid: 'ApiGatewayInvoke',
          effect: iam.Effect.ALLOW,
          actions: [
            'execute-api:Invoke',
          ],
          resources: [
            `arn:aws:execute-api:${this.region}:${this.account}:*/*/*/*`,
          ],
        }),
        // CloudWatch Logs
        new iam.PolicyStatement({
          sid: 'CloudWatchLogs',
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [
            `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/gateway-target/*:*`,
          ],
        }),
      ],
    });

    // CloudWatch Dashboard for Gateway monitoring
    const dashboard = new cloudwatch.Dashboard(this, 'GatewayDashboard', {
      dashboardName: 'x402-payer-agent-gateway',
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# x402 Payer Agent Gateway\nMonitoring dashboard for the AgentCore Gateway',
        width: 24,
        height: 1,
      }),
    );

    // Rate Limiting Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Rate Limiting Metrics',
        width: 24,
        height: 1,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Request Rate vs Limit',
        left: [
          new cloudwatch.Metric({
            namespace: 'X402PayerAgent/Gateway/RateLimiting',
            metricName: 'TotalRequests',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
            label: 'Requests per Minute',
          }),
        ],
        leftAnnotations: [
          {
            value: this.rateLimitConfig.requestsPerSecond * 60,
            label: 'Rate Limit (per minute)',
            color: '#ff0000',
          },
          {
            value: Math.floor(this.rateLimitConfig.requestsPerSecond * 60 * (this.rateLimitConfig.warningThresholdPercent / 100)),
            label: `Warning Threshold (${this.rateLimitConfig.warningThresholdPercent}%)`,
            color: '#ff9900',
          },
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Throttled Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'X402PayerAgent/Gateway/RateLimiting',
            metricName: 'ThrottledRequests',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
            label: 'Throttled Requests',
            color: '#ff0000',
          }),
        ],
        width: 12,
        height: 6,
      }),
    );

    // Rate Limiting Configuration Display
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `### Rate Limit Configuration
| Setting | Value |
|---------|-------|
| Requests per Second | ${this.rateLimitConfig.requestsPerSecond} |
| Burst Capacity | ${this.rateLimitConfig.burstCapacity} |
| Limit By | ${this.rateLimitConfig.limitBy} |
| Warning Threshold | ${this.rateLimitConfig.warningThresholdPercent}% |`,
        width: 12,
        height: 4,
      }),
      new cloudwatch.AlarmStatusWidget({
        title: 'Rate Limiting Alarms',
        alarms: [throttledRequestsAlarm, highRequestRateAlarm],
        width: 12,
        height: 4,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Gateway Request Logs',
        logGroupNames: [this.gatewayLogGroup.logGroupName],
        queryLines: [
          'fields @timestamp, @message',
          'sort @timestamp desc',
          'limit 100',
        ],
        width: 24,
        height: 6,
      }),
    );

    // Outputs
    new cdk.CfnOutput(this, 'CdpSecretArn', {
      value: cdpSecret.secretArn,
      description: 'ARN of the CDP credentials secret',
      exportName: 'X402PayerAgentCdpSecretArn',
    });

    new cdk.CfnOutput(this, 'AgentRuntimeRoleArn', {
      value: agentRuntimeRole.roleArn,
      description: 'ARN of the AgentCore Runtime IAM role',
      exportName: 'X402PayerAgentRuntimeRoleArn',
    });

    new cdk.CfnOutput(this, 'GatewayRoleArn', {
      value: this.gatewayRole.roleArn,
      description: 'ARN of the AgentCore Gateway IAM role',
      exportName: 'X402PayerAgentGatewayRoleArn',
    });

    new cdk.CfnOutput(this, 'GatewayLogGroupName', {
      value: this.gatewayLogGroup.logGroupName,
      description: 'CloudWatch Log Group for Gateway logs',
      exportName: 'X402PayerAgentGatewayLogGroup',
    });

    new cdk.CfnOutput(this, 'GatewayInvokePolicyArn', {
      value: gatewayInvokePolicy.managedPolicyArn,
      description: 'ARN of the policy for invoking the Gateway',
      exportName: 'X402PayerAgentGatewayInvokePolicyArn',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=x402-payer-agent-gateway`,
      description: 'URL to the CloudWatch Dashboard',
      exportName: 'X402PayerAgentDashboardUrl',
    });

    // Rate Limiting Outputs
    new cdk.CfnOutput(this, 'RateLimitAlarmTopicArn', {
      value: this.rateLimitAlarmTopic.topicArn,
      description: 'SNS Topic ARN for rate limit alarms',
      exportName: 'X402PayerAgentRateLimitAlarmTopicArn',
    });

    new cdk.CfnOutput(this, 'RateLimitConfig', {
      value: JSON.stringify({
        requestsPerSecond: this.rateLimitConfig.requestsPerSecond,
        burstCapacity: this.rateLimitConfig.burstCapacity,
        limitBy: this.rateLimitConfig.limitBy,
        warningThresholdPercent: this.rateLimitConfig.warningThresholdPercent,
      }),
      description: 'Rate limiting configuration',
      exportName: 'X402PayerAgentRateLimitConfig',
    });

    // ==========================================
    // Gateway Target Outputs (MCP Tool Server)
    // ==========================================
    
    new cdk.CfnOutput(this, 'GatewayTargetRoleArn', {
      value: this.gatewayTargetRole.roleArn,
      description: 'ARN of the Gateway Target IAM role for MCP tool server',
      exportName: 'X402PayerAgentGatewayTargetRoleArn',
    });

    new cdk.CfnOutput(this, 'GatewayTargetPolicyArn', {
      value: gatewayTargetPolicy.managedPolicyArn,
      description: 'ARN of the Gateway Target managed policy',
      exportName: 'X402PayerAgentGatewayTargetPolicyArn',
    });

    new cdk.CfnOutput(this, 'OpenApiSpecS3Uri', {
      value: `s3://${this.openApiSpecAsset.s3BucketName}/${this.openApiSpecAsset.s3ObjectKey}`,
      description: 'S3 URI of the OpenAPI spec for Gateway target configuration',
      exportName: 'X402PayerAgentOpenApiSpecS3Uri',
    });

    new cdk.CfnOutput(this, 'OpenApiSpecS3Url', {
      value: this.openApiSpecAsset.s3ObjectUrl,
      description: 'S3 URL of the OpenAPI spec for Gateway target configuration',
      exportName: 'X402PayerAgentOpenApiSpecS3Url',
    });

    new cdk.CfnOutput(this, 'GatewayTargetLogGroupName', {
      value: gatewayTargetLogGroup.logGroupName,
      description: 'CloudWatch Log Group for Gateway Target logs',
      exportName: 'X402PayerAgentGatewayTargetLogGroup',
    });

    new cdk.CfnOutput(this, 'SellerCloudFrontUrl', {
      value: sellerCloudFrontUrl,
      description: 'CloudFront distribution URL for seller infrastructure (target URL)',
      exportName: 'X402PayerAgentSellerCloudFrontUrl',
    });

    new cdk.CfnOutput(this, 'McpToolEndpoint', {
      value: '/v1/mcp/tools',
      description: 'MCP tool discovery endpoint path (relative to Gateway URL)',
      exportName: 'X402PayerAgentMcpToolEndpoint',
    });

    new cdk.CfnOutput(this, 'McpInvokeEndpoint', {
      value: '/v1/mcp/invoke',
      description: 'MCP tool invocation endpoint path (relative to Gateway URL)',
      exportName: 'X402PayerAgentMcpInvokeEndpoint',
    });

    // ==========================================
    // Tool ARNs for MCP Tools
    // ==========================================
    // These ARN patterns are used by the agent to invoke specific tools
    // via the Gateway. The actual ARNs are constructed at runtime when
    // the Gateway and targets are created via AgentCore CLI/console.
    //
    // ARN Format: arn:aws:bedrock-agentcore:{region}:{account}:gateway-target/{gateway-id}/tool/{tool-name}
    //
    // Note: Gateway ID is assigned at creation time. These outputs provide
    // the ARN patterns that can be used with the actual Gateway ID.

    const toolNames = [
      'get_premium_article',
      'get_weather_data',
      'get_market_analysis',
      'get_research_report',
    ];

    // Output individual tool ARN patterns
    new cdk.CfnOutput(this, 'ToolArnPattern', {
      value: `arn:aws:bedrock-agentcore:${this.region}:${this.account}:gateway-target/\${GATEWAY_TARGET_ID}/tool/\${TOOL_NAME}`,
      description: 'ARN pattern for Gateway target tools. Replace ${GATEWAY_TARGET_ID} and ${TOOL_NAME} with actual values.',
      exportName: 'X402PayerAgentToolArnPattern',
    });

    new cdk.CfnOutput(this, 'ToolArns', {
      value: JSON.stringify({
        pattern: `arn:aws:bedrock-agentcore:${this.region}:${this.account}:gateway-target/\${GATEWAY_TARGET_ID}/tool/{tool_name}`,
        tools: toolNames.map(name => ({
          name,
          arnTemplate: `arn:aws:bedrock-agentcore:${this.region}:${this.account}:gateway-target/\${GATEWAY_TARGET_ID}/tool/${name}`,
        })),
        note: 'Replace ${GATEWAY_TARGET_ID} with the actual Gateway target ID after creation',
      }, null, 2),
      description: 'Tool ARN templates for all MCP tools',
      exportName: 'X402PayerAgentToolArns',
    });

    // Output MCP endpoint configuration with full URL pattern
    new cdk.CfnOutput(this, 'McpEndpointConfig', {
      value: JSON.stringify({
        baseUrlPattern: 'https://${GATEWAY_ID}.bedrock-agentcore.${REGION}.amazonaws.com',
        endpoints: {
          discovery: {
            path: '/v1/mcp/tools',
            method: 'GET',
            description: 'List all available MCP tools',
          },
          invoke: {
            path: '/v1/mcp/invoke',
            method: 'POST',
            description: 'Invoke an MCP tool by name',
          },
          toolSchema: {
            path: '/v1/mcp/tools/{tool_name}/schema',
            method: 'GET',
            description: 'Get schema for a specific tool',
          },
        },
        authentication: 'IAM_SIGV4',
        region: this.region,
        note: 'Replace ${GATEWAY_ID} with the actual Gateway ID after creation',
      }, null, 2),
      description: 'MCP endpoint configuration for tool discovery and invocation',
      exportName: 'X402PayerAgentMcpEndpointConfig',
    });

    // Output Gateway target ARN pattern
    new cdk.CfnOutput(this, 'GatewayTargetArnPattern', {
      value: `arn:aws:bedrock-agentcore:${this.region}:${this.account}:gateway-target/\${GATEWAY_TARGET_ID}`,
      description: 'ARN pattern for the Gateway target. Replace ${GATEWAY_TARGET_ID} with actual ID after creation.',
      exportName: 'X402PayerAgentGatewayTargetArnPattern',
    });

    new cdk.CfnOutput(this, 'GatewayTargetConfig', {
      value: JSON.stringify({
        name: 'x402-content-tools',
        description: 'Premium content endpoints protected by x402 payment protocol',
        type: 'OPENAPI',
        targetUrl: sellerCloudFrontUrl,
        openApiSpecS3Uri: `s3://${this.openApiSpecAsset.s3BucketName}/${this.openApiSpecAsset.s3ObjectKey}`,
        tools: [
          { name: 'get_premium_article', price: '0.001 USDC' },
          { name: 'get_weather_data', price: '0.0005 USDC' },
          { name: 'get_market_analysis', price: '0.002 USDC' },
          { name: 'get_research_report', price: '0.005 USDC' },
        ],
      }, null, 2),
      description: 'Gateway target configuration for MCP tool server',
      exportName: 'X402PayerAgentGatewayTargetConfig',
    });

    // Instructions for manual AgentCore setup
    new cdk.CfnOutput(this, 'NextSteps', {
      value: `
After deploying this stack:

1. Update the CDP secret with your actual credentials:
   aws secretsmanager put-secret-value --secret-id ${cdpSecret.secretName} --secret-string '{"CDP_API_KEY_NAME":"your-key","CDP_API_KEY_PRIVATE_KEY":"your-private-key"}'

2. Deploy the seller infrastructure first (if not already deployed):
   cd seller-infrastructure && npm install && cdk deploy
   # Note the CloudFront URL from the output

3. Set the seller CloudFront URL environment variable:
   export X402_SELLER_CLOUDFRONT_URL=https://dXXXXXXXXXXXXX.cloudfront.net

4. Create AgentCore Runtime via CLI or console:
   - Use the agent code from payer-agent/
   - Assign the runtime role: ${agentRuntimeRole.roleArn}
   - See payer-agent/agentcore_config.yaml for configuration

5. Create AgentCore Gateway with MCP tool server:
   - Point to the Runtime endpoint
   - Assign the gateway role: ${this.gatewayRole.roleArn}
   - Configure IAM SigV4 authentication
   - Configure rate limiting:
     * Requests per second: ${this.rateLimitConfig.requestsPerSecond}
     * Burst capacity: ${this.rateLimitConfig.burstCapacity}
     * Limit by: ${this.rateLimitConfig.limitBy}
   - See payer-agent/gateway_config.yaml for full configuration

6. Configure Gateway Target for MCP tools:
   - Target name: x402-content-tools
   - Target type: OPENAPI
   - OpenAPI spec S3 URI: s3://${this.openApiSpecAsset.s3BucketName}/${this.openApiSpecAsset.s3ObjectKey}
   - Target URL: ${sellerCloudFrontUrl}
   - Assign target role: ${this.gatewayTargetRole.roleArn}
   - Configure x402 header passthrough (see gateway_config.yaml)
   - Note the Gateway Target ID for tool ARN construction

7. Subscribe to rate limit alarms (optional):
   aws sns subscribe --topic-arn ${this.rateLimitAlarmTopic.topicArn} --protocol email --notification-endpoint your-email@example.com

8. Grant Gateway access to clients:
   - Attach the invoke policy to IAM users/roles that need access
   - Policy ARN: ${gatewayInvokePolicy.managedPolicyArn}

9. Test MCP tool discovery:
   curl -X GET "https://<gateway-url>/v1/mcp/tools" -H "Authorization: AWS4-HMAC-SHA256 ..."

10. Monitor the Gateway:
    - View logs in CloudWatch: ${this.gatewayLogGroup.logGroupName}
    - View target logs: ${gatewayTargetLogGroup.logGroupName}
    - View dashboard: https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=x402-payer-agent-gateway
    - Rate limit alarms will notify via SNS topic

MCP Tool Endpoints:
- Discovery: GET /v1/mcp/tools
- Invocation: POST /v1/mcp/invoke
- Tool Schema: GET /v1/mcp/tools/{tool_name}/schema

Tool ARN Pattern:
  arn:aws:bedrock-agentcore:${this.region}:${this.account}:gateway-target/{GATEWAY_TARGET_ID}/tool/{TOOL_NAME}

Available MCP Tools (x402 payment required):
- get_premium_article (0.001 USDC)
- get_weather_data (0.0005 USDC)
- get_market_analysis (0.002 USDC)
- get_research_report (0.005 USDC)

See: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/
      `,
      description: 'Next steps for AgentCore setup',
    });

    // ==========================================
    // CDK Nag Suppressions
    // ==========================================
    NagSuppressions.addResourceSuppressions(cdpSecret, [
      { id: 'AwsSolutions-SMG4', reason: 'CDP API keys are managed externally by Coinbase — automatic rotation not applicable' },
    ]);

    NagSuppressions.addResourceSuppressions(agentRuntimeRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Wildcards required: cross-region inference profiles (bedrock:*), CloudWatch log groups (/aws/bedrock-agentcore/*), and ecr:GetAuthorizationToken requires resource *' },
    ], true);

    NagSuppressions.addResourceSuppressions(this.gatewayRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Gateway must invoke any agent/alias in the account — IDs are assigned at runtime by AgentCore' },
    ], true);

    NagSuppressions.addResourceSuppressions(this.gatewayTargetRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Gateway target needs broad access: S3 for OpenAPI specs, execute-api for private targets, CloudWatch logs, Lambda functions, KMS for encrypted secrets, and X-Ray tracing — all scoped to account/prefix where possible' },
    ], true);

    NagSuppressions.addResourceSuppressions(this.rateLimitAlarmTopic, [
      { id: 'AwsSolutions-SNS3', reason: 'Demo project — SNS SSL enforcement not required for internal alarm notifications' },
    ]);

    NagSuppressions.addResourceSuppressions(gatewayInvokePolicy, [
      { id: 'AwsSolutions-IAM5', reason: 'Client invoke policy must allow any agent/alias — IDs assigned at runtime by AgentCore' },
    ], true);

    NagSuppressions.addResourceSuppressions(gatewayTargetPolicy, [
      { id: 'AwsSolutions-IAM5', reason: 'Target policy needs S3 wildcard for OpenAPI specs, execute-api for API Gateway targets, and CloudWatch log streams' },
    ], true);
  }
}
