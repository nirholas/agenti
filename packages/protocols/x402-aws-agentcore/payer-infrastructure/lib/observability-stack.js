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
exports.ObservabilityStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
class ObservabilityStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.alarms = [];
        const cloudfrontDistId = props?.cloudfrontDistributionId || 'DISTRIBUTION_ID';
        const gatewayLogGroup = props?.gatewayLogGroupName || '/aws/bedrock-agentcore/gateway/x402-payer-agent';
        const enableAlerts = props?.enableAlerts !== false;
        // =========================================================================
        // SNS Topic for Alerts
        // =========================================================================
        if (enableAlerts) {
            this.alertTopic = new sns.Topic(this, 'X402AlertTopic', {
                topicName: 'x402-enterprise-demo-alerts',
                displayName: 'x402 Enterprise Demo Alerts',
            });
            // Add email subscription if provided
            if (props?.alertEmail) {
                new sns.Subscription(this, 'AlertEmailSubscription', {
                    topic: this.alertTopic,
                    protocol: sns.SubscriptionProtocol.EMAIL,
                    endpoint: props.alertEmail,
                });
            }
            // Create alerting rules
            this.createAlertingRules(cloudfrontDistId);
        }
        // =========================================================================
        // Main Overview Dashboard - End-to-End Payment Flow
        // =========================================================================
        this.mainDashboard = new cloudwatch.Dashboard(this, 'X402MainDashboard', {
            dashboardName: 'x402-enterprise-demo-overview',
        });
        // Header
        this.mainDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: `# x402 Enterprise Demo - Overview Dashboard
Monitor the complete payment flow from payer agent to seller infrastructure.
        
**Architecture:** Payer Agent (AgentCore) → CloudFront (Seller) → Lambda@Edge (Payment Verification)`,
            width: 24,
            height: 2,
        }));
        // Key Metrics Summary Row
        this.mainDashboard.addWidgets(new cloudwatch.SingleValueWidget({
            title: 'Total Requests (24h)',
            metrics: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'RequestCount',
                    statistic: 'Sum',
                    period: cdk.Duration.hours(24),
                }),
            ],
            width: 6,
            height: 4,
        }), new cloudwatch.SingleValueWidget({
            title: 'Payments Settled (24h)',
            metrics: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentSettled',
                    statistic: 'Sum',
                    period: cdk.Duration.hours(24),
                }),
            ],
            width: 6,
            height: 4,
        }), new cloudwatch.SingleValueWidget({
            title: 'Payment Success Rate',
            metrics: [
                new cloudwatch.MathExpression({
                    expression: '100 * settled / (settled + failed)',
                    usingMetrics: {
                        settled: new cloudwatch.Metric({
                            namespace: 'X402/PaymentVerifier',
                            metricName: 'PaymentSettled',
                            statistic: 'Sum',
                            period: cdk.Duration.hours(1),
                        }),
                        failed: new cloudwatch.Metric({
                            namespace: 'X402/PaymentVerifier',
                            metricName: 'PaymentFailed',
                            statistic: 'Sum',
                            period: cdk.Duration.hours(1),
                        }),
                    },
                    label: 'Success Rate %',
                    period: cdk.Duration.hours(1),
                }),
            ],
            width: 6,
            height: 4,
        }), new cloudwatch.SingleValueWidget({
            title: 'Avg Latency (ms)',
            metrics: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'Latency',
                    statistic: 'Average',
                    period: cdk.Duration.hours(1),
                }),
            ],
            width: 6,
            height: 4,
        }));
        // Payment Flow Section
        this.mainDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Payment Flow Metrics',
            width: 24,
            height: 1,
        }));
        this.mainDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Payment Flow Funnel',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'RequestCount',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Requests',
                    color: '#2ca02c',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentRequired',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: '402 Responses',
                    color: '#ff7f0e',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentReceived',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Payments Received',
                    color: '#1f77b4',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentVerified',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Payments Verified',
                    color: '#9467bd',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentSettled',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Payments Settled',
                    color: '#17becf',
                }),
            ],
            width: 12,
            height: 8,
        }), new cloudwatch.GraphWidget({
            title: 'Errors & Failures',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentFailed',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Payment Failed',
                    color: '#d62728',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'ValidationError',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Validation Errors',
                    color: '#ff9896',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'FacilitatorError',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Facilitator Errors',
                    color: '#e377c2',
                }),
            ],
            width: 12,
            height: 8,
        }));
        // Latency Section
        this.mainDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Latency Metrics',
            width: 24,
            height: 1,
        }));
        this.mainDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'End-to-End Latency',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'Latency',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(1),
                    label: 'Average',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'Latency',
                    statistic: 'p50',
                    period: cdk.Duration.minutes(1),
                    label: 'p50',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'Latency',
                    statistic: 'p90',
                    period: cdk.Duration.minutes(1),
                    label: 'p90',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'Latency',
                    statistic: 'p99',
                    period: cdk.Duration.minutes(1),
                    label: 'p99',
                }),
            ],
            width: 8,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Verification Latency',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'VerificationLatency',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(1),
                    label: 'Average',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'VerificationLatency',
                    statistic: 'p99',
                    period: cdk.Duration.minutes(1),
                    label: 'p99',
                }),
            ],
            width: 8,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Settlement Latency',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'SettlementLatency',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(1),
                    label: 'Average',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'SettlementLatency',
                    statistic: 'p99',
                    period: cdk.Duration.minutes(1),
                    label: 'p99',
                }),
            ],
            width: 8,
            height: 6,
        }));
        // =========================================================================
        // Payer Agent Dashboard
        // =========================================================================
        this.payerDashboard = new cloudwatch.Dashboard(this, 'X402PayerDashboard', {
            dashboardName: 'x402-payer-agent',
        });
        this.payerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: `# x402 Payer Agent Dashboard
Monitor the AgentCore-based payer agent that handles payment signing and content requests.`,
            width: 24,
            height: 2,
        }));
        // AgentCore Gateway Metrics
        this.payerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## AgentCore Gateway',
            width: 24,
            height: 1,
        }));
        this.payerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Gateway Request Rate',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent/Gateway/RateLimiting',
                    metricName: 'TotalRequests',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(1),
                    label: 'Requests/min',
                }),
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
                    label: 'Throttled',
                    color: '#d62728',
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Gateway Logs
        this.payerDashboard.addWidgets(new cloudwatch.LogQueryWidget({
            title: 'Recent Gateway Activity',
            logGroupNames: [gatewayLogGroup],
            queryLines: [
                'fields @timestamp, @message',
                'filter @message like /InvokeAgent|payment|error/i',
                'sort @timestamp desc',
                'limit 50',
            ],
            width: 24,
            height: 8,
        }));
        // =========================================================================
        // Seller Infrastructure Dashboard
        // =========================================================================
        this.sellerDashboard = new cloudwatch.Dashboard(this, 'X402SellerDashboard', {
            dashboardName: 'x402-seller-infrastructure',
        });
        this.sellerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: `# x402 Seller Infrastructure Dashboard
Monitor CloudFront distribution and Lambda@Edge payment verification.`,
            width: 24,
            height: 2,
        }));
        // CloudFront Metrics
        this.sellerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## CloudFront Distribution',
            width: 24,
            height: 1,
        }));
        this.sellerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'CloudFront Requests',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/CloudFront',
                    metricName: 'Requests',
                    dimensionsMap: {
                        DistributionId: cloudfrontDistId,
                        Region: 'Global',
                    },
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Requests',
                }),
            ],
            width: 8,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'CloudFront Error Rate',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/CloudFront',
                    metricName: '4xxErrorRate',
                    dimensionsMap: {
                        DistributionId: cloudfrontDistId,
                        Region: 'Global',
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                    label: '4xx Error Rate',
                    color: '#ff7f0e',
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/CloudFront',
                    metricName: '5xxErrorRate',
                    dimensionsMap: {
                        DistributionId: cloudfrontDistId,
                        Region: 'Global',
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                    label: '5xx Error Rate',
                    color: '#d62728',
                }),
            ],
            width: 8,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Cache Hit Rate',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/CloudFront',
                    metricName: 'CacheHitRate',
                    dimensionsMap: {
                        DistributionId: cloudfrontDistId,
                        Region: 'Global',
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                    label: 'Cache Hit Rate',
                    color: '#2ca02c',
                }),
            ],
            width: 8,
            height: 6,
        }));
        // Lambda@Edge Payment Verifier Metrics
        this.sellerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Payment Verifier (Lambda@Edge)',
            width: 24,
            height: 1,
        }));
        this.sellerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Payment Processing',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentRequired',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: '402 Sent',
                    color: '#ff7f0e',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentReceived',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Received',
                    color: '#1f77b4',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentSettled',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Settled',
                    color: '#2ca02c',
                }),
            ],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Content Delivery',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'ContentGenerated',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Content Generated',
                    color: '#17becf',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'ContentCacheHit',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Cache Hits',
                    color: '#bcbd22',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'S3FetchSuccess',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'S3 Fetches',
                    color: '#9467bd',
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Payment Verification by Network/Asset
        this.sellerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Payment Details by Network',
            width: 24,
            height: 1,
        }));
        this.sellerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Payments by Network (Base Sepolia)',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentSettled',
                    dimensionsMap: {
                        Network: 'eip155:84532',
                    },
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Base Sepolia',
                }),
            ],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Validation Errors by Type',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'ValidationError',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Validation Errors',
                    color: '#d62728',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'AuthorizationExpired',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Auth Expired',
                    color: '#ff7f0e',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'SignatureInvalid',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Invalid Signature',
                    color: '#9467bd',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'AmountInsufficient',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Insufficient Amount',
                    color: '#e377c2',
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Custom Metrics Section - Payment Amounts and Content
        this.sellerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Custom Metrics - Payment Amounts & Content',
            width: 24,
            height: 1,
        }));
        this.sellerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Payment Amounts (Wei)',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentAmountWei',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Wei',
                    color: '#2ca02c',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'PaymentAmountWei',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                    label: 'Avg Wei per Payment',
                    color: '#1f77b4',
                }),
            ],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Content Delivery',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'ContentBytesServed',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Bytes',
                    color: '#17becf',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402/PaymentVerifier',
                    metricName: 'ContentBytesServed',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                    label: 'Avg Bytes per Request',
                    color: '#bcbd22',
                }),
            ],
            width: 12,
            height: 6,
        }));
        // =========================================================================
        // Payer Agent Custom Metrics Dashboard Section
        // =========================================================================
        this.payerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Payer Agent Custom Metrics',
            width: 24,
            height: 1,
        }));
        this.payerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Payment Analysis Decisions',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentAnalysisCount',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Analyses',
                    color: '#1f77b4',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentApproved',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Approved',
                    color: '#2ca02c',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentRejected',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Rejected',
                    color: '#d62728',
                }),
            ],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Payment Signing Operations',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentSigningCount',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Signings',
                    color: '#1f77b4',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentSigningSuccess',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Success',
                    color: '#2ca02c',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentSigningFailure',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Failure',
                    color: '#d62728',
                }),
            ],
            width: 12,
            height: 6,
        }));
        this.payerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Content Request Outcomes',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'ContentRequestCount',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Requests',
                    color: '#1f77b4',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'ContentRequestSuccess',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Success (200)',
                    color: '#2ca02c',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'ContentRequest402',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Payment Required (402)',
                    color: '#ff7f0e',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'ContentRequestError',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Errors',
                    color: '#d62728',
                }),
            ],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Wallet Operations',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'WalletBalanceCheck',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Balance Checks',
                    color: '#1f77b4',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'FaucetRequestSuccess',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Faucet Success',
                    color: '#2ca02c',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'FaucetRequestFailure',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Faucet Failure',
                    color: '#d62728',
                }),
            ],
            width: 12,
            height: 6,
        }));
        // Payer Agent Latency Metrics
        this.payerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Payer Agent Latency Metrics',
            width: 24,
            height: 1,
        }));
        this.payerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Payment Analysis Latency',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentAnalysisLatency',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(1),
                    label: 'Average',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentAnalysisLatency',
                    statistic: 'p99',
                    period: cdk.Duration.minutes(1),
                    label: 'p99',
                }),
            ],
            width: 8,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Payment Signing Latency',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentSigningLatency',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(1),
                    label: 'Average',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentSigningLatency',
                    statistic: 'p99',
                    period: cdk.Duration.minutes(1),
                    label: 'p99',
                }),
            ],
            width: 8,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Content Request Latency',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'ContentRequestLatency',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(1),
                    label: 'Average',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'ContentRequestLatency',
                    statistic: 'p99',
                    period: cdk.Duration.minutes(1),
                    label: 'p99',
                }),
            ],
            width: 8,
            height: 6,
        }));
        // Wallet Balance Tracking
        this.payerDashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: '## Wallet Balance Tracking',
            width: 24,
            height: 1,
        }));
        this.payerDashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Wallet Balance (ETH)',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'WalletBalanceETH',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                    label: 'Balance',
                    color: '#2ca02c',
                }),
            ],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Payment Amounts (ETH)',
            left: [
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentAmountETH',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Total Paid',
                    color: '#ff7f0e',
                }),
                new cloudwatch.Metric({
                    namespace: 'X402PayerAgent',
                    metricName: 'PaymentAmountETH',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                    label: 'Avg per Payment',
                    color: '#1f77b4',
                }),
            ],
            width: 12,
            height: 6,
        }));
        // =========================================================================
        // Outputs
        // =========================================================================
        new cdk.CfnOutput(this, 'MainDashboardUrl', {
            value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=x402-enterprise-demo-overview`,
            description: 'Main Overview Dashboard URL',
            exportName: 'X402MainDashboardUrl',
        });
        new cdk.CfnOutput(this, 'PayerDashboardUrl', {
            value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=x402-payer-agent`,
            description: 'Payer Agent Dashboard URL',
            exportName: 'X402PayerDashboardUrl',
        });
        new cdk.CfnOutput(this, 'SellerDashboardUrl', {
            value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=x402-seller-infrastructure`,
            description: 'Seller Infrastructure Dashboard URL',
            exportName: 'X402SellerDashboardUrl',
        });
        // Alert topic output
        if (this.alertTopic) {
            new cdk.CfnOutput(this, 'AlertTopicArn', {
                value: this.alertTopic.topicArn,
                description: 'SNS Topic ARN for alerts',
                exportName: 'X402AlertTopicArn',
            });
        }
    }
    /**
     * Create CloudWatch alerting rules for the x402 demo.
     *
     * Alerts are organized into categories:
     * - Payment Flow Alerts: Payment failures, verification errors
     * - Performance Alerts: High latency, throttling
     * - Availability Alerts: Error rates, service health
     * - Wallet Alerts: Low balance warnings
     */
    createAlertingRules(cloudfrontDistId) {
        // =========================================================================
        // Payment Flow Alerts
        // =========================================================================
        // Alert: High Payment Failure Rate
        const paymentFailureAlarm = new cloudwatch.Alarm(this, 'PaymentFailureRateAlarm', {
            alarmName: 'x402-high-payment-failure-rate',
            alarmDescription: 'Payment failure rate exceeds 10% over 5 minutes',
            metric: new cloudwatch.MathExpression({
                expression: '100 * failed / (settled + failed + 0.001)',
                usingMetrics: {
                    settled: new cloudwatch.Metric({
                        namespace: 'X402/PaymentVerifier',
                        metricName: 'PaymentSettled',
                        statistic: 'Sum',
                        period: cdk.Duration.minutes(5),
                    }),
                    failed: new cloudwatch.Metric({
                        namespace: 'X402/PaymentVerifier',
                        metricName: 'PaymentFailed',
                        statistic: 'Sum',
                        period: cdk.Duration.minutes(5),
                    }),
                },
                label: 'Payment Failure Rate %',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 10,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(paymentFailureAlarm);
        // Alert: Payment Verification Errors
        const verificationErrorAlarm = new cloudwatch.Alarm(this, 'VerificationErrorAlarm', {
            alarmName: 'x402-payment-verification-errors',
            alarmDescription: 'More than 5 payment verification errors in 5 minutes',
            metric: new cloudwatch.Metric({
                namespace: 'X402/PaymentVerifier',
                metricName: 'ValidationError',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 5,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(verificationErrorAlarm);
        // Alert: Facilitator Errors
        const facilitatorErrorAlarm = new cloudwatch.Alarm(this, 'FacilitatorErrorAlarm', {
            alarmName: 'x402-facilitator-errors',
            alarmDescription: 'Facilitator service errors detected',
            metric: new cloudwatch.Metric({
                namespace: 'X402/PaymentVerifier',
                metricName: 'FacilitatorError',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 3,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(facilitatorErrorAlarm);
        // =========================================================================
        // Performance Alerts
        // =========================================================================
        // Alert: High End-to-End Latency
        const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
            alarmName: 'x402-high-latency',
            alarmDescription: 'P99 latency exceeds 5 seconds',
            metric: new cloudwatch.Metric({
                namespace: 'X402/PaymentVerifier',
                metricName: 'Latency',
                statistic: 'p99',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 5000, // 5 seconds in milliseconds
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(highLatencyAlarm);
        // Alert: Payment Signing Latency
        const signingLatencyAlarm = new cloudwatch.Alarm(this, 'SigningLatencyAlarm', {
            alarmName: 'x402-high-signing-latency',
            alarmDescription: 'Payment signing P99 latency exceeds 3 seconds',
            metric: new cloudwatch.Metric({
                namespace: 'X402PayerAgent',
                metricName: 'PaymentSigningLatency',
                statistic: 'p99',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 3000, // 3 seconds
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(signingLatencyAlarm);
        // Alert: Gateway Throttling
        const throttlingAlarm = new cloudwatch.Alarm(this, 'ThrottlingAlarm', {
            alarmName: 'x402-gateway-throttling',
            alarmDescription: 'Gateway is throttling requests',
            metric: new cloudwatch.Metric({
                namespace: 'X402PayerAgent/Gateway/RateLimiting',
                metricName: 'ThrottledRequests',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 10,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(throttlingAlarm);
        // =========================================================================
        // Availability Alerts
        // =========================================================================
        // Alert: CloudFront 5xx Error Rate
        const cloudfront5xxAlarm = new cloudwatch.Alarm(this, 'CloudFront5xxAlarm', {
            alarmName: 'x402-cloudfront-5xx-errors',
            alarmDescription: 'CloudFront 5xx error rate exceeds 5%',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/CloudFront',
                metricName: '5xxErrorRate',
                dimensionsMap: {
                    DistributionId: cloudfrontDistId,
                    Region: 'Global',
                },
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 5,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(cloudfront5xxAlarm);
        // Alert: Agent Errors
        const agentErrorAlarm = new cloudwatch.Alarm(this, 'AgentErrorAlarm', {
            alarmName: 'x402-agent-errors',
            alarmDescription: 'Payer agent errors detected',
            metric: new cloudwatch.Metric({
                namespace: 'X402PayerAgent',
                metricName: 'AgentErrorCount',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 5,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(agentErrorAlarm);
        // Alert: Content Request Errors
        const contentErrorAlarm = new cloudwatch.Alarm(this, 'ContentErrorAlarm', {
            alarmName: 'x402-content-request-errors',
            alarmDescription: 'High rate of content request errors',
            metric: new cloudwatch.Metric({
                namespace: 'X402PayerAgent',
                metricName: 'ContentRequestError',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 10,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(contentErrorAlarm);
        // =========================================================================
        // Wallet Alerts
        // =========================================================================
        // Alert: Low Wallet Balance
        const lowBalanceAlarm = new cloudwatch.Alarm(this, 'LowWalletBalanceAlarm', {
            alarmName: 'x402-low-wallet-balance',
            alarmDescription: 'Wallet balance is below 0.01 ETH',
            metric: new cloudwatch.Metric({
                namespace: 'X402PayerAgent',
                metricName: 'WalletBalanceETH',
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 0.01,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(lowBalanceAlarm);
        // Alert: Faucet Request Failures
        const faucetFailureAlarm = new cloudwatch.Alarm(this, 'FaucetFailureAlarm', {
            alarmName: 'x402-faucet-failures',
            alarmDescription: 'Faucet requests are failing',
            metric: new cloudwatch.Metric({
                namespace: 'X402PayerAgent',
                metricName: 'FaucetRequestFailure',
                statistic: 'Sum',
                period: cdk.Duration.minutes(15),
            }),
            threshold: 3,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(faucetFailureAlarm);
        // =========================================================================
        // Payment Signing Alerts
        // =========================================================================
        // Alert: Payment Signing Failures
        const signingFailureAlarm = new cloudwatch.Alarm(this, 'SigningFailureAlarm', {
            alarmName: 'x402-signing-failures',
            alarmDescription: 'Payment signing operations are failing',
            metric: new cloudwatch.Metric({
                namespace: 'X402PayerAgent',
                metricName: 'PaymentSigningFailure',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 3,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        this.alarms.push(signingFailureAlarm);
        // =========================================================================
        // Composite Alarm: Overall System Health
        // =========================================================================
        const systemHealthAlarm = new cloudwatch.CompositeAlarm(this, 'SystemHealthAlarm', {
            compositeAlarmName: 'x402-system-health',
            alarmDescription: 'Overall system health - triggers when multiple issues detected',
            alarmRule: cloudwatch.AlarmRule.anyOf(cloudwatch.AlarmRule.fromAlarm(paymentFailureAlarm, cloudwatch.AlarmState.ALARM), cloudwatch.AlarmRule.fromAlarm(cloudfront5xxAlarm, cloudwatch.AlarmState.ALARM), cloudwatch.AlarmRule.fromAlarm(agentErrorAlarm, cloudwatch.AlarmState.ALARM)),
        });
        // =========================================================================
        // Add SNS Actions to All Alarms
        // =========================================================================
        if (this.alertTopic) {
            const snsAction = new cloudwatch_actions.SnsAction(this.alertTopic);
            for (const alarm of this.alarms) {
                alarm.addAlarmAction(snsAction);
                alarm.addOkAction(snsAction);
            }
            systemHealthAlarm.addAlarmAction(snsAction);
            systemHealthAlarm.addOkAction(snsAction);
        }
    }
}
exports.ObservabilityStack = ObservabilityStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJpbGl0eS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9ic2VydmFiaWxpdHktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCx1RkFBeUU7QUFDekUseURBQTJDO0FBdUIzQyxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBTy9DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBK0I7UUFDdkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFIVixXQUFNLEdBQXVCLEVBQUUsQ0FBQztRQUs5QyxNQUFNLGdCQUFnQixHQUFHLEtBQUssRUFBRSx3QkFBd0IsSUFBSSxpQkFBaUIsQ0FBQztRQUM5RSxNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUUsbUJBQW1CLElBQUksaURBQWlELENBQUM7UUFDeEcsTUFBTSxZQUFZLEdBQUcsS0FBSyxFQUFFLFlBQVksS0FBSyxLQUFLLENBQUM7UUFFbkQsNEVBQTRFO1FBQzVFLHVCQUF1QjtRQUN2Qiw0RUFBNEU7UUFDNUUsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7Z0JBQ3RELFNBQVMsRUFBRSw2QkFBNkI7Z0JBQ3hDLFdBQVcsRUFBRSw2QkFBNkI7YUFDM0MsQ0FBQyxDQUFDO1lBRUgscUNBQXFDO1lBQ3JDLElBQUksS0FBSyxFQUFFLFVBQVUsRUFBRSxDQUFDO2dCQUN0QixJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO29CQUNuRCxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVU7b0JBQ3RCLFFBQVEsRUFBRSxHQUFHLENBQUMsb0JBQW9CLENBQUMs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LFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFcEUsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2hDLEtBQUssQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ2hDLEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDL0IsQ0FBQztZQUVELGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM1QyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0MsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXh1Q0QsZ0RBd3VDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hfYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vKipcbiAqIENsb3VkV2F0Y2ggT2JzZXJ2YWJpbGl0eSBTdGFjayBmb3IgeDQwMiBFbnRlcnByaXNlIERlbW9cbiAqIFxuICogVGhpcyBzdGFjayBjcmVhdGVzIGNvbXByZWhlbnNpdmUgZGFzaGJvYXJkcyBmb3IgbW9uaXRvcmluZzpcbiAqIC0gUGF5ZXIgQWdlbnQgKEFnZW50Q29yZSBHYXRld2F5KSBtZXRyaWNzXG4gKiAtIFNlbGxlciBJbmZyYXN0cnVjdHVyZSAoQ2xvdWRGcm9udCArIExhbWJkYUBFZGdlKSBtZXRyaWNzXG4gKiAtIEVuZC10by1lbmQgcGF5bWVudCBmbG93IG1ldHJpY3NcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIE9ic2VydmFiaWxpdHlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiogQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gSUQgZm9yIHNlbGxlciBpbmZyYXN0cnVjdHVyZSAqL1xuICBjbG91ZGZyb250RGlzdHJpYnV0aW9uSWQ/OiBzdHJpbmc7XG4gIC8qKiBHYXRld2F5IGxvZyBncm91cCBuYW1lICovXG4gIGdhdGV3YXlMb2dHcm91cE5hbWU/OiBzdHJpbmc7XG4gIC8qKiBFbWFpbCBhZGRyZXNzIGZvciBhbGVydCBub3RpZmljYXRpb25zIChvcHRpb25hbCkgKi9cbiAgYWxlcnRFbWFpbD86IHN0cmluZztcbiAgLyoqIEVuYWJsZSBhbGVydGluZyBydWxlcyAoZGVmYXVsdDogdHJ1ZSkgKi9cbiAgZW5hYmxlQWxlcnRzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIE9ic2VydmFiaWxpdHlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBtYWluRGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcbiAgcHVibGljIHJlYWRvbmx5IHBheWVyRGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcbiAgcHVibGljIHJlYWRvbmx5IHNlbGxlckRhc2hib2FyZDogY2xvdWR3YXRjaC5EYXNoYm9hcmQ7XG4gIHB1YmxpYyByZWFkb25seSBhbGVydFRvcGljPzogc25zLlRvcGljO1xuICBwdWJsaWMgcmVhZG9ubHkgYWxhcm1zOiBjbG91ZHdhdGNoLkFsYXJtW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IE9ic2VydmFiaWxpdHlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBjbG91ZGZyb250RGlzdElkID0gcHJvcHM/LmNsb3VkZnJvbnREaXN0cmlidXRpb25JZCB8fCAnRElTVFJJQlVUSU9OX0lEJztcbiAgICBjb25zdCBnYXRld2F5TG9nR3JvdXAgPSBwcm9wcz8uZ2F0ZXdheUxvZ0dyb3VwTmFtZSB8fCAnL2F3cy9iZWRyb2NrLWFnZW50Y29yZS9nYXRld2F5L3g0MDItcGF5ZXItYWdlbnQnO1xuICAgIGNvbnN0IGVuYWJsZUFsZXJ0cyA9IHByb3BzPy5lbmFibGVBbGVydHMgIT09IGZhbHNlO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFNOUyBUb3BpYyBmb3IgQWxlcnRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGlmIChlbmFibGVBbGVydHMpIHtcbiAgICAgIHRoaXMuYWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1g0MDJBbGVydFRvcGljJywge1xuICAgICAgICB0b3BpY05hbWU6ICd4NDAyLWVudGVycHJpc2UtZGVtby1hbGVydHMnLFxuICAgICAgICBkaXNwbGF5TmFtZTogJ3g0MDIgRW50ZXJwcmlzZSBEZW1vIEFsZXJ0cycsXG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIGVtYWlsIHN1YnNjcmlwdGlvbiBpZiBwcm92aWRlZFxuICAgICAgaWYgKHByb3BzPy5hbGVydEVtYWlsKSB7XG4gICAgICAgIG5ldyBzbnMuU3Vic2NyaXB0aW9uKHRoaXMsICdBbGVydEVtYWlsU3Vic2NyaXB0aW9uJywge1xuICAgICAgICAgIHRvcGljOiB0aGlzLmFsZXJ0VG9waWMsXG4gICAgICAgICAgcHJvdG9jb2w6IHNucy5TdWJzY3JpcHRpb25Qcm90b2NvbC5FTUFJTCxcbiAgICAgICAgICBlbmRwb2ludDogcHJvcHMuYWxlcnRFbWFpbCxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBhbGVydGluZyBydWxlc1xuICAgICAgdGhpcy5jcmVhdGVBbGVydGluZ1J1bGVzKGNsb3VkZnJvbnREaXN0SWQpO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBNYWluIE92ZXJ2aWV3IERhc2hib2FyZCAtIEVuZC10by1FbmQgUGF5bWVudCBGbG93XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMubWFpbkRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnWDQwMk1haW5EYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAneDQwMi1lbnRlcnByaXNlLWRlbW8tb3ZlcnZpZXcnLFxuICAgIH0pO1xuXG4gICAgLy8gSGVhZGVyXG4gICAgdGhpcy5tYWluRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246IGAjIHg0MDIgRW50ZXJwcmlzZSBEZW1vIC0gT3ZlcnZpZXcgRGFzaGJvYXJkXG5Nb25pdG9yIHRoZSBjb21wbGV0ZSBwYXltZW50IGZsb3cgZnJvbSBwYXllciBhZ2VudCB0byBzZWxsZXIgaW5mcmFzdHJ1Y3R1cmUuXG4gICAgICAgIFxuKipBcmNoaXRlY3R1cmU6KiogUGF5ZXIgQWdlbnQgKEFnZW50Q29yZSkg4oaSIENsb3VkRnJvbnQgKFNlbGxlcikg4oaSIExhbWJkYUBFZGdlIChQYXltZW50IFZlcmlmaWNhdGlvbilgLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogMixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyBLZXkgTWV0cmljcyBTdW1tYXJ5IFJvd1xuICAgIHRoaXMubWFpbkRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guU2luZ2xlVmFsdWVXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1RvdGFsIFJlcXVlc3RzICgyNGgpJyxcbiAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUmVxdWVzdENvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiA2LFxuICAgICAgICBoZWlnaHQ6IDQsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdQYXltZW50cyBTZXR0bGVkICgyNGgpJyxcbiAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNldHRsZWQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDYsXG4gICAgICAgIGhlaWdodDogNCxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guU2luZ2xlVmFsdWVXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1BheW1lbnQgU3VjY2VzcyBSYXRlJyxcbiAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1hdGhFeHByZXNzaW9uKHtcbiAgICAgICAgICAgIGV4cHJlc3Npb246ICcxMDAgKiBzZXR0bGVkIC8gKHNldHRsZWQgKyBmYWlsZWQpJyxcbiAgICAgICAgICAgIHVzaW5nTWV0cmljczoge1xuICAgICAgICAgICAgICBzZXR0bGVkOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNldHRsZWQnLFxuICAgICAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICBmYWlsZWQ6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQYXltZW50RmFpbGVkJyxcbiAgICAgICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsYWJlbDogJ1N1Y2Nlc3MgUmF0ZSAlJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogNixcbiAgICAgICAgaGVpZ2h0OiA0LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQXZnIExhdGVuY3kgKG1zKScsXG4gICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDYsXG4gICAgICAgIGhlaWdodDogNCxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyBQYXltZW50IEZsb3cgU2VjdGlvblxuICAgIHRoaXMubWFpbkRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guVGV4dFdpZGdldCh7XG4gICAgICAgIG1hcmtkb3duOiAnIyMgUGF5bWVudCBGbG93IE1ldHJpY3MnLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogMSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLm1haW5EYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdQYXltZW50IEZsb3cgRnVubmVsJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUmVxdWVzdENvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdUb3RhbCBSZXF1ZXN0cycsXG4gICAgICAgICAgICBjb2xvcjogJyMyY2EwMmMnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFJlcXVpcmVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICc0MDIgUmVzcG9uc2VzJyxcbiAgICAgICAgICAgIGNvbG9yOiAnI2ZmN2YwZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQYXltZW50UmVjZWl2ZWQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ1BheW1lbnRzIFJlY2VpdmVkJyxcbiAgICAgICAgICAgIGNvbG9yOiAnIzFmNzdiNCcsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQYXltZW50VmVyaWZpZWQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ1BheW1lbnRzIFZlcmlmaWVkJyxcbiAgICAgICAgICAgIGNvbG9yOiAnIzk0NjdiZCcsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQYXltZW50U2V0dGxlZCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnUGF5bWVudHMgU2V0dGxlZCcsXG4gICAgICAgICAgICBjb2xvcjogJyMxN2JlY2YnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogOCxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0Vycm9ycyAmIEZhaWx1cmVzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudEZhaWxlZCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnUGF5bWVudCBGYWlsZWQnLFxuICAgICAgICAgICAgY29sb3I6ICcjZDYyNzI4JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1ZhbGlkYXRpb25FcnJvcicsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnVmFsaWRhdGlvbiBFcnJvcnMnLFxuICAgICAgICAgICAgY29sb3I6ICcjZmY5ODk2JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0ZhY2lsaXRhdG9yRXJyb3InLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ0ZhY2lsaXRhdG9yIEVycm9ycycsXG4gICAgICAgICAgICBjb2xvcjogJyNlMzc3YzInLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogOCxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyBMYXRlbmN5IFNlY3Rpb25cbiAgICB0aGlzLm1haW5EYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlRleHRXaWRnZXQoe1xuICAgICAgICBtYXJrZG93bjogJyMjIExhdGVuY3kgTWV0cmljcycsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMubWFpbkRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0VuZC10by1FbmQgTGF0ZW5jeScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgICAgICAgbGFiZWw6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAncDUwJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ3A1MCcsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ3A5MCcsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgICAgICAgbGFiZWw6ICdwOTAnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdwOTknLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIGxhYmVsOiAncDk5JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDgsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1ZlcmlmaWNhdGlvbiBMYXRlbmN5JyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnVmVyaWZpY2F0aW9uTGF0ZW5jeScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnVmVyaWZpY2F0aW9uTGF0ZW5jeScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdwOTknLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIGxhYmVsOiAncDk5JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDgsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1NldHRsZW1lbnQgTGF0ZW5jeScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1NldHRsZW1lbnRMYXRlbmN5JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIGxhYmVsOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdTZXR0bGVtZW50TGF0ZW5jeScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdwOTknLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIGxhYmVsOiAncDk5JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDgsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUGF5ZXIgQWdlbnQgRGFzaGJvYXJkXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMucGF5ZXJEYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ1g0MDJQYXllckRhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6ICd4NDAyLXBheWVyLWFnZW50JyxcbiAgICB9KTtcblxuICAgIHRoaXMucGF5ZXJEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlRleHRXaWRnZXQoe1xuICAgICAgICBtYXJrZG93bjogYCMgeDQwMiBQYXllciBBZ2VudCBEYXNoYm9hcmRcbk1vbml0b3IgdGhlIEFnZW50Q29yZS1iYXNlZCBwYXllciBhZ2VudCB0aGF0IGhhbmRsZXMgcGF5bWVudCBzaWduaW5nIGFuZCBjb250ZW50IHJlcXVlc3RzLmAsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAyLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIEFnZW50Q29yZSBHYXRld2F5IE1ldHJpY3NcbiAgICB0aGlzLnBheWVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBBZ2VudENvcmUgR2F0ZXdheScsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucGF5ZXJEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdHYXRld2F5IFJlcXVlc3QgUmF0ZScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQvR2F0ZXdheS9SYXRlTGltaXRpbmcnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1RvdGFsUmVxdWVzdHMnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ1JlcXVlc3RzL21pbicsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVGhyb3R0bGVkIFJlcXVlc3RzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudC9HYXRld2F5L1JhdGVMaW1pdGluZycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnVGhyb3R0bGVkUmVxdWVzdHMnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ1Rocm90dGxlZCcsXG4gICAgICAgICAgICBjb2xvcjogJyNkNjI3MjgnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyBHYXRld2F5IExvZ3NcbiAgICB0aGlzLnBheWVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5Mb2dRdWVyeVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUmVjZW50IEdhdGV3YXkgQWN0aXZpdHknLFxuICAgICAgICBsb2dHcm91cE5hbWVzOiBbZ2F0ZXdheUxvZ0dyb3VwXSxcbiAgICAgICAgcXVlcnlMaW5lczogW1xuICAgICAgICAgICdmaWVsZHMgQHRpbWVzdGFtcCwgQG1lc3NhZ2UnLFxuICAgICAgICAgICdmaWx0ZXIgQG1lc3NhZ2UgbGlrZSAvSW52b2tlQWdlbnR8cGF5bWVudHxlcnJvci9pJyxcbiAgICAgICAgICAnc29ydCBAdGltZXN0YW1wIGRlc2MnLFxuICAgICAgICAgICdsaW1pdCA1MCcsXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiA4LFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTZWxsZXIgSW5mcmFzdHJ1Y3R1cmUgRGFzaGJvYXJkXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuc2VsbGVyRGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdYNDAyU2VsbGVyRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ3g0MDItc2VsbGVyLWluZnJhc3RydWN0dXJlJyxcbiAgICB9KTtcblxuICAgIHRoaXMuc2VsbGVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246IGAjIHg0MDIgU2VsbGVyIEluZnJhc3RydWN0dXJlIERhc2hib2FyZFxuTW9uaXRvciBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBhbmQgTGFtYmRhQEVkZ2UgcGF5bWVudCB2ZXJpZmljYXRpb24uYCxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDIsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBNZXRyaWNzXG4gICAgdGhpcy5zZWxsZXJEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlRleHRXaWRnZXQoe1xuICAgICAgICBtYXJrZG93bjogJyMjIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uJyxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgdGhpcy5zZWxsZXJEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdDbG91ZEZyb250IFJlcXVlc3RzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ2xvdWRGcm9udCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUmVxdWVzdHMnLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBEaXN0cmlidXRpb25JZDogY2xvdWRmcm9udERpc3RJZCxcbiAgICAgICAgICAgICAgUmVnaW9uOiAnR2xvYmFsJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnVG90YWwgUmVxdWVzdHMnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogOCxcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQ2xvdWRGcm9udCBFcnJvciBSYXRlJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ2xvdWRGcm9udCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnNHh4RXJyb3JSYXRlJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgRGlzdHJpYnV0aW9uSWQ6IGNsb3VkZnJvbnREaXN0SWQsXG4gICAgICAgICAgICAgIFJlZ2lvbjogJ0dsb2JhbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICc0eHggRXJyb3IgUmF0ZScsXG4gICAgICAgICAgICBjb2xvcjogJyNmZjdmMGUnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ2xvdWRGcm9udCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnNXh4RXJyb3JSYXRlJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgRGlzdHJpYnV0aW9uSWQ6IGNsb3VkZnJvbnREaXN0SWQsXG4gICAgICAgICAgICAgIFJlZ2lvbjogJ0dsb2JhbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICc1eHggRXJyb3IgUmF0ZScsXG4gICAgICAgICAgICBjb2xvcjogJyNkNjI3MjgnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogOCxcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQ2FjaGUgSGl0IFJhdGUnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9DbG91ZEZyb250JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdDYWNoZUhpdFJhdGUnLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBEaXN0cmlidXRpb25JZDogY2xvdWRmcm9udERpc3RJZCxcbiAgICAgICAgICAgICAgUmVnaW9uOiAnR2xvYmFsJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ0NhY2hlIEhpdCBSYXRlJyxcbiAgICAgICAgICAgIGNvbG9yOiAnIzJjYTAyYycsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiA4LFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gTGFtYmRhQEVkZ2UgUGF5bWVudCBWZXJpZmllciBNZXRyaWNzXG4gICAgdGhpcy5zZWxsZXJEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlRleHRXaWRnZXQoe1xuICAgICAgICBtYXJrZG93bjogJyMjIFBheW1lbnQgVmVyaWZpZXIgKExhbWJkYUBFZGdlKScsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMuc2VsbGVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUGF5bWVudCBQcm9jZXNzaW5nJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFJlcXVpcmVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICc0MDIgU2VudCcsXG4gICAgICAgICAgICBjb2xvcjogJyNmZjdmMGUnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFJlY2VpdmVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdSZWNlaXZlZCcsXG4gICAgICAgICAgICBjb2xvcjogJyMxZjc3YjQnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNldHRsZWQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ1NldHRsZWQnLFxuICAgICAgICAgICAgY29sb3I6ICcjMmNhMDJjJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdDb250ZW50IERlbGl2ZXJ5JyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQ29udGVudEdlbmVyYXRlZCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnQ29udGVudCBHZW5lcmF0ZWQnLFxuICAgICAgICAgICAgY29sb3I6ICcjMTdiZWNmJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0NvbnRlbnRDYWNoZUhpdCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnQ2FjaGUgSGl0cycsXG4gICAgICAgICAgICBjb2xvcjogJyNiY2JkMjInLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUzNGZXRjaFN1Y2Nlc3MnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ1MzIEZldGNoZXMnLFxuICAgICAgICAgICAgY29sb3I6ICcjOTQ2N2JkJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gUGF5bWVudCBWZXJpZmljYXRpb24gYnkgTmV0d29yay9Bc3NldFxuICAgIHRoaXMuc2VsbGVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBQYXltZW50IERldGFpbHMgYnkgTmV0d29yaycsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMuc2VsbGVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUGF5bWVudHMgYnkgTmV0d29yayAoQmFzZSBTZXBvbGlhKScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1BheW1lbnRTZXR0bGVkJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgTmV0d29yazogJ2VpcDE1NTo4NDUzMicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ0Jhc2UgU2Vwb2xpYScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVmFsaWRhdGlvbiBFcnJvcnMgYnkgVHlwZScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1ZhbGlkYXRpb25FcnJvcicsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnVmFsaWRhdGlvbiBFcnJvcnMnLFxuICAgICAgICAgICAgY29sb3I6ICcjZDYyNzI4JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0F1dGhvcml6YXRpb25FeHBpcmVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdBdXRoIEV4cGlyZWQnLFxuICAgICAgICAgICAgY29sb3I6ICcjZmY3ZjBlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1NpZ25hdHVyZUludmFsaWQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ0ludmFsaWQgU2lnbmF0dXJlJyxcbiAgICAgICAgICAgIGNvbG9yOiAnIzk0NjdiZCcsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdBbW91bnRJbnN1ZmZpY2llbnQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ0luc3VmZmljaWVudCBBbW91bnQnLFxuICAgICAgICAgICAgY29sb3I6ICcjZTM3N2MyJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gQ3VzdG9tIE1ldHJpY3MgU2VjdGlvbiAtIFBheW1lbnQgQW1vdW50cyBhbmQgQ29udGVudFxuICAgIHRoaXMuc2VsbGVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBDdXN0b20gTWV0cmljcyAtIFBheW1lbnQgQW1vdW50cyAmIENvbnRlbnQnLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogMSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnNlbGxlckRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1BheW1lbnQgQW1vdW50cyAoV2VpKScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1BheW1lbnRBbW91bnRXZWknLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ1RvdGFsIFdlaScsXG4gICAgICAgICAgICBjb2xvcjogJyMyY2EwMmMnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudEFtb3VudFdlaScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ0F2ZyBXZWkgcGVyIFBheW1lbnQnLFxuICAgICAgICAgICAgY29sb3I6ICcjMWY3N2I0JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdDb250ZW50IERlbGl2ZXJ5JyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQ29udGVudEJ5dGVzU2VydmVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdUb3RhbCBCeXRlcycsXG4gICAgICAgICAgICBjb2xvcjogJyMxN2JlY2YnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQ29udGVudEJ5dGVzU2VydmVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnQXZnIEJ5dGVzIHBlciBSZXF1ZXN0JyxcbiAgICAgICAgICAgIGNvbG9yOiAnI2JjYmQyMicsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBQYXllciBBZ2VudCBDdXN0b20gTWV0cmljcyBEYXNoYm9hcmQgU2VjdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLnBheWVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBQYXllciBBZ2VudCBDdXN0b20gTWV0cmljcycsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucGF5ZXJEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdQYXltZW50IEFuYWx5c2lzIERlY2lzaW9ucycsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1BheW1lbnRBbmFseXNpc0NvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdUb3RhbCBBbmFseXNlcycsXG4gICAgICAgICAgICBjb2xvcjogJyMxZjc3YjQnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudEFwcHJvdmVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdBcHByb3ZlZCcsXG4gICAgICAgICAgICBjb2xvcjogJyMyY2EwMmMnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFJlamVjdGVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdSZWplY3RlZCcsXG4gICAgICAgICAgICBjb2xvcjogJyNkNjI3MjgnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1BheW1lbnQgU2lnbmluZyBPcGVyYXRpb25zJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNpZ25pbmdDb3VudCcsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnVG90YWwgU2lnbmluZ3MnLFxuICAgICAgICAgICAgY29sb3I6ICcjMWY3N2I0JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1BheW1lbnRTaWduaW5nU3VjY2VzcycsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnU3VjY2VzcycsXG4gICAgICAgICAgICBjb2xvcjogJyMyY2EwMmMnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNpZ25pbmdGYWlsdXJlJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdGYWlsdXJlJyxcbiAgICAgICAgICAgIGNvbG9yOiAnI2Q2MjcyOCcsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucGF5ZXJEYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdDb250ZW50IFJlcXVlc3QgT3V0Y29tZXMnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdDb250ZW50UmVxdWVzdENvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdUb3RhbCBSZXF1ZXN0cycsXG4gICAgICAgICAgICBjb2xvcjogJyMxZjc3YjQnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQ29udGVudFJlcXVlc3RTdWNjZXNzJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdTdWNjZXNzICgyMDApJyxcbiAgICAgICAgICAgIGNvbG9yOiAnIzJjYTAyYycsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdDb250ZW50UmVxdWVzdDQwMicsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnUGF5bWVudCBSZXF1aXJlZCAoNDAyKScsXG4gICAgICAgICAgICBjb2xvcjogJyNmZjdmMGUnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQ29udGVudFJlcXVlc3RFcnJvcicsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnRXJyb3JzJyxcbiAgICAgICAgICAgIGNvbG9yOiAnI2Q2MjcyOCcsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnV2FsbGV0IE9wZXJhdGlvbnMnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdXYWxsZXRCYWxhbmNlQ2hlY2snLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ0JhbGFuY2UgQ2hlY2tzJyxcbiAgICAgICAgICAgIGNvbG9yOiAnIzFmNzdiNCcsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdGYXVjZXRSZXF1ZXN0U3VjY2VzcycsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnRmF1Y2V0IFN1Y2Nlc3MnLFxuICAgICAgICAgICAgY29sb3I6ICcjMmNhMDJjJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0ZhdWNldFJlcXVlc3RGYWlsdXJlJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdGYXVjZXQgRmFpbHVyZScsXG4gICAgICAgICAgICBjb2xvcjogJyNkNjI3MjgnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyBQYXllciBBZ2VudCBMYXRlbmN5IE1ldHJpY3NcbiAgICB0aGlzLnBheWVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBQYXllciBBZ2VudCBMYXRlbmN5IE1ldHJpY3MnLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogMSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnBheWVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUGF5bWVudCBBbmFseXNpcyBMYXRlbmN5JyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudEFuYWx5c2lzTGF0ZW5jeScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudEFuYWx5c2lzTGF0ZW5jeScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdwOTknLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIGxhYmVsOiAncDk5JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDgsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1BheW1lbnQgU2lnbmluZyBMYXRlbmN5JyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNpZ25pbmdMYXRlbmN5JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICAgIGxhYmVsOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQYXltZW50U2lnbmluZ0xhdGVuY3knLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAncDk5JyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ3A5OScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiA4LFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdDb250ZW50IFJlcXVlc3QgTGF0ZW5jeScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0NvbnRlbnRSZXF1ZXN0TGF0ZW5jeScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgICBsYWJlbDogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQ29udGVudFJlcXVlc3RMYXRlbmN5JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ3A5OScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgICAgICAgbGFiZWw6ICdwOTknLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogOCxcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIFdhbGxldCBCYWxhbmNlIFRyYWNraW5nXG4gICAgdGhpcy5wYXllckRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guVGV4dFdpZGdldCh7XG4gICAgICAgIG1hcmtkb3duOiAnIyMgV2FsbGV0IEJhbGFuY2UgVHJhY2tpbmcnLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogMSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnBheWVyRGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnV2FsbGV0IEJhbGFuY2UgKEVUSCknLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdXYWxsZXRCYWxhbmNlRVRIJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIGxhYmVsOiAnQmFsYW5jZScsXG4gICAgICAgICAgICBjb2xvcjogJyMyY2EwMmMnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1BheW1lbnQgQW1vdW50cyAoRVRIKScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1BheW1lbnRBbW91bnRFVEgnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ1RvdGFsIFBhaWQnLFxuICAgICAgICAgICAgY29sb3I6ICcjZmY3ZjBlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1BheW1lbnRBbW91bnRFVEgnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdBdmcgcGVyIFBheW1lbnQnLFxuICAgICAgICAgICAgY29sb3I6ICcjMWY3N2I0JyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE91dHB1dHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ01haW5EYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT14NDAyLWVudGVycHJpc2UtZGVtby1vdmVydmlld2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ01haW4gT3ZlcnZpZXcgRGFzaGJvYXJkIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMk1haW5EYXNoYm9hcmRVcmwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BheWVyRGFzaGJvYXJkVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5yZWdpb259LmNvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9eDQwMi1wYXllci1hZ2VudGAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BheWVyIEFnZW50IERhc2hib2FyZCBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJQYXllckRhc2hib2FyZFVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VsbGVyRGFzaGJvYXJkVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5yZWdpb259LmNvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9eDQwMi1zZWxsZXItaW5mcmFzdHJ1Y3R1cmVgLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWxsZXIgSW5mcmFzdHJ1Y3R1cmUgRGFzaGJvYXJkIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlNlbGxlckRhc2hib2FyZFVybCcsXG4gICAgfSk7XG5cbiAgICAvLyBBbGVydCB0b3BpYyBvdXRwdXRcbiAgICBpZiAodGhpcy5hbGVydFRvcGljKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxlcnRUb3BpY0FybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdTTlMgVG9waWMgQVJOIGZvciBhbGVydHMnLFxuICAgICAgICBleHBvcnROYW1lOiAnWDQwMkFsZXJ0VG9waWNBcm4nLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBDbG91ZFdhdGNoIGFsZXJ0aW5nIHJ1bGVzIGZvciB0aGUgeDQwMiBkZW1vLlxuICAgKiBcbiAgICogQWxlcnRzIGFyZSBvcmdhbml6ZWQgaW50byBjYXRlZ29yaWVzOlxuICAgKiAtIFBheW1lbnQgRmxvdyBBbGVydHM6IFBheW1lbnQgZmFpbHVyZXMsIHZlcmlmaWNhdGlvbiBlcnJvcnNcbiAgICogLSBQZXJmb3JtYW5jZSBBbGVydHM6IEhpZ2ggbGF0ZW5jeSwgdGhyb3R0bGluZ1xuICAgKiAtIEF2YWlsYWJpbGl0eSBBbGVydHM6IEVycm9yIHJhdGVzLCBzZXJ2aWNlIGhlYWx0aFxuICAgKiAtIFdhbGxldCBBbGVydHM6IExvdyBiYWxhbmNlIHdhcm5pbmdzXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFsZXJ0aW5nUnVsZXMoY2xvdWRmcm9udERpc3RJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFBheW1lbnQgRmxvdyBBbGVydHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBBbGVydDogSGlnaCBQYXltZW50IEZhaWx1cmUgUmF0ZVxuICAgIGNvbnN0IHBheW1lbnRGYWlsdXJlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnUGF5bWVudEZhaWx1cmVSYXRlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICd4NDAyLWhpZ2gtcGF5bWVudC1mYWlsdXJlLXJhdGUnLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ1BheW1lbnQgZmFpbHVyZSByYXRlIGV4Y2VlZHMgMTAlIG92ZXIgNSBtaW51dGVzJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWF0aEV4cHJlc3Npb24oe1xuICAgICAgICBleHByZXNzaW9uOiAnMTAwICogZmFpbGVkIC8gKHNldHRsZWQgKyBmYWlsZWQgKyAwLjAwMSknLFxuICAgICAgICB1c2luZ01ldHJpY3M6IHtcbiAgICAgICAgICBzZXR0bGVkOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1BheW1lbnRTZXR0bGVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGZhaWxlZDogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ1g0MDIvUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQYXltZW50RmFpbGVkJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICBsYWJlbDogJ1BheW1lbnQgRmFpbHVyZSBSYXRlICUnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICB0aGlzLmFsYXJtcy5wdXNoKHBheW1lbnRGYWlsdXJlQWxhcm0pO1xuXG4gICAgLy8gQWxlcnQ6IFBheW1lbnQgVmVyaWZpY2F0aW9uIEVycm9yc1xuICAgIGNvbnN0IHZlcmlmaWNhdGlvbkVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnVmVyaWZpY2F0aW9uRXJyb3JBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ3g0MDItcGF5bWVudC12ZXJpZmljYXRpb24tZXJyb3JzJyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdNb3JlIHRoYW4gNSBwYXltZW50IHZlcmlmaWNhdGlvbiBlcnJvcnMgaW4gNSBtaW51dGVzJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICBtZXRyaWNOYW1lOiAnVmFsaWRhdGlvbkVycm9yJyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICB0aGlzLmFsYXJtcy5wdXNoKHZlcmlmaWNhdGlvbkVycm9yQWxhcm0pO1xuXG4gICAgLy8gQWxlcnQ6IEZhY2lsaXRhdG9yIEVycm9yc1xuICAgIGNvbnN0IGZhY2lsaXRhdG9yRXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdGYWNpbGl0YXRvckVycm9yQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICd4NDAyLWZhY2lsaXRhdG9yLWVycm9ycycsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnRmFjaWxpdGF0b3Igc2VydmljZSBlcnJvcnMgZGV0ZWN0ZWQnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdYNDAyL1BheW1lbnRWZXJpZmllcicsXG4gICAgICAgIG1ldHJpY05hbWU6ICdGYWNpbGl0YXRvckVycm9yJyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAzLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICB0aGlzLmFsYXJtcy5wdXNoKGZhY2lsaXRhdG9yRXJyb3JBbGFybSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUGVyZm9ybWFuY2UgQWxlcnRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gQWxlcnQ6IEhpZ2ggRW5kLXRvLUVuZCBMYXRlbmN5XG4gICAgY29uc3QgaGlnaExhdGVuY3lBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoTGF0ZW5jeUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAneDQwMi1oaWdoLWxhdGVuY3knLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ1A5OSBsYXRlbmN5IGV4Y2VlZHMgNSBzZWNvbmRzJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5OScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNTAwMCwgLy8gNSBzZWNvbmRzIGluIG1pbGxpc2Vjb25kc1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICB0aGlzLmFsYXJtcy5wdXNoKGhpZ2hMYXRlbmN5QWxhcm0pO1xuXG4gICAgLy8gQWxlcnQ6IFBheW1lbnQgU2lnbmluZyBMYXRlbmN5XG4gICAgY29uc3Qgc2lnbmluZ0xhdGVuY3lBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdTaWduaW5nTGF0ZW5jeUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAneDQwMi1oaWdoLXNpZ25pbmctbGF0ZW5jeScsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnUGF5bWVudCBzaWduaW5nIFA5OSBsYXRlbmN5IGV4Y2VlZHMgMyBzZWNvbmRzJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNpZ25pbmdMYXRlbmN5JyxcbiAgICAgICAgc3RhdGlzdGljOiAncDk5JyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAzMDAwLCAvLyAzIHNlY29uZHNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG4gICAgdGhpcy5hbGFybXMucHVzaChzaWduaW5nTGF0ZW5jeUFsYXJtKTtcblxuICAgIC8vIEFsZXJ0OiBHYXRld2F5IFRocm90dGxpbmdcbiAgICBjb25zdCB0aHJvdHRsaW5nQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnVGhyb3R0bGluZ0FsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAneDQwMi1nYXRld2F5LXRocm90dGxpbmcnLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0dhdGV3YXkgaXMgdGhyb3R0bGluZyByZXF1ZXN0cycsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50L0dhdGV3YXkvUmF0ZUxpbWl0aW5nJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1Rocm90dGxlZFJlcXVlc3RzJyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG4gICAgdGhpcy5hbGFybXMucHVzaCh0aHJvdHRsaW5nQWxhcm0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEF2YWlsYWJpbGl0eSBBbGVydHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBBbGVydDogQ2xvdWRGcm9udCA1eHggRXJyb3IgUmF0ZVxuICAgIGNvbnN0IGNsb3VkZnJvbnQ1eHhBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdDbG91ZEZyb250NXh4QWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICd4NDAyLWNsb3VkZnJvbnQtNXh4LWVycm9ycycsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCA1eHggZXJyb3IgcmF0ZSBleGNlZWRzIDUlJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0Nsb3VkRnJvbnQnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNXh4RXJyb3JSYXRlJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIERpc3RyaWJ1dGlvbklkOiBjbG91ZGZyb250RGlzdElkLFxuICAgICAgICAgIFJlZ2lvbjogJ0dsb2JhbCcsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuICAgIHRoaXMuYWxhcm1zLnB1c2goY2xvdWRmcm9udDV4eEFsYXJtKTtcblxuICAgIC8vIEFsZXJ0OiBBZ2VudCBFcnJvcnNcbiAgICBjb25zdCBhZ2VudEVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQWdlbnRFcnJvckFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAneDQwMi1hZ2VudC1lcnJvcnMnLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ1BheWVyIGFnZW50IGVycm9ycyBkZXRlY3RlZCcsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ1g0MDJQYXllckFnZW50JyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0FnZW50RXJyb3JDb3VudCcsXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG4gICAgdGhpcy5hbGFybXMucHVzaChhZ2VudEVycm9yQWxhcm0pO1xuXG4gICAgLy8gQWxlcnQ6IENvbnRlbnQgUmVxdWVzdCBFcnJvcnNcbiAgICBjb25zdCBjb250ZW50RXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdDb250ZW50RXJyb3JBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ3g0MDItY29udGVudC1yZXF1ZXN0LWVycm9ycycsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCByYXRlIG9mIGNvbnRlbnQgcmVxdWVzdCBlcnJvcnMnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdYNDAyUGF5ZXJBZ2VudCcsXG4gICAgICAgIG1ldHJpY05hbWU6ICdDb250ZW50UmVxdWVzdEVycm9yJyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG4gICAgdGhpcy5hbGFybXMucHVzaChjb250ZW50RXJyb3JBbGFybSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gV2FsbGV0IEFsZXJ0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIEFsZXJ0OiBMb3cgV2FsbGV0IEJhbGFuY2VcbiAgICBjb25zdCBsb3dCYWxhbmNlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnTG93V2FsbGV0QmFsYW5jZUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAneDQwMi1sb3ctd2FsbGV0LWJhbGFuY2UnLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ1dhbGxldCBiYWxhbmNlIGlzIGJlbG93IDAuMDEgRVRIJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnV2FsbGV0QmFsYW5jZUVUSCcsXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDAuMDEsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuTEVTU19USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuICAgIHRoaXMuYWxhcm1zLnB1c2gobG93QmFsYW5jZUFsYXJtKTtcblxuICAgIC8vIEFsZXJ0OiBGYXVjZXQgUmVxdWVzdCBGYWlsdXJlc1xuICAgIGNvbnN0IGZhdWNldEZhaWx1cmVBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdGYXVjZXRGYWlsdXJlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICd4NDAyLWZhdWNldC1mYWlsdXJlcycsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnRmF1Y2V0IHJlcXVlc3RzIGFyZSBmYWlsaW5nJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRmF1Y2V0UmVxdWVzdEZhaWx1cmUnLFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAzLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICB0aGlzLmFsYXJtcy5wdXNoKGZhdWNldEZhaWx1cmVBbGFybSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUGF5bWVudCBTaWduaW5nIEFsZXJ0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIEFsZXJ0OiBQYXltZW50IFNpZ25pbmcgRmFpbHVyZXNcbiAgICBjb25zdCBzaWduaW5nRmFpbHVyZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1NpZ25pbmdGYWlsdXJlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICd4NDAyLXNpZ25pbmctZmFpbHVyZXMnLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ1BheW1lbnQgc2lnbmluZyBvcGVyYXRpb25zIGFyZSBmYWlsaW5nJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnWDQwMlBheWVyQWdlbnQnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnUGF5bWVudFNpZ25pbmdGYWlsdXJlJyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAzLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcbiAgICB0aGlzLmFsYXJtcy5wdXNoKHNpZ25pbmdGYWlsdXJlQWxhcm0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENvbXBvc2l0ZSBBbGFybTogT3ZlcmFsbCBTeXN0ZW0gSGVhbHRoXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHN5c3RlbUhlYWx0aEFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQ29tcG9zaXRlQWxhcm0odGhpcywgJ1N5c3RlbUhlYWx0aEFsYXJtJywge1xuICAgICAgY29tcG9zaXRlQWxhcm1OYW1lOiAneDQwMi1zeXN0ZW0taGVhbHRoJyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdPdmVyYWxsIHN5c3RlbSBoZWFsdGggLSB0cmlnZ2VycyB3aGVuIG11bHRpcGxlIGlzc3VlcyBkZXRlY3RlZCcsXG4gICAgICBhbGFybVJ1bGU6IGNsb3Vkd2F0Y2guQWxhcm1SdWxlLmFueU9mKFxuICAgICAgICBjbG91ZHdhdGNoLkFsYXJtUnVsZS5mcm9tQWxhcm0ocGF5bWVudEZhaWx1cmVBbGFybSwgY2xvdWR3YXRjaC5BbGFybVN0YXRlLkFMQVJNKSxcbiAgICAgICAgY2xvdWR3YXRjaC5BbGFybVJ1bGUuZnJvbUFsYXJtKGNsb3VkZnJvbnQ1eHhBbGFybSwgY2xvdWR3YXRjaC5BbGFybVN0YXRlLkFMQVJNKSxcbiAgICAgICAgY2xvdWR3YXRjaC5BbGFybVJ1bGUuZnJvbUFsYXJtKGFnZW50RXJyb3JBbGFybSwgY2xvdWR3YXRjaC5BbGFybVN0YXRlLkFMQVJNKSxcbiAgICAgICksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQWRkIFNOUyBBY3Rpb25zIHRvIEFsbCBBbGFybXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgaWYgKHRoaXMuYWxlcnRUb3BpYykge1xuICAgICAgY29uc3Qgc25zQWN0aW9uID0gbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBhbGFybSBvZiB0aGlzLmFsYXJtcykge1xuICAgICAgICBhbGFybS5hZGRBbGFybUFjdGlvbihzbnNBY3Rpb24pO1xuICAgICAgICBhbGFybS5hZGRPa0FjdGlvbihzbnNBY3Rpb24pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzeXN0ZW1IZWFsdGhBbGFybS5hZGRBbGFybUFjdGlvbihzbnNBY3Rpb24pO1xuICAgICAgc3lzdGVtSGVhbHRoQWxhcm0uYWRkT2tBY3Rpb24oc25zQWN0aW9uKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==