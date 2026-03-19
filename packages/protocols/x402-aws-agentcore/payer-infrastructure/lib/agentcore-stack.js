"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCoreStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const s3_assets = __importStar(require("aws-cdk-lib/aws-s3-assets"));
const path = __importStar(require("path"));
const cdk_nag_1 = require("cdk-nag");
class AgentCoreStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Get seller CloudFront URL from props or environment variable
        const sellerCloudFrontUrl = props?.sellerCloudFrontUrl
            || process.env.X402_SELLER_CLOUDFRONT_URL
            || 'https://REPLACE_WITH_CLOUDFRONT_URL.cloudfront.net';
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
            assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'), new iam.ServicePrincipal('bedrock.amazonaws.com')),
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
            throttledRequestsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.rateLimitAlarmTopic));
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
            highRequestRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.rateLimitAlarmTopic));
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
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '# x402 Payer Agent Gateway\nMonitoring dashboard for the AgentCore Gateway',
            width: 24,
            height: 1,
        }));
        // Rate Limiting Section
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Rate Limiting Metrics',
            width: 24,
            height: 1,
        }));
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }), new cloudwatch.GraphWidget({
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
        }));
        // Rate Limiting Configuration Display
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: `### Rate Limit Configuration
| Setting | Value |
|---------|-------|
| Requests per Second | ${this.rateLimitConfig.requestsPerSecond} |
| Burst Capacity | ${this.rateLimitConfig.burstCapacity} |
| Limit By | ${this.rateLimitConfig.limitBy} |
| Warning Threshold | ${this.rateLimitConfig.warningThresholdPercent}% |`,
            width: 12,
            height: 4,
        }), new cloudwatch.AlarmStatusWidget({
            title: 'Rate Limiting Alarms',
            alarms: [throttledRequestsAlarm, highRequestRateAlarm],
            width: 12,
            height: 4,
        }));
        dashboard.addWidgets(new cloudwatch.LogQueryWidget({
            title: 'Gateway Request Logs',
            logGroupNames: [this.gatewayLogGroup.logGroupName],
            queryLines: [
                'fields @timestamp, @message',
                'sort @timestamp desc',
                'limit 100',
            ],
            width: 24,
            height: 6,
        }));
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
        cdk_nag_1.NagSuppressions.addResourceSuppressions(cdpSecret, [
            { id: 'AwsSolutions-SMG4', reason: 'CDP API keys are managed externally by Coinbase — automatic rotation not applicable' },
        ]);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(agentRuntimeRole, [
            { id: 'AwsSolutions-IAM5', reason: 'Wildcards required: cross-region inference profiles (bedrock:*), CloudWatch log groups (/aws/bedrock-agentcore/*), and ecr:GetAuthorizationToken requires resource *' },
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(this.gatewayRole, [
            { id: 'AwsSolutions-IAM5', reason: 'Gateway must invoke any agent/alias in the account — IDs are assigned at runtime by AgentCore' },
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(this.gatewayTargetRole, [
            { id: 'AwsSolutions-IAM5', reason: 'Gateway target needs broad access: S3 for OpenAPI specs, execute-api for private targets, CloudWatch logs, Lambda functions, KMS for encrypted secrets, and X-Ray tracing — all scoped to account/prefix where possible' },
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(this.rateLimitAlarmTopic, [
            { id: 'AwsSolutions-SNS3', reason: 'Demo project — SNS SSL enforcement not required for internal alarm notifications' },
        ]);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(gatewayInvokePolicy, [
            { id: 'AwsSolutions-IAM5', reason: 'Client invoke policy must allow any agent/alias — IDs assigned at runtime by AgentCore' },
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(gatewayTargetPolicy, [
            { id: 'AwsSolutions-IAM5', reason: 'Target policy needs S3 wildcard for OpenAPI specs, execute-api for API Gateway targets, and CloudWatch log streams' },
        ], true);
    }
}
exports.AgentCoreStack = AgentCoreStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRjb3JlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWdlbnRjb3JlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLDJEQUE2QztBQUM3Qyx1RUFBeUQ7QUFDekQseURBQTJDO0FBQzNDLHVGQUF5RTtBQUN6RSxxRUFBdUQ7QUFDdkQsMkNBQTZCO0FBRTdCLHFDQUEwQztBQTJEMUMsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFRM0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwrREFBK0Q7UUFDL0QsTUFBTSxtQkFBbUIsR0FBRyxLQUFLLEVBQUUsbUJBQW1CO2VBQ2pELE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCO2VBQ3RDLG9EQUFvRCxDQUFDO1FBRTFELG9EQUFvRDtRQUNwRCxJQUFJLENBQUMsZUFBZSxHQUFHO1lBQ3JCLGlCQUFpQixFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsaUJBQWlCLElBQUksRUFBRTtZQUNsRSxhQUFhLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxhQUFhLElBQUksRUFBRTtZQUMxRCxPQUFPLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxPQUFPLElBQUksZUFBZTtZQUMzRCxZQUFZLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxZQUFZLElBQUksSUFBSTtZQUMxRCx1QkFBdUIsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLHVCQUF1QixJQUFJLEVBQUU7U0FDL0UsQ0FBQztRQUVGLDZDQUE2QztRQUM3Qyx3Q0FBd0M7UUFDeEMsNkNBQTZDO1FBQzdDLDZEQUE2RDtRQUM3RCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcs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Q0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUU7WUFDaEUsRUFBRSxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxFQUFFLGtGQUFrRixFQUFFO1NBQ3hILENBQUMsQ0FBQztRQUVILHlCQUFlLENBQUMsdUJBQXVCLENBQUMsbUJBQW1CLEVBQUU7WUFDM0QsRUFBRSxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxFQUFFLHdGQUF3RixFQUFFO1NBQzlILEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFVCx5QkFBZSxDQUFDLHVCQUF1QixDQUFDLG1CQUFtQixFQUFFO1lBQzNELEVBQUUsRUFBRSxFQUFFLG1CQUFtQixFQUFFLE1BQU0sRUFBRSxvSEFBb0gsRUFBRTtTQUMxSixFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ1gsQ0FBQztDQUNGO0FBNzVCRCx3Q0E2NUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaF9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgczNfYXNzZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1hc3NldHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSAnY2RrLW5hZyc7XG5cbi8qKlxuICogUmF0ZSBsaW1pdGluZyBjb25maWd1cmF0aW9uIGZvciB0aGUgQWdlbnRDb3JlIEdhdGV3YXkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmF0ZUxpbWl0Q29uZmlnIHtcbiAgLyoqIFJlcXVlc3RzIHBlciBzZWNvbmQgcGVyIGNsaWVudCAoZGVmYXVsdDogMTApICovXG4gIHJlcXVlc3RzUGVyU2Vjb25kOiBudW1iZXI7XG4gIC8qKiBCdXJzdCBjYXBhY2l0eSBmb3IgaGFuZGxpbmcgdHJhZmZpYyBzcGlrZXMgKGRlZmF1bHQ6IDIwKSAqL1xuICBidXJzdENhcGFjaXR5OiBudW1iZXI7XG4gIC8qKiBSYXRlIGxpbWl0IGJ5IElBTSBwcmluY2lwYWwgb3IgSVAgYWRkcmVzcyAqL1xuICBsaW1pdEJ5OiAnSUFNX1BSSU5DSVBBTCcgfCAnSVBfQUREUkVTUyc7XG4gIC8qKiBFbmFibGUgcmF0ZSBsaW1pdCBhbGFybXMgKi9cbiAgZW5hYmxlQWxhcm1zOiBib29sZWFuO1xuICAvKiogVGhyZXNob2xkIHBlcmNlbnRhZ2UgZm9yIHJhdGUgbGltaXQgd2FybmluZyBhbGFybSAoZGVmYXVsdDogODApICovXG4gIHdhcm5pbmdUaHJlc2hvbGRQZXJjZW50OiBudW1iZXI7XG59XG5cbi8qKlxuICogR2F0ZXdheSB0YXJnZXQgY29uZmlndXJhdGlvbiBmb3IgTUNQIHRvb2wgc2VydmVyLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdhdGV3YXlUYXJnZXRDb25maWcge1xuICAvKiogTmFtZSBvZiB0aGUgdGFyZ2V0ICovXG4gIG5hbWU6IHN0cmluZztcbiAgLyoqIERlc2NyaXB0aW9uIG9mIHRoZSB0YXJnZXQgKi9cbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgLyoqIFRhcmdldCBVUkwgKENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIFVSTCkgKi9cbiAgdGFyZ2V0VXJsOiBzdHJpbmc7XG4gIC8qKiBQYXRoIHRvIE9wZW5BUEkgc3BlYyBmaWxlIChyZWxhdGl2ZSB0byBwYXllci1hZ2VudCBkaXJlY3RvcnkpICovXG4gIG9wZW5BcGlTcGVjUGF0aD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBDREsgU3RhY2sgZm9yIEJlZHJvY2sgQWdlbnRDb3JlIGluZnJhc3RydWN0dXJlLlxuICogXG4gKiBOb3RlOiBBZ2VudENvcmUgQ0RLIEwyIGNvbnN0cnVjdHMgYXJlIHVuZGVyIGRldmVsb3BtZW50IChSRkMgIzc4NSkuXG4gKiBUaGlzIHN0YWNrIHVzZXMgTDEgY29uc3RydWN0cyBhbmQgSUFNIHJvbGVzIGZvciBBZ2VudENvcmUgaW50ZWdyYXRpb24uXG4gKiBcbiAqIEZvciBwcm9kdWN0aW9uIGRlcGxveW1lbnQsIHVzZSB0aGUgQWdlbnRDb3JlIENMSSBvciBjb25zb2xlIHRvIGNyZWF0ZTpcbiAqIC0gQWdlbnRDb3JlIFJ1bnRpbWVcbiAqIC0gQWdlbnRDb3JlIEdhdGV3YXlcbiAqIC0gQWdlbnRDb3JlIE1lbW9yeSAob3B0aW9uYWwpXG4gKiBcbiAqIEdhdGV3YXkgQ29uZmlndXJhdGlvbjpcbiAqIC0gSUFNIFNpZ1Y0IGF1dGhlbnRpY2F0aW9uIGZvciBzZWN1cmUgQVBJIGFjY2Vzc1xuICogLSBSYXRlIGxpbWl0aW5nIHRvIHByZXZlbnQgYWJ1c2VcbiAqIC0gQ09SUyBzdXBwb3J0IGZvciB3ZWIgY2xpZW50c1xuICogLSBDbG91ZFdhdGNoIGxvZ2dpbmcgYW5kIG1ldHJpY3NcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEFnZW50Q29yZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIC8qKiBSYXRlIGxpbWl0aW5nIGNvbmZpZ3VyYXRpb24gKi9cbiAgcmF0ZUxpbWl0Q29uZmlnPzogUGFydGlhbDxSYXRlTGltaXRDb25maWc+O1xuICAvKiogR2F0ZXdheSB0YXJnZXQgY29uZmlndXJhdGlvbiBmb3IgTUNQIHRvb2wgc2VydmVyICovXG4gIGdhdGV3YXlUYXJnZXRDb25maWc/OiBHYXRld2F5VGFyZ2V0Q29uZmlnO1xuICAvKiogQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gVVJMIGZvciBzZWxsZXIgaW5mcmFzdHJ1Y3R1cmUgKi9cbiAgc2VsbGVyQ2xvdWRGcm9udFVybD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEFnZW50Q29yZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGdhdGV3YXlSb2xlOiBpYW0uUm9sZTtcbiAgcHVibGljIHJlYWRvbmx5IGdhdGV3YXlMb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcbiAgcHVibGljIHJlYWRvbmx5IHJhdGVMaW1pdEFsYXJtVG9waWM6IHNucy5Ub3BpYztcbiAgcHVibGljIHJlYWRvbmx5IHJhdGVMaW1pdENvbmZpZzogUmF0ZUxpbWl0Q29uZmlnO1xuICBwdWJsaWMgcmVhZG9ubHkgb3BlbkFwaVNwZWNBc3NldDogczNfYXNzZXRzLkFzc2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZ2F0ZXdheVRhcmdldFJvbGU6IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogQWdlbnRDb3JlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gR2V0IHNlbGxlciBDbG91ZEZyb250IFVSTCBmcm9tIHByb3BzIG9yIGVudmlyb25tZW50IHZhcmlhYmxlXG4gICAgY29uc3Qgc2VsbGVyQ2xvdWRGcm9udFVybCA9IHByb3BzPy5zZWxsZXJDbG91ZEZyb250VXJsIFxuICAgICAgfHwgcHJvY2Vzcy5lbnYuWDQwMl9TRUxMRVJfQ0xPVURGUk9OVF9VUkwgXG4gICAgICB8fCAnaHR0cHM6Ly9SRVBMQUNFX1dJVEhfQ0xPVURGUk9OVF9VUkwuY2xvdWRmcm9udC5uZXQnO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSByYXRlIGxpbWl0IGNvbmZpZ3VyYXRpb24gd2l0aCBkZWZhdWx0c1xuICAgIHRoaXMucmF0ZUxpbWl0Q29uZmlnID0ge1xuICAgICAgcmVxdWVzdHNQZXJTZWNvbmQ6IHByb3BzPy5yYXRlTGltaXRDb25maWc/LnJlcXVlc3RzUGVyU2Vjb25kID8/IDEwLFxuICAgICAgYnVyc3RDYXBhY2l0eTogcHJvcHM/LnJhdGVMaW1pdENvbmZpZz8uYnVyc3RDYXBhY2l0eSA/PyAyMCxcbiAgICAgIGxpbWl0Qnk6IHByb3BzPy5yYXRlTGltaXRDb25maWc/LmxpbWl0QnkgPz8gJ0lBTV9QUklOQ0lQQUwnLFxuICAgICAgZW5hYmxlQWxhcm1zOiBwcm9wcz8ucmF0ZUxpbWl0Q29uZmlnPy5lbmFibGVBbGFybXMgPz8gdHJ1ZSxcbiAgICAgIHdhcm5pbmdUaHJlc2hvbGRQZXJjZW50OiBwcm9wcz8ucmF0ZUxpbWl0Q29uZmlnPy53YXJuaW5nVGhyZXNob2xkUGVyY2VudCA/PyA4MCxcbiAgICB9O1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3BlbkFQSSBTcGVjIEFzc2V0IGZvciBHYXRld2F5IFRhcmdldFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFVwbG9hZCB0aGUgT3BlbkFQSSBzcGVjIHRvIFMzIGZvciB1c2UgYnkgQWdlbnRDb3JlIEdhdGV3YXlcbiAgICB0aGlzLm9wZW5BcGlTcGVjQXNzZXQgPSBuZXcgczNfYXNzZXRzLkFzc2V0KHRoaXMsICdPcGVuQXBpU3BlY0Fzc2V0Jywge1xuICAgICAgcGF0aDogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3BheWVyLWFnZW50L29wZW5hcGkvY29udGVudC10b29scy55YW1sJyksXG4gICAgfSk7XG5cbiAgICAvLyBTZWNyZXQgZm9yIENEUCBBUEkgY3JlZGVudGlhbHNcbiAgICBjb25zdCBjZHBTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdDZHBBcGlTZWNyZXQnLCB7XG4gICAgICBzZWNyZXROYW1lOiAneDQwMi1wYXllci1hZ2VudC9jZHAtY3JlZGVudGlhbHMnLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2luYmFzZSBEZXZlbG9wZXIgUGxhdGZvcm0gQVBJIGNyZWRlbnRpYWxzIGZvciB4NDAyIHBheWVyIGFnZW50JyxcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgQ0RQX0FQSV9LRVlfTkFNRTogJ1JFUExBQ0VfV0lUSF9ZT1VSX0tFWV9OQU1FJyxcbiAgICAgICAgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAnQ0RQX0FQSV9LRVlfUFJJVkFURV9LRVknLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIElBTSBSb2xlIGZvciBBZ2VudENvcmUgUnVudGltZVxuICAgIGNvbnN0IGFnZW50UnVudGltZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FnZW50UnVudGltZVJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogJ3g0MDItcGF5ZXItYWdlbnQtcnVudGltZS1yb2xlJyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLWFnZW50Y29yZS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIGZvciB4NDAyIHBheWVyIGFnZW50IHJ1bm5pbmcgb24gQWdlbnRDb3JlIFJ1bnRpbWUnLFxuICAgIH0pO1xuXG4gICAgLy8gQmVkcm9jayBtb2RlbCBhY2Nlc3NcbiAgICAvLyBOb3RlOiBDcm9zcy1yZWdpb24gaW5mZXJlbmNlIHByb2ZpbGVzICh1cy5hbnRocm9waWMuY2xhdWRlLSopIHJvdXRlIHRvIGRpZmZlcmVudCByZWdpb25zLFxuICAgIC8vIHNvIHdlIG5lZWQgdG8gYWxsb3cgYWxsIHJlZ2lvbnMgZm9yIGZvdW5kYXRpb24gbW9kZWxzLlxuICAgIGFnZW50UnVudGltZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgLy8gRm91bmRhdGlvbiBtb2RlbHMgaW4gYWxsIHJlZ2lvbnMgKGZvciBjcm9zcy1yZWdpb24gaW5mZXJlbmNlKVxuICAgICAgICAnYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0qJyxcbiAgICAgICAgLy8gQ3Jvc3MtcmVnaW9uIGluZmVyZW5jZSBwcm9maWxlc1xuICAgICAgICAnYXJuOmF3czpiZWRyb2NrOio6KjppbmZlcmVuY2UtcHJvZmlsZS91cy5hbnRocm9waWMuY2xhdWRlLSonLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBTZWNyZXRzIE1hbmFnZXIgYWNjZXNzXG4gICAgYWdlbnRSdW50aW1lUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbY2RwU2VjcmV0LnNlY3JldEFybl0sXG4gICAgfSkpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dzIGFjY2Vzc1xuICAgIGFnZW50UnVudGltZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmxvZ3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmxvZy1ncm91cDovYXdzL2JlZHJvY2stYWdlbnRjb3JlLypgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBFQ1IgYWNjZXNzIGZvciBjb250YWluZXItYmFzZWQgZGVwbG95bWVudFxuICAgIGFnZW50UnVudGltZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZWNyOkdldEF1dGhvcml6YXRpb25Ub2tlbicsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICBhZ2VudFJ1bnRpbWVSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2VjcjpCYXRjaEdldEltYWdlJyxcbiAgICAgICAgJ2VjcjpHZXREb3dubG9hZFVybEZvckxheWVyJyxcbiAgICAgICAgJ2VjcjpCYXRjaENoZWNrTGF5ZXJBdmFpbGFiaWxpdHknLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czplY3I6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnJlcG9zaXRvcnkveDQwMi1wYXllci1hZ2VudGAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIElBTSBSb2xlIGZvciBBZ2VudENvcmUgR2F0ZXdheSAoZm9yIEFQSSBhY2Nlc3MpXG4gICAgdGhpcy5nYXRld2F5Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnR2F0ZXdheVJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogJ3g0MDItcGF5ZXItYWdlbnQtZ2F0ZXdheS1yb2xlJyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLWFnZW50Y29yZS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIGZvciB4NDAyIHBheWVyIGFnZW50IEdhdGV3YXknLFxuICAgIH0pO1xuXG4gICAgLy8gR2F0ZXdheSBwZXJtaXNzaW9ucyB0byBpbnZva2UgdGhlIFJ1bnRpbWVcbiAgICB0aGlzLmdhdGV3YXlSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VBZ2VudFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmFnZW50LypgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTphZ2VudC1hbGlhcy8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gR2F0ZXdheSBDbG91ZFdhdGNoIExvZ3MgcGVybWlzc2lvbnNcbiAgICB0aGlzLmdhdGV3YXlSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvYmVkcm9jay1hZ2VudGNvcmUvZ2F0ZXdheS8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gR2F0ZXdheSBUYXJnZXQgUm9sZSAoZm9yIE1DUCBUb29sIFNlcnZlcilcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBUaGlzIHJvbGUgYWxsb3dzIHRoZSBHYXRld2F5IHRvIGludm9rZSBleHRlcm5hbCB0YXJnZXRzIChDbG91ZEZyb250L0FQSSBHYXRld2F5KVxuICAgIC8vIGFuZCBhY2Nlc3MgdGhlIE9wZW5BUEkgc3BlY2lmaWNhdGlvbiBmb3IgdG9vbCBkaXNjb3ZlcnkuXG4gICAgLy9cbiAgICAvLyBUcnVzdCBSZWxhdGlvbnNoaXA6XG4gICAgLy8gLSBiZWRyb2NrLWFnZW50Y29yZS5hbWF6b25hd3MuY29tOiBBZ2VudENvcmUgR2F0ZXdheSBzZXJ2aWNlXG4gICAgLy8gLSBiZWRyb2NrLmFtYXpvbmF3cy5jb206IEJlZHJvY2sgc2VydmljZSAoZm9yIGFnZW50IGludm9jYXRpb25zKVxuICAgIC8vXG4gICAgLy8gUGVybWlzc2lvbnM6XG4gICAgLy8gLSBTMzogUmVhZCBPcGVuQVBJIHNwZWMgZm9yIHRvb2wgc2NoZW1hIGRpc2NvdmVyeVxuICAgIC8vIC0gQVBJIEdhdGV3YXk6IEludm9rZSBwcml2YXRlIEFQSSB0YXJnZXRzIChpZiBjb25maWd1cmVkKVxuICAgIC8vIC0gQ2xvdWRXYXRjaCBMb2dzOiBXcml0ZSB0YXJnZXQgaW52b2NhdGlvbiBsb2dzXG4gICAgLy8gLSBMYW1iZGE6IEludm9rZSBMYW1iZGEgdGFyZ2V0cyAoaWYgY29uZmlndXJlZClcbiAgICAvLyAtIFNUUzogQXNzdW1lIGNyb3NzLWFjY291bnQgcm9sZXMgKGZvciBtdWx0aS1hY2NvdW50IHNldHVwcylcbiAgICAvL1xuICAgIHRoaXMuZ2F0ZXdheVRhcmdldFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0dhdGV3YXlUYXJnZXRSb2xlJywge1xuICAgICAgcm9sZU5hbWU6ICd4NDAyLXBheWVyLWFnZW50LWdhdGV3YXktdGFyZ2V0LXJvbGUnLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLWFnZW50Y29yZS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgICApLFxuICAgICAgZGVzY3JpcHRpb246ICdJQU0gcm9sZSBmb3IgQWdlbnRDb3JlIEdhdGV3YXkgdG8gaW52b2tlIGV4dGVybmFsIHRhcmdldHMgKE1DUCB0b29sIHNlcnZlciknLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUzMgUGVybWlzc2lvbnMgKE9wZW5BUEkgU3BlYyBBY2Nlc3MpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gR2F0ZXdheSBuZWVkcyB0byByZWFkIHRoZSBPcGVuQVBJIHNwZWMgdG8gZGlzY292ZXIgdG9vbCBzY2hlbWFzXG4gICAgLy8gYW5kIGdlbmVyYXRlIE1DUCB0b29sIGRlZmluaXRpb25zIGZvciBhZ2VudCBkaXNjb3ZlcnkuXG4gICAgdGhpcy5nYXRld2F5VGFyZ2V0Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBzaWQ6ICdPcGVuQXBpU3BlY0FjY2VzcycsXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAnczM6R2V0T2JqZWN0VmVyc2lvbicsXG4gICAgICAgICdzMzpHZXRPYmplY3RBdHRyaWJ1dGVzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgdGhpcy5vcGVuQXBpU3BlY0Fzc2V0LmJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyksXG4gICAgICAgIC8vIEFsc28gYWxsb3cgYWNjZXNzIHRvIGFueSBPcGVuQVBJIHNwZWNzIGluIGEgZGVkaWNhdGVkIGJ1Y2tldFxuICAgICAgICBgYXJuOmF3czpzMzo6OiR7dGhpcy5hY2NvdW50fS1hZ2VudGNvcmUtb3BlbmFwaS1zcGVjcy8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gUzMgYnVja2V0IGxpc3RpbmcgZm9yIHNwZWMgZGlzY292ZXJ5XG4gICAgdGhpcy5nYXRld2F5VGFyZ2V0Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBzaWQ6ICdPcGVuQXBpU3BlY0J1Y2tldExpc3QnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICdzMzpHZXRCdWNrZXRMb2NhdGlvbicsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHRoaXMub3BlbkFwaVNwZWNBc3NldC5idWNrZXQuYnVja2V0QXJuLFxuICAgICAgICBgYXJuOmF3czpzMzo6OiR7dGhpcy5hY2NvdW50fS1hZ2VudGNvcmUtb3BlbmFwaS1zcGVjc2AsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEFQSSBHYXRld2F5IFBlcm1pc3Npb25zIChQcml2YXRlIFRhcmdldHMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRm9yIHByaXZhdGUgQVBJIEdhdGV3YXkgdGFyZ2V0cywgdGhlIEdhdGV3YXkgbmVlZHMgZXhlY3V0ZS1hcGk6SW52b2tlXG4gICAgLy8gTm90ZTogQ2xvdWRGcm9udCBpcyBwdWJsaWMgYW5kIGRvZXNuJ3QgcmVxdWlyZSBJQU0gcGVybWlzc2lvbnMsXG4gICAgLy8gYnV0IHdlIGluY2x1ZGUgQVBJIEdhdGV3YXkgcGVybWlzc2lvbnMgZm9yIGZ1dHVyZSBwcml2YXRlIHRhcmdldHMuXG4gICAgdGhpcy5nYXRld2F5VGFyZ2V0Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBzaWQ6ICdBcGlHYXRld2F5SW52b2tlJyxcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2V4ZWN1dGUtYXBpOkludm9rZScsXG4gICAgICAgICdleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9ucycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIC8vIEFsbG93IGludm9raW5nIGFueSBBUEkgR2F0ZXdheSBpbiB0aGlzIGFjY291bnRcbiAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OiovKi8qLypgLFxuICAgICAgICAvLyBBbGxvdyBpbnZva2luZyBBUEkgR2F0ZXdheXMgaW4gdXMtZWFzdC0xIChMYW1iZGFARWRnZSByZWdpb24pXG4gICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOnVzLWVhc3QtMToke3RoaXMuYWNjb3VudH06Ki8qLyovKmAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIExhbWJkYSBQZXJtaXNzaW9ucyAoTGFtYmRhIFRhcmdldHMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRm9yIExhbWJkYSBmdW5jdGlvbiB0YXJnZXRzLCB0aGUgR2F0ZXdheSBuZWVkcyBsYW1iZGE6SW52b2tlRnVuY3Rpb25cbiAgICAvLyBUaGlzIGVuYWJsZXMgZGlyZWN0IExhbWJkYSBpbnZvY2F0aW9uIHdpdGhvdXQgZ29pbmcgdGhyb3VnaCBBUEkgR2F0ZXdheS5cbiAgICB0aGlzLmdhdGV3YXlUYXJnZXRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHNpZDogJ0xhbWJkYUludm9rZScsXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nLFxuICAgICAgICAnbGFtYmRhOkludm9rZUFzeW5jJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgLy8gQWxsb3cgaW52b2tpbmcgTGFtYmRhIGZ1bmN0aW9ucyB3aXRoIHg0MDIgcHJlZml4XG4gICAgICAgIGBhcm46YXdzOmxhbWJkYToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZnVuY3Rpb246eDQwMi0qYCxcbiAgICAgICAgLy8gQWxsb3cgaW52b2tpbmcgTGFtYmRhQEVkZ2UgZnVuY3Rpb25zIGluIHVzLWVhc3QtMVxuICAgICAgICBgYXJuOmF3czpsYW1iZGE6dXMtZWFzdC0xOiR7dGhpcy5hY2NvdW50fTpmdW5jdGlvbjp4NDAyLSpgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3MgUGVybWlzc2lvbnNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBHYXRld2F5IFRhcmdldCBuZWVkcyB0byB3cml0ZSBsb2dzIGZvciBkZWJ1Z2dpbmcgYW5kIG1vbml0b3JpbmdcbiAgICB0aGlzLmdhdGV3YXlUYXJnZXRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHNpZDogJ0Nsb3VkV2F0Y2hMb2dzV3JpdGUnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cycsXG4gICAgICAgICdsb2dzOkRlc2NyaWJlTG9nU3RyZWFtcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmxvZ3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmxvZy1ncm91cDovYXdzL2JlZHJvY2stYWdlbnRjb3JlL2dhdGV3YXktdGFyZ2V0LypgLFxuICAgICAgICBgYXJuOmF3czpsb2dzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpsb2ctZ3JvdXA6L2F3cy9iZWRyb2NrLWFnZW50Y29yZS9nYXRld2F5LXRhcmdldC8qOipgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDbG91ZFdhdGNoIE1ldHJpY3MgUGVybWlzc2lvbnNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBHYXRld2F5IFRhcmdldCBuZWVkcyB0byBwdWJsaXNoIGN1c3RvbSBtZXRyaWNzIGZvciBtb25pdG9yaW5nXG4gICAgdGhpcy5nYXRld2F5VGFyZ2V0Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBzaWQ6ICdDbG91ZFdhdGNoTWV0cmljc1B1Ymxpc2gnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnY2xvdWR3YXRjaDpuYW1lc3BhY2UnOiBbXG4gICAgICAgICAgICAnWDQwMlBheWVyQWdlbnQvQ29udGVudFRvb2xzJyxcbiAgICAgICAgICAgICdYNDAyUGF5ZXJBZ2VudC9HYXRld2F5JyxcbiAgICAgICAgICAgICdBV1MvQmVkcm9jaycsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSkpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU1RTIFBlcm1pc3Npb25zIChDcm9zcy1BY2NvdW50IEFjY2VzcylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBGb3IgbXVsdGktYWNjb3VudCBzZXR1cHMgd2hlcmUgdGFyZ2V0cyBhcmUgaW4gZGlmZmVyZW50IGFjY291bnRzLFxuICAgIC8vIHRoZSBHYXRld2F5IG5lZWRzIHRvIGFzc3VtZSByb2xlcyBpbiB0aG9zZSBhY2NvdW50cy5cbiAgICB0aGlzLmdhdGV3YXlUYXJnZXRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHNpZDogJ0Nyb3NzQWNjb3VudEFzc3VtZVJvbGUnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnc3RzOkFzc3VtZVJvbGUnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICAvLyBTY29wZWQgdG8gdGhpcyBhY2NvdW50IOKAlCBhZGQgYWRkaXRpb25hbCBhY2NvdW50IElEcyBoZXJlIGZvciBtdWx0aS1hY2NvdW50IHNldHVwc1xuICAgICAgICBgYXJuOmF3czppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlL3g0MDItZ2F0ZXdheS10YXJnZXQtKmAsXG4gICAgICBdLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnc3RzOkV4dGVybmFsSWQnOiAneDQwMi1nYXRld2F5LXRhcmdldCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFNlY3JldHMgTWFuYWdlciBQZXJtaXNzaW9ucyAoVGFyZ2V0IENyZWRlbnRpYWxzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEZvciB0YXJnZXRzIHRoYXQgcmVxdWlyZSBhdXRoZW50aWNhdGlvbiwgdGhlIEdhdGV3YXkgbWF5IG5lZWRcbiAgICAvLyB0byByZXRyaWV2ZSBjcmVkZW50aWFscyBmcm9tIFNlY3JldHMgTWFuYWdlci5cbiAgICB0aGlzLmdhdGV3YXlUYXJnZXRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHNpZDogJ1NlY3JldHNNYW5hZ2VyUmVhZCcsXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsXG4gICAgICAgICdzZWNyZXRzbWFuYWdlcjpEZXNjcmliZVNlY3JldCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOnNlY3JldHNtYW5hZ2VyOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpzZWNyZXQ6eDQwMi1nYXRld2F5LXRhcmdldC8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gS01TIFBlcm1pc3Npb25zIChFbmNyeXB0ZWQgU2VjcmV0cylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBGb3Igc2VjcmV0cyBlbmNyeXB0ZWQgd2l0aCBjdXN0b21lci1tYW5hZ2VkIEtNUyBrZXlzXG4gICAgdGhpcy5nYXRld2F5VGFyZ2V0Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBzaWQ6ICdLbXNEZWNyeXB0JyxcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2ttczpEZWNyeXB0JyxcbiAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXknLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czprbXM6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmtleS8qYCxcbiAgICAgIF0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdrbXM6VmlhU2VydmljZSc6IGBzZWNyZXRzbWFuYWdlci4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tYCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSkpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gWC1SYXkgVHJhY2luZyBQZXJtaXNzaW9uc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEZvciBkaXN0cmlidXRlZCB0cmFjaW5nIG9mIHRhcmdldCBpbnZvY2F0aW9uc1xuICAgIHRoaXMuZ2F0ZXdheVRhcmdldFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgc2lkOiAnWFJheVRyYWNpbmcnLFxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAneHJheTpQdXRUcmFjZVNlZ21lbnRzJyxcbiAgICAgICAgJ3hyYXk6UHV0VGVsZW1ldHJ5UmVjb3JkcycsXG4gICAgICAgICd4cmF5OkdldFNhbXBsaW5nUnVsZXMnLFxuICAgICAgICAneHJheTpHZXRTYW1wbGluZ1RhcmdldHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIEdhdGV3YXkgVGFyZ2V0XG4gICAgY29uc3QgZ2F0ZXdheVRhcmdldExvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0dhdGV3YXlUYXJnZXRMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvYmVkcm9jay1hZ2VudGNvcmUvZ2F0ZXdheS10YXJnZXQveDQwMi1jb250ZW50LXRvb2xzJyxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZyBHcm91cCBmb3IgR2F0ZXdheVxuICAgIHRoaXMuZ2F0ZXdheUxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0dhdGV3YXlMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvYmVkcm9jay1hZ2VudGNvcmUvZ2F0ZXdheS94NDAyLXBheWVyLWFnZW50JyxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBSYXRlIExpbWl0aW5nIEluZnJhc3RydWN0dXJlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBTTlMgVG9waWMgZm9yIHJhdGUgbGltaXQgYWxhcm1zXG4gICAgdGhpcy5yYXRlTGltaXRBbGFybVRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnUmF0ZUxpbWl0QWxhcm1Ub3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogJ3g0MDItcGF5ZXItYWdlbnQtcmF0ZS1saW1pdC1hbGFybXMnLFxuICAgICAgZGlzcGxheU5hbWU6ICd4NDAyIFBheWVyIEFnZW50IFJhdGUgTGltaXQgQWxhcm1zJyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTWV0cmljIEZpbHRlciBmb3IgdGhyb3R0bGVkIHJlcXVlc3RzXG4gICAgY29uc3QgdGhyb3R0bGVkUmVxdWVzdHNNZXRyaWNGaWx0ZXIgPSBuZXcgbG9ncy5NZXRyaWNGaWx0ZXIodGhpcywgJ1Rocm90dGxlZFJlcXVlc3RzTWV0cmljRmlsdGVyJywge1xuICAgICAgbG9nR3JvdXA6IHRoaXMuZ2F0ZXdheUxvZ0dyb3VwLFxuICAgICAgbWV0cmljTmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQvR2F0ZXdheS9SYXRlTGltaXRpbmcnLFxuICAgICAgbWV0cmljTmFtZTogJ1Rocm90dGxlZFJlcXVlc3RzJyxcbiAgICAgIGZpbHRlclBhdHRlcm46IGxvZ3MuRmlsdGVyUGF0dGVybi5saXRlcmFsKCdUaHJvdHRsaW5nRXhjZXB0aW9uJyksXG4gICAgICBtZXRyaWNWYWx1ZTogJzEnLFxuICAgICAgZGVmYXVsdFZhbHVlOiAwLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBNZXRyaWMgRmlsdGVyIGZvciB0b3RhbCByZXF1ZXN0c1xuICAgIGNvbnN0IHRvdGFsUmVxdWVzdHNNZXRyaWNGaWx0ZXIgPSBuZXcgbG9ncy5NZXRyaWNGaWx0ZXIodGhpcywgJ1RvdGFsUmVxdWVzdHNNZXRyaWNGaWx0ZXInLCB7XG4gICAgICBsb2dHcm91cDogdGhpcy5nYXRld2F5TG9nR3JvdXAsXG4gICAgICBtZXRyaWNOYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudC9HYXRld2F5L1JhdGVMaW1pdGluZycsXG4gICAgICBtZXRyaWNOYW1lOiAnVG90YWxSZXF1ZXN0cycsXG4gICAgICBmaWx0ZXJQYXR0ZXJuOiBsb2dzLkZpbHRlclBhdHRlcm4ubGl0ZXJhbCgnSW52b2tlQWdlbnQnKSxcbiAgICAgIG1ldHJpY1ZhbHVlOiAnMScsXG4gICAgICBkZWZhdWx0VmFsdWU6IDAsXG4gICAgfSk7XG5cbiAgICAvLyBUaHJvdHRsZWQgUmVxdWVzdHMgQWxhcm1cbiAgICBjb25zdCB0aHJvdHRsZWRSZXF1ZXN0c0FsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1Rocm90dGxlZFJlcXVlc3RzQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICd4NDAyLXBheWVyLWFnZW50LXRocm90dGxlZC1yZXF1ZXN0cycsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxhcm0gd2hlbiByZXF1ZXN0cyBhcmUgYmVpbmcgdGhyb3R0bGVkIGR1ZSB0byByYXRlIGxpbWl0aW5nJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQvR2F0ZXdheS9SYXRlTGltaXRpbmcnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnVGhyb3R0bGVkUmVxdWVzdHMnLFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGFsYXJtIGFjdGlvbiB0byBub3RpZnkgdmlhIFNOU1xuICAgIGlmICh0aGlzLnJhdGVMaW1pdENvbmZpZy5lbmFibGVBbGFybXMpIHtcbiAgICAgIHRocm90dGxlZFJlcXVlc3RzQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMucmF0ZUxpbWl0QWxhcm1Ub3BpYylcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gSGlnaCBSZXF1ZXN0IFJhdGUgQWxhcm0gKGFwcHJvYWNoaW5nIHJhdGUgbGltaXQpXG4gICAgY29uc3QgaGlnaFJlcXVlc3RSYXRlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaFJlcXVlc3RSYXRlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICd4NDAyLXBheWVyLWFnZW50LWhpZ2gtcmVxdWVzdC1yYXRlJyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246IGBBbGFybSB3aGVuIHJlcXVlc3QgcmF0ZSBleGNlZWRzICR7dGhpcy5yYXRlTGltaXRDb25maWcud2FybmluZ1RocmVzaG9sZFBlcmNlbnR9JSBvZiByYXRlIGxpbWl0YCxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQvR2F0ZXdheS9SYXRlTGltaXRpbmcnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnVG90YWxSZXF1ZXN0cycsXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgfSksXG4gICAgICAvLyBUaHJlc2hvbGQgaXMgODAlIG9mIHJlcXVlc3RzIHBlciBtaW51dGUgKHJlcXVlc3RzUGVyU2Vjb25kICogNjAgKiB3YXJuaW5nVGhyZXNob2xkUGVyY2VudC8xMDApXG4gICAgICB0aHJlc2hvbGQ6IE1hdGguZmxvb3IodGhpcy5yYXRlTGltaXRDb25maWcucmVxdWVzdHNQZXJTZWNvbmQgKiA2MCAqICh0aGlzLnJhdGVMaW1pdENvbmZpZy53YXJuaW5nVGhyZXNob2xkUGVyY2VudCAvIDEwMCkpLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLnJhdGVMaW1pdENvbmZpZy5lbmFibGVBbGFybXMpIHtcbiAgICAgIGhpZ2hSZXF1ZXN0UmF0ZUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLnJhdGVMaW1pdEFsYXJtVG9waWMpXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIElBTSBQb2xpY3kgZm9yIGNsaWVudHMgdG8gaW52b2tlIHRoZSBHYXRld2F5XG4gICAgY29uc3QgZ2F0ZXdheUludm9rZVBvbGljeSA9IG5ldyBpYW0uTWFuYWdlZFBvbGljeSh0aGlzLCAnR2F0ZXdheUludm9rZVBvbGljeScsIHtcbiAgICAgIG1hbmFnZWRQb2xpY3lOYW1lOiAneDQwMi1wYXllci1hZ2VudC1nYXRld2F5LWludm9rZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BvbGljeSBhbGxvd2luZyBpbnZvY2F0aW9uIG9mIHRoZSB4NDAyIHBheWVyIGFnZW50IEdhdGV3YXknLFxuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdiZWRyb2NrOkludm9rZUFnZW50JyxcbiAgICAgICAgICAgICdiZWRyb2NrOkludm9rZUFnZW50V2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06YWdlbnQvKmAsXG4gICAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTphZ2VudC1hbGlhcy8qYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBHYXRld2F5IFRhcmdldCBNYW5hZ2VkIFBvbGljeVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFRoaXMgbWFuYWdlZCBwb2xpY3kgY2FuIGJlIGF0dGFjaGVkIHRvIG90aGVyIHJvbGVzIHRoYXQgbmVlZFxuICAgIC8vIHRvIGludm9rZSBHYXRld2F5IHRhcmdldHMgKGUuZy4sIGZvciB0ZXN0aW5nIG9yIGF1dG9tYXRpb24pLlxuICAgIGNvbnN0IGdhdGV3YXlUYXJnZXRQb2xpY3kgPSBuZXcgaWFtLk1hbmFnZWRQb2xpY3kodGhpcywgJ0dhdGV3YXlUYXJnZXRQb2xpY3knLCB7XG4gICAgICBtYW5hZ2VkUG9saWN5TmFtZTogJ3g0MDItcGF5ZXItYWdlbnQtZ2F0ZXdheS10YXJnZXQnLFxuICAgICAgZGVzY3JpcHRpb246ICdQb2xpY3kgZm9yIGludm9raW5nIHg0MDIgR2F0ZXdheSB0YXJnZXRzIChNQ1AgdG9vbCBzZXJ2ZXIpJyxcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgLy8gUzMgYWNjZXNzIGZvciBPcGVuQVBJIHNwZWNzXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBzaWQ6ICdPcGVuQXBpU3BlY0FjY2VzcycsXG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkdldE9iamVjdFZlcnNpb24nLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICB0aGlzLm9wZW5BcGlTcGVjQXNzZXQuYnVja2V0LmFybkZvck9iamVjdHMoJyonKSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgLy8gQVBJIEdhdGV3YXkgaW52b2NhdGlvblxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgc2lkOiAnQXBpR2F0ZXdheUludm9rZScsXG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdleGVjdXRlLWFwaTpJbnZva2UnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06Ki8qLyovKmAsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIC8vIENsb3VkV2F0Y2ggTG9nc1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgc2lkOiAnQ2xvdWRXYXRjaExvZ3MnLFxuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvYmVkcm9jay1hZ2VudGNvcmUvZ2F0ZXdheS10YXJnZXQvKjoqYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIERhc2hib2FyZCBmb3IgR2F0ZXdheSBtb25pdG9yaW5nXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdHYXRld2F5RGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ3g0MDItcGF5ZXItYWdlbnQtZ2F0ZXdheScsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgd2lkZ2V0cyB0byBkYXNoYm9hcmRcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlRleHRXaWRnZXQoe1xuICAgICAgICBtYXJrZG93bjogJyMgeDQwMiBQYXllciBBZ2VudCBHYXRld2F5XFxuTW9uaXRvcmluZyBkYXNoYm9hcmQgZm9yIHRoZSBBZ2VudENvcmUgR2F0ZXdheScsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIFJhdGUgTGltaXRpbmcgU2VjdGlvblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guVGV4dFdpZGdldCh7XG4gICAgICAgIG1hcmtkb3duOiAnIyMgUmF0ZSBMaW1pdGluZyBNZXRyaWNzJyxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUmVxdWVzdCBSYXRlIHZzIExpbWl0JyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudC9HYXRld2F5L1JhdGVMaW1pdGluZycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnVG90YWxSZXF1ZXN0cycsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIGxhYmVsOiAnUmVxdWVzdHMgcGVyIE1pbnV0ZScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIGxlZnRBbm5vdGF0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLnJhdGVMaW1pdENvbmZpZy5yZXF1ZXN0c1BlclNlY29uZCAqIDYwLFxuICAgICAgICAgICAgbGFiZWw6ICdSYXRlIExpbWl0IChwZXIgbWludXRlKScsXG4gICAgICAgICAgICBjb2xvcjogJyNmZjAwMDAnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdmFsdWU6IE1hdGguZmxvb3IodGhpcy5yYXRlTGltaXRDb25maWcucmVxdWVzdHNQZXJTZWNvbmQgKiA2MCAqICh0aGlzLnJhdGVMaW1pdENvbmZpZy53YXJuaW5nVGhyZXNob2xkUGVyY2VudCAvIDEwMCkpLFxuICAgICAgICAgICAgbGFiZWw6IGBXYXJuaW5nIFRocmVzaG9sZCAoJHt0aGlzLnJhdGVMaW1pdENvbmZpZy53YXJuaW5nVGhyZXNob2xkUGVyY2VudH0lKWAsXG4gICAgICAgICAgICBjb2xvcjogJyNmZjk5MDAnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVGhyb3R0bGVkIFJlcXVlc3RzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudC9HYXRld2F5L1JhdGVMaW1pdGluZycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnVGhyb3R0bGVkUmVxdWVzdHMnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ1Rocm90dGxlZCBSZXF1ZXN0cycsXG4gICAgICAgICAgICBjb2xvcjogJyNmZjAwMDAnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyBSYXRlIExpbWl0aW5nIENvbmZpZ3VyYXRpb24gRGlzcGxheVxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guVGV4dFdpZGdldCh7XG4gICAgICAgIG1hcmtkb3duOiBgIyMjIFJhdGUgTGltaXQgQ29uZmlndXJhdGlvblxufCBTZXR0aW5nIHwgVmFsdWUgfFxufC0tLS0tLS0tLXwtLS0tLS0tfFxufCBSZXF1ZXN0cyBwZXIgU2Vjb25kIHwgJHt0aGlzLnJhdGVMaW1pdENvbmZpZy5yZXF1ZXN0c1BlclNlY29uZH0gfFxufCBCdXJzdCBDYXBhY2l0eSB8ICR7dGhpcy5yYXRlTGltaXRDb25maWcuYnVyc3RDYXBhY2l0eX0gfFxufCBMaW1pdCBCeSB8ICR7dGhpcy5yYXRlTGltaXRDb25maWcubGltaXRCeX0gfFxufCBXYXJuaW5nIFRocmVzaG9sZCB8ICR7dGhpcy5yYXRlTGltaXRDb25maWcud2FybmluZ1RocmVzaG9sZFBlcmNlbnR9JSB8YCxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDQsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtU3RhdHVzV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdSYXRlIExpbWl0aW5nIEFsYXJtcycsXG4gICAgICAgIGFsYXJtczogW3Rocm90dGxlZFJlcXVlc3RzQWxhcm0sIGhpZ2hSZXF1ZXN0UmF0ZUFsYXJtXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDQsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5Mb2dRdWVyeVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnR2F0ZXdheSBSZXF1ZXN0IExvZ3MnLFxuICAgICAgICBsb2dHcm91cE5hbWVzOiBbdGhpcy5nYXRld2F5TG9nR3JvdXAubG9nR3JvdXBOYW1lXSxcbiAgICAgICAgcXVlcnlMaW5lczogW1xuICAgICAgICAgICdmaWVsZHMgQHRpbWVzdGFtcCwgQG1lc3NhZ2UnLFxuICAgICAgICAgICdzb3J0IEB0aW1lc3RhbXAgZGVzYycsXG4gICAgICAgICAgJ2xpbWl0IDEwMCcsXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2RwU2VjcmV0QXJuJywge1xuICAgICAgdmFsdWU6IGNkcFNlY3JldC5zZWNyZXRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBvZiB0aGUgQ0RQIGNyZWRlbnRpYWxzIHNlY3JldCcsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheWVyQWdlbnRDZHBTZWNyZXRBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50UnVudGltZVJvbGVBcm4nLCB7XG4gICAgICB2YWx1ZTogYWdlbnRSdW50aW1lUm9sZS5yb2xlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUk4gb2YgdGhlIEFnZW50Q29yZSBSdW50aW1lIElBTSByb2xlJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudFJ1bnRpbWVSb2xlQXJuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHYXRld2F5Um9sZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmdhdGV3YXlSb2xlLnJvbGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBvZiB0aGUgQWdlbnRDb3JlIEdhdGV3YXkgSUFNIHJvbGUnLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJQYXllckFnZW50R2F0ZXdheVJvbGVBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dhdGV3YXlMb2dHcm91cE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5nYXRld2F5TG9nR3JvdXAubG9nR3JvdXBOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIExvZyBHcm91cCBmb3IgR2F0ZXdheSBsb2dzJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudEdhdGV3YXlMb2dHcm91cCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR2F0ZXdheUludm9rZVBvbGljeUFybicsIHtcbiAgICAgIHZhbHVlOiBnYXRld2F5SW52b2tlUG9saWN5Lm1hbmFnZWRQb2xpY3lBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBvZiB0aGUgcG9saWN5IGZvciBpbnZva2luZyB0aGUgR2F0ZXdheScsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheWVyQWdlbnRHYXRld2F5SW52b2tlUG9saWN5QXJuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT14NDAyLXBheWVyLWFnZW50LWdhdGV3YXlgLFxuICAgICAgZGVzY3JpcHRpb246ICdVUkwgdG8gdGhlIENsb3VkV2F0Y2ggRGFzaGJvYXJkJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudERhc2hib2FyZFVybCcsXG4gICAgfSk7XG5cbiAgICAvLyBSYXRlIExpbWl0aW5nIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmF0ZUxpbWl0QWxhcm1Ub3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJhdGVMaW1pdEFsYXJtVG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIHJhdGUgbGltaXQgYWxhcm1zJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudFJhdGVMaW1pdEFsYXJtVG9waWNBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JhdGVMaW1pdENvbmZpZycsIHtcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHJlcXVlc3RzUGVyU2Vjb25kOiB0aGlzLnJhdGVMaW1pdENvbmZpZy5yZXF1ZXN0c1BlclNlY29uZCxcbiAgICAgICAgYnVyc3RDYXBhY2l0eTogdGhpcy5yYXRlTGltaXRDb25maWcuYnVyc3RDYXBhY2l0eSxcbiAgICAgICAgbGltaXRCeTogdGhpcy5yYXRlTGltaXRDb25maWcubGltaXRCeSxcbiAgICAgICAgd2FybmluZ1RocmVzaG9sZFBlcmNlbnQ6IHRoaXMucmF0ZUxpbWl0Q29uZmlnLndhcm5pbmdUaHJlc2hvbGRQZXJjZW50LFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogJ1JhdGUgbGltaXRpbmcgY29uZmlndXJhdGlvbicsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheWVyQWdlbnRSYXRlTGltaXRDb25maWcnLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gR2F0ZXdheSBUYXJnZXQgT3V0cHV0cyAoTUNQIFRvb2wgU2VydmVyKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHYXRld2F5VGFyZ2V0Um9sZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmdhdGV3YXlUYXJnZXRSb2xlLnJvbGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBvZiB0aGUgR2F0ZXdheSBUYXJnZXQgSUFNIHJvbGUgZm9yIE1DUCB0b29sIHNlcnZlcicsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheWVyQWdlbnRHYXRld2F5VGFyZ2V0Um9sZUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR2F0ZXdheVRhcmdldFBvbGljeUFybicsIHtcbiAgICAgIHZhbHVlOiBnYXRld2F5VGFyZ2V0UG9saWN5Lm1hbmFnZWRQb2xpY3lBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBvZiB0aGUgR2F0ZXdheSBUYXJnZXQgbWFuYWdlZCBwb2xpY3knLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJQYXllckFnZW50R2F0ZXdheVRhcmdldFBvbGljeUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnT3BlbkFwaVNwZWNTM1VyaScsIHtcbiAgICAgIHZhbHVlOiBgczM6Ly8ke3RoaXMub3BlbkFwaVNwZWNBc3NldC5zM0J1Y2tldE5hbWV9LyR7dGhpcy5vcGVuQXBpU3BlY0Fzc2V0LnMzT2JqZWN0S2V5fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIFVSSSBvZiB0aGUgT3BlbkFQSSBzcGVjIGZvciBHYXRld2F5IHRhcmdldCBjb25maWd1cmF0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudE9wZW5BcGlTcGVjUzNVcmknLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09wZW5BcGlTcGVjUzNVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5vcGVuQXBpU3BlY0Fzc2V0LnMzT2JqZWN0VXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBVUkwgb2YgdGhlIE9wZW5BUEkgc3BlYyBmb3IgR2F0ZXdheSB0YXJnZXQgY29uZmlndXJhdGlvbicsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheWVyQWdlbnRPcGVuQXBpU3BlY1MzVXJsJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHYXRld2F5VGFyZ2V0TG9nR3JvdXBOYW1lJywge1xuICAgICAgdmFsdWU6IGdhdGV3YXlUYXJnZXRMb2dHcm91cC5sb2dHcm91cE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggTG9nIEdyb3VwIGZvciBHYXRld2F5IFRhcmdldCBsb2dzJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudEdhdGV3YXlUYXJnZXRMb2dHcm91cCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VsbGVyQ2xvdWRGcm9udFVybCcsIHtcbiAgICAgIHZhbHVlOiBzZWxsZXJDbG91ZEZyb250VXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBVUkwgZm9yIHNlbGxlciBpbmZyYXN0cnVjdHVyZSAodGFyZ2V0IFVSTCknLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJQYXllckFnZW50U2VsbGVyQ2xvdWRGcm9udFVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWNwVG9vbEVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6ICcvdjEvbWNwL3Rvb2xzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTUNQIHRvb2wgZGlzY292ZXJ5IGVuZHBvaW50IHBhdGggKHJlbGF0aXZlIHRvIEdhdGV3YXkgVVJMKScsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheWVyQWdlbnRNY3BUb29sRW5kcG9pbnQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ01jcEludm9rZUVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6ICcvdjEvbWNwL2ludm9rZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ01DUCB0b29sIGludm9jYXRpb24gZW5kcG9pbnQgcGF0aCAocmVsYXRpdmUgdG8gR2F0ZXdheSBVUkwpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudE1jcEludm9rZUVuZHBvaW50JyxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFRvb2wgQVJOcyBmb3IgTUNQIFRvb2xzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gVGhlc2UgQVJOIHBhdHRlcm5zIGFyZSB1c2VkIGJ5IHRoZSBhZ2VudCB0byBpbnZva2Ugc3BlY2lmaWMgdG9vbHNcbiAgICAvLyB2aWEgdGhlIEdhdGV3YXkuIFRoZSBhY3R1YWwgQVJOcyBhcmUgY29uc3RydWN0ZWQgYXQgcnVudGltZSB3aGVuXG4gICAgLy8gdGhlIEdhdGV3YXkgYW5kIHRhcmdldHMgYXJlIGNyZWF0ZWQgdmlhIEFnZW50Q29yZSBDTEkvY29uc29sZS5cbiAgICAvL1xuICAgIC8vIEFSTiBGb3JtYXQ6IGFybjphd3M6YmVkcm9jay1hZ2VudGNvcmU6e3JlZ2lvbn06e2FjY291bnR9OmdhdGV3YXktdGFyZ2V0L3tnYXRld2F5LWlkfS90b29sL3t0b29sLW5hbWV9XG4gICAgLy9cbiAgICAvLyBOb3RlOiBHYXRld2F5IElEIGlzIGFzc2lnbmVkIGF0IGNyZWF0aW9uIHRpbWUuIFRoZXNlIG91dHB1dHMgcHJvdmlkZVxuICAgIC8vIHRoZSBBUk4gcGF0dGVybnMgdGhhdCBjYW4gYmUgdXNlZCB3aXRoIHRoZSBhY3R1YWwgR2F0ZXdheSBJRC5cblxuICAgIGNvbnN0IHRvb2xOYW1lcyA9IFtcbiAgICAgICdnZXRfcHJlbWl1bV9hcnRpY2xlJyxcbiAgICAgICdnZXRfd2VhdGhlcl9kYXRhJyxcbiAgICAgICdnZXRfbWFya2V0X2FuYWx5c2lzJyxcbiAgICAgICdnZXRfcmVzZWFyY2hfcmVwb3J0JyxcbiAgICBdO1xuXG4gICAgLy8gT3V0cHV0IGluZGl2aWR1YWwgdG9vbCBBUk4gcGF0dGVybnNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVG9vbEFyblBhdHRlcm4nLCB7XG4gICAgICB2YWx1ZTogYGFybjphd3M6YmVkcm9jay1hZ2VudGNvcmU6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmdhdGV3YXktdGFyZ2V0L1xcJHtHQVRFV0FZX1RBUkdFVF9JRH0vdG9vbC9cXCR7VE9PTF9OQU1FfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBwYXR0ZXJuIGZvciBHYXRld2F5IHRhcmdldCB0b29scy4gUmVwbGFjZSAke0dBVEVXQVlfVEFSR0VUX0lEfSBhbmQgJHtUT09MX05BTUV9IHdpdGggYWN0dWFsIHZhbHVlcy4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJQYXllckFnZW50VG9vbEFyblBhdHRlcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Rvb2xBcm5zJywge1xuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcGF0dGVybjogYGFybjphd3M6YmVkcm9jay1hZ2VudGNvcmU6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmdhdGV3YXktdGFyZ2V0L1xcJHtHQVRFV0FZX1RBUkdFVF9JRH0vdG9vbC97dG9vbF9uYW1lfWAsXG4gICAgICAgIHRvb2xzOiB0b29sTmFtZXMubWFwKG5hbWUgPT4gKHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGFyblRlbXBsYXRlOiBgYXJuOmF3czpiZWRyb2NrLWFnZW50Y29yZToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06Z2F0ZXdheS10YXJnZXQvXFwke0dBVEVXQVlfVEFSR0VUX0lEfS90b29sLyR7bmFtZX1gLFxuICAgICAgICB9KSksXG4gICAgICAgIG5vdGU6ICdSZXBsYWNlICR7R0FURVdBWV9UQVJHRVRfSUR9IHdpdGggdGhlIGFjdHVhbCBHYXRld2F5IHRhcmdldCBJRCBhZnRlciBjcmVhdGlvbicsXG4gICAgICB9LCBudWxsLCAyKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVG9vbCBBUk4gdGVtcGxhdGVzIGZvciBhbGwgTUNQIHRvb2xzJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyUGF5ZXJBZ2VudFRvb2xBcm5zJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBNQ1AgZW5kcG9pbnQgY29uZmlndXJhdGlvbiB3aXRoIGZ1bGwgVVJMIHBhdHRlcm5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWNwRW5kcG9pbnRDb25maWcnLCB7XG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBiYXNlVXJsUGF0dGVybjogJ2h0dHBzOi8vJHtHQVRFV0FZX0lEfS5iZWRyb2NrLWFnZW50Y29yZS4ke1JFR0lPTn0uYW1hem9uYXdzLmNvbScsXG4gICAgICAgIGVuZHBvaW50czoge1xuICAgICAgICAgIGRpc2NvdmVyeToge1xuICAgICAgICAgICAgcGF0aDogJy92MS9tY3AvdG9vbHMnLFxuICAgICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBhbGwgYXZhaWxhYmxlIE1DUCB0b29scycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbnZva2U6IHtcbiAgICAgICAgICAgIHBhdGg6ICcvdjEvbWNwL2ludm9rZScsXG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW52b2tlIGFuIE1DUCB0b29sIGJ5IG5hbWUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdG9vbFNjaGVtYToge1xuICAgICAgICAgICAgcGF0aDogJy92MS9tY3AvdG9vbHMve3Rvb2xfbmFtZX0vc2NoZW1hJyxcbiAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0dldCBzY2hlbWEgZm9yIGEgc3BlY2lmaWMgdG9vbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYXV0aGVudGljYXRpb246ICdJQU1fU0lHVjQnLFxuICAgICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgICBub3RlOiAnUmVwbGFjZSAke0dBVEVXQVlfSUR9IHdpdGggdGhlIGFjdHVhbCBHYXRld2F5IElEIGFmdGVyIGNyZWF0aW9uJyxcbiAgICAgIH0sIG51bGwsIDIpLFxuICAgICAgZGVzY3JpcHRpb246ICdNQ1AgZW5kcG9pbnQgY29uZmlndXJhdGlvbiBmb3IgdG9vbCBkaXNjb3ZlcnkgYW5kIGludm9jYXRpb24nLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJQYXllckFnZW50TWNwRW5kcG9pbnRDb25maWcnLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IEdhdGV3YXkgdGFyZ2V0IEFSTiBwYXR0ZXJuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dhdGV3YXlUYXJnZXRBcm5QYXR0ZXJuJywge1xuICAgICAgdmFsdWU6IGBhcm46YXdzOmJlZHJvY2stYWdlbnRjb3JlOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpnYXRld2F5LXRhcmdldC9cXCR7R0FURVdBWV9UQVJHRVRfSUR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVJOIHBhdHRlcm4gZm9yIHRoZSBHYXRld2F5IHRhcmdldC4gUmVwbGFjZSAke0dBVEVXQVlfVEFSR0VUX0lEfSB3aXRoIGFjdHVhbCBJRCBhZnRlciBjcmVhdGlvbi4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJQYXllckFnZW50R2F0ZXdheVRhcmdldEFyblBhdHRlcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dhdGV3YXlUYXJnZXRDb25maWcnLCB7XG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBuYW1lOiAneDQwMi1jb250ZW50LXRvb2xzJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdQcmVtaXVtIGNvbnRlbnQgZW5kcG9pbnRzIHByb3RlY3RlZCBieSB4NDAyIHBheW1lbnQgcHJvdG9jb2wnLFxuICAgICAgICB0eXBlOiAnT1BFTkFQSScsXG4gICAgICAgIHRhcmdldFVybDogc2VsbGVyQ2xvdWRGcm9udFVybCxcbiAgICAgICAgb3BlbkFwaVNwZWNTM1VyaTogYHMzOi8vJHt0aGlzLm9wZW5BcGlTcGVjQXNzZXQuczNCdWNrZXROYW1lfS8ke3RoaXMub3BlbkFwaVNwZWNBc3NldC5zM09iamVjdEtleX1gLFxuICAgICAgICB0b29sczogW1xuICAgICAgICAgIHsgbmFtZTogJ2dldF9wcmVtaXVtX2FydGljbGUnLCBwcmljZTogJzAuMDAxIFVTREMnIH0sXG4gICAgICAgICAgeyBuYW1lOiAnZ2V0X3dlYXRoZXJfZGF0YScsIHByaWNlOiAnMC4wMDA1IFVTREMnIH0sXG4gICAgICAgICAgeyBuYW1lOiAnZ2V0X21hcmtldF9hbmFseXNpcycsIHByaWNlOiAnMC4wMDIgVVNEQycgfSxcbiAgICAgICAgICB7IG5hbWU6ICdnZXRfcmVzZWFyY2hfcmVwb3J0JywgcHJpY2U6ICcwLjAwNSBVU0RDJyB9LFxuICAgICAgICBdLFxuICAgICAgfSwgbnVsbCwgMiksXG4gICAgICBkZXNjcmlwdGlvbjogJ0dhdGV3YXkgdGFyZ2V0IGNvbmZpZ3VyYXRpb24gZm9yIE1DUCB0b29sIHNlcnZlcicsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheWVyQWdlbnRHYXRld2F5VGFyZ2V0Q29uZmlnJyxcbiAgICB9KTtcblxuICAgIC8vIEluc3RydWN0aW9ucyBmb3IgbWFudWFsIEFnZW50Q29yZSBzZXR1cFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdOZXh0U3RlcHMnLCB7XG4gICAgICB2YWx1ZTogYFxuQWZ0ZXIgZGVwbG95aW5nIHRoaXMgc3RhY2s6XG5cbjEuIFVwZGF0ZSB0aGUgQ0RQIHNlY3JldCB3aXRoIHlvdXIgYWN0dWFsIGNyZWRlbnRpYWxzOlxuICAgYXdzIHNlY3JldHNtYW5hZ2VyIHB1dC1zZWNyZXQtdmFsdWUgLS1zZWNyZXQtaWQgJHtjZHBTZWNyZXQuc2VjcmV0TmFtZX0gLS1zZWNyZXQtc3RyaW5nICd7XCJDRFBfQVBJX0tFWV9OQU1FXCI6XCJ5b3VyLWtleVwiLFwiQ0RQX0FQSV9LRVlfUFJJVkFURV9LRVlcIjpcInlvdXItcHJpdmF0ZS1rZXlcIn0nXG5cbjIuIERlcGxveSB0aGUgc2VsbGVyIGluZnJhc3RydWN0dXJlIGZpcnN0IChpZiBub3QgYWxyZWFkeSBkZXBsb3llZCk6XG4gICBjZCBzZWxsZXItaW5mcmFzdHJ1Y3R1cmUgJiYgbnBtIGluc3RhbGwgJiYgY2RrIGRlcGxveVxuICAgIyBOb3RlIHRoZSBDbG91ZEZyb250IFVSTCBmcm9tIHRoZSBvdXRwdXRcblxuMy4gU2V0IHRoZSBzZWxsZXIgQ2xvdWRGcm9udCBVUkwgZW52aXJvbm1lbnQgdmFyaWFibGU6XG4gICBleHBvcnQgWDQwMl9TRUxMRVJfQ0xPVURGUk9OVF9VUkw9aHR0cHM6Ly9kWFhYWFhYWFhYWFhYWC5jbG91ZGZyb250Lm5ldFxuXG40LiBDcmVhdGUgQWdlbnRDb3JlIFJ1bnRpbWUgdmlhIENMSSBvciBjb25zb2xlOlxuICAgLSBVc2UgdGhlIGFnZW50IGNvZGUgZnJvbSBwYXllci1hZ2VudC9cbiAgIC0gQXNzaWduIHRoZSBydW50aW1lIHJvbGU6ICR7YWdlbnRSdW50aW1lUm9sZS5yb2xlQXJufVxuICAgLSBTZWUgcGF5ZXItYWdlbnQvYWdlbnRjb3JlX2NvbmZpZy55YW1sIGZvciBjb25maWd1cmF0aW9uXG5cbjUuIENyZWF0ZSBBZ2VudENvcmUgR2F0ZXdheSB3aXRoIE1DUCB0b29sIHNlcnZlcjpcbiAgIC0gUG9pbnQgdG8gdGhlIFJ1bnRpbWUgZW5kcG9pbnRcbiAgIC0gQXNzaWduIHRoZSBnYXRld2F5IHJvbGU6ICR7dGhpcy5nYXRld2F5Um9sZS5yb2xlQXJufVxuICAgLSBDb25maWd1cmUgSUFNIFNpZ1Y0IGF1dGhlbnRpY2F0aW9uXG4gICAtIENvbmZpZ3VyZSByYXRlIGxpbWl0aW5nOlxuICAgICAqIFJlcXVlc3RzIHBlciBzZWNvbmQ6ICR7dGhpcy5yYXRlTGltaXRDb25maWcucmVxdWVzdHNQZXJTZWNvbmR9XG4gICAgICogQnVyc3QgY2FwYWNpdHk6ICR7dGhpcy5yYXRlTGltaXRDb25maWcuYnVyc3RDYXBhY2l0eX1cbiAgICAgKiBMaW1pdCBieTogJHt0aGlzLnJhdGVMaW1pdENvbmZpZy5saW1pdEJ5fVxuICAgLSBTZWUgcGF5ZXItYWdlbnQvZ2F0ZXdheV9jb25maWcueWFtbCBmb3IgZnVsbCBjb25maWd1cmF0aW9uXG5cbjYuIENvbmZpZ3VyZSBHYXRld2F5IFRhcmdldCBmb3IgTUNQIHRvb2xzOlxuICAgLSBUYXJnZXQgbmFtZTogeDQwMi1jb250ZW50LXRvb2xzXG4gICAtIFRhcmdldCB0eXBlOiBPUEVOQVBJXG4gICAtIE9wZW5BUEkgc3BlYyBTMyBVUkk6IHMzOi8vJHt0aGlzLm9wZW5BcGlTcGVjQXNzZXQuczNCdWNrZXROYW1lfS8ke3RoaXMub3BlbkFwaVNwZWNBc3NldC5zM09iamVjdEtleX1cbiAgIC0gVGFyZ2V0IFVSTDogJHtzZWxsZXJDbG91ZEZyb250VXJsfVxuICAgLSBBc3NpZ24gdGFyZ2V0IHJvbGU6ICR7dGhpcy5nYXRld2F5VGFyZ2V0Um9sZS5yb2xlQXJufVxuICAgLSBDb25maWd1cmUgeDQwMiBoZWFkZXIgcGFzc3Rocm91Z2ggKHNlZSBnYXRld2F5X2NvbmZpZy55YW1sKVxuICAgLSBOb3RlIHRoZSBHYXRld2F5IFRhcmdldCBJRCBmb3IgdG9vbCBBUk4gY29uc3RydWN0aW9uXG5cbjcuIFN1YnNjcmliZSB0byByYXRlIGxpbWl0IGFsYXJtcyAob3B0aW9uYWwpOlxuICAgYXdzIHNucyBzdWJzY3JpYmUgLS10b3BpYy1hcm4gJHt0aGlzLnJhdGVMaW1pdEFsYXJtVG9waWMudG9waWNBcm59IC0tcHJvdG9jb2wgZW1haWwgLS1ub3RpZmljYXRpb24tZW5kcG9pbnQgeW91ci1lbWFpbEBleGFtcGxlLmNvbVxuXG44LiBHcmFudCBHYXRld2F5IGFjY2VzcyB0byBjbGllbnRzOlxuICAgLSBBdHRhY2ggdGhlIGludm9rZSBwb2xpY3kgdG8gSUFNIHVzZXJzL3JvbGVzIHRoYXQgbmVlZCBhY2Nlc3NcbiAgIC0gUG9saWN5IEFSTjogJHtnYXRld2F5SW52b2tlUG9saWN5Lm1hbmFnZWRQb2xpY3lBcm59XG5cbjkuIFRlc3QgTUNQIHRvb2wgZGlzY292ZXJ5OlxuICAgY3VybCAtWCBHRVQgXCJodHRwczovLzxnYXRld2F5LXVybD4vdjEvbWNwL3Rvb2xzXCIgLUggXCJBdXRob3JpemF0aW9uOiBBV1M0LUhNQUMtU0hBMjU2IC4uLlwiXG5cbjEwLiBNb25pdG9yIHRoZSBHYXRld2F5OlxuICAgIC0gVmlldyBsb2dzIGluIENsb3VkV2F0Y2g6ICR7dGhpcy5nYXRld2F5TG9nR3JvdXAubG9nR3JvdXBOYW1lfVxuICAgIC0gVmlldyB0YXJnZXQgbG9nczogJHtnYXRld2F5VGFyZ2V0TG9nR3JvdXAubG9nR3JvdXBOYW1lfVxuICAgIC0gVmlldyBkYXNoYm9hcmQ6IGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT14NDAyLXBheWVyLWFnZW50LWdhdGV3YXlcbiAgICAtIFJhdGUgbGltaXQgYWxhcm1zIHdpbGwgbm90aWZ5IHZpYSBTTlMgdG9waWNcblxuTUNQIFRvb2wgRW5kcG9pbnRzOlxuLSBEaXNjb3Zlcnk6IEdFVCAvdjEvbWNwL3Rvb2xzXG4tIEludm9jYXRpb246IFBPU1QgL3YxL21jcC9pbnZva2Vcbi0gVG9vbCBTY2hlbWE6IEdFVCAvdjEvbWNwL3Rvb2xzL3t0b29sX25hbWV9L3NjaGVtYVxuXG5Ub29sIEFSTiBQYXR0ZXJuOlxuICBhcm46YXdzOmJlZHJvY2stYWdlbnRjb3JlOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpnYXRld2F5LXRhcmdldC97R0FURVdBWV9UQVJHRVRfSUR9L3Rvb2wve1RPT0xfTkFNRX1cblxuQXZhaWxhYmxlIE1DUCBUb29scyAoeDQwMiBwYXltZW50IHJlcXVpcmVkKTpcbi0gZ2V0X3ByZW1pdW1fYXJ0aWNsZSAoMC4wMDEgVVNEQylcbi0gZ2V0X3dlYXRoZXJfZGF0YSAoMC4wMDA1IFVTREMpXG4tIGdldF9tYXJrZXRfYW5hbHlzaXMgKDAuMDAyIFVTREMpXG4tIGdldF9yZXNlYXJjaF9yZXBvcnQgKDAuMDA1IFVTREMpXG5cblNlZTogaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2JlZHJvY2stYWdlbnRjb3JlL2xhdGVzdC9kZXZndWlkZS9cbiAgICAgIGAsXG4gICAgICBkZXNjcmlwdGlvbjogJ05leHQgc3RlcHMgZm9yIEFnZW50Q29yZSBzZXR1cCcsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDREsgTmFnIFN1cHByZXNzaW9uc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhjZHBTZWNyZXQsIFtcbiAgICAgIHsgaWQ6ICdBd3NTb2x1dGlvbnMtU01HNCcsIHJlYXNvbjogJ0NEUCBBUEkga2V5cyBhcmUgbWFuYWdlZCBleHRlcm5hbGx5IGJ5IENvaW5iYXNlIOKAlCBhdXRvbWF0aWMgcm90YXRpb24gbm90IGFwcGxpY2FibGUnIH0sXG4gICAgXSk7XG5cbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoYWdlbnRSdW50aW1lUm9sZSwgW1xuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JywgcmVhc29uOiAnV2lsZGNhcmRzIHJlcXVpcmVkOiBjcm9zcy1yZWdpb24gaW5mZXJlbmNlIHByb2ZpbGVzIChiZWRyb2NrOiopLCBDbG91ZFdhdGNoIGxvZyBncm91cHMgKC9hd3MvYmVkcm9jay1hZ2VudGNvcmUvKiksIGFuZCBlY3I6R2V0QXV0aG9yaXphdGlvblRva2VuIHJlcXVpcmVzIHJlc291cmNlIConIH0sXG4gICAgXSwgdHJ1ZSk7XG5cbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnModGhpcy5nYXRld2F5Um9sZSwgW1xuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JywgcmVhc29uOiAnR2F0ZXdheSBtdXN0IGludm9rZSBhbnkgYWdlbnQvYWxpYXMgaW4gdGhlIGFjY291bnQg4oCUIElEcyBhcmUgYXNzaWduZWQgYXQgcnVudGltZSBieSBBZ2VudENvcmUnIH0sXG4gICAgXSwgdHJ1ZSk7XG5cbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnModGhpcy5nYXRld2F5VGFyZ2V0Um9sZSwgW1xuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JywgcmVhc29uOiAnR2F0ZXdheSB0YXJnZXQgbmVlZHMgYnJvYWQgYWNjZXNzOiBTMyBmb3IgT3BlbkFQSSBzcGVjcywgZXhlY3V0ZS1hcGkgZm9yIHByaXZhdGUgdGFyZ2V0cywgQ2xvdWRXYXRjaCBsb2dzLCBMYW1iZGEgZnVuY3Rpb25zLCBLTVMgZm9yIGVuY3J5cHRlZCBzZWNyZXRzLCBhbmQgWC1SYXkgdHJhY2luZyDigJQgYWxsIHNjb3BlZCB0byBhY2NvdW50L3ByZWZpeCB3aGVyZSBwb3NzaWJsZScgfSxcbiAgICBdLCB0cnVlKTtcblxuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyh0aGlzLnJhdGVMaW1pdEFsYXJtVG9waWMsIFtcbiAgICAgIHsgaWQ6ICdBd3NTb2x1dGlvbnMtU05TMycsIHJlYXNvbjogJ0RlbW8gcHJvamVjdCDigJQgU05TIFNTTCBlbmZvcmNlbWVudCBub3QgcmVxdWlyZWQgZm9yIGludGVybmFsIGFsYXJtIG5vdGlmaWNhdGlvbnMnIH0sXG4gICAgXSk7XG5cbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoZ2F0ZXdheUludm9rZVBvbGljeSwgW1xuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JywgcmVhc29uOiAnQ2xpZW50IGludm9rZSBwb2xpY3kgbXVzdCBhbGxvdyBhbnkgYWdlbnQvYWxpYXMg4oCUIElEcyBhc3NpZ25lZCBhdCBydW50aW1lIGJ5IEFnZW50Q29yZScgfSxcbiAgICBdLCB0cnVlKTtcblxuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhnYXRld2F5VGFyZ2V0UG9saWN5LCBbXG4gICAgICB7IGlkOiAnQXdzU29sdXRpb25zLUlBTTUnLCByZWFzb246ICdUYXJnZXQgcG9saWN5IG5lZWRzIFMzIHdpbGRjYXJkIGZvciBPcGVuQVBJIHNwZWNzLCBleGVjdXRlLWFwaSBmb3IgQVBJIEdhdGV3YXkgdGFyZ2V0cywgYW5kIENsb3VkV2F0Y2ggbG9nIHN0cmVhbXMnIH0sXG4gICAgXSwgdHJ1ZSk7XG4gIH1cbn1cbiJdfQ==