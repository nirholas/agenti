import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

/**
 * CloudWatch Observability Stack for x402 Enterprise Demo
 * 
 * This stack creates comprehensive dashboards for monitoring:
 * - Payer Agent (AgentCore Gateway) metrics
 * - Seller Infrastructure (CloudFront + Lambda@Edge) metrics
 * - End-to-end payment flow metrics
 */

export interface ObservabilityStackProps extends cdk.StackProps {
  /** CloudFront distribution ID for seller infrastructure */
  cloudfrontDistributionId?: string;
  /** Gateway log group name */
  gatewayLogGroupName?: string;
  /** Email address for alert notifications (optional) */
  alertEmail?: string;
  /** Enable alerting rules (default: true) */
  enableAlerts?: boolean;
}

export class ObservabilityStack extends cdk.Stack {
  public readonly mainDashboard: cloudwatch.Dashboard;
  public readonly payerDashboard: cloudwatch.Dashboard;
  public readonly sellerDashboard: cloudwatch.Dashboard;
  public readonly alertTopic?: sns.Topic;
  public readonly alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props?: ObservabilityStackProps) {
    super(scope, id, props);

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
    this.mainDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# x402 Enterprise Demo - Overview Dashboard
Monitor the complete payment flow from payer agent to seller infrastructure.
        
**Architecture:** Payer Agent (AgentCore) → CloudFront (Seller) → Lambda@Edge (Payment Verification)`,
        width: 24,
        height: 2,
      }),
    );

    // Key Metrics Summary Row
    this.mainDashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
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
      }),
      new cloudwatch.SingleValueWidget({
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
      }),
      new cloudwatch.SingleValueWidget({
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
      }),
      new cloudwatch.SingleValueWidget({
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
      }),
    );

    // Payment Flow Section
    this.mainDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Payment Flow Metrics',
        width: 24,
        height: 1,
      }),
    );

    this.mainDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // Latency Section
    this.mainDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Latency Metrics',
        width: 24,
        height: 1,
      }),
    );

    this.mainDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // =========================================================================
    // Payer Agent Dashboard
    // =========================================================================
    this.payerDashboard = new cloudwatch.Dashboard(this, 'X402PayerDashboard', {
      dashboardName: 'x402-payer-agent',
    });

    this.payerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# x402 Payer Agent Dashboard
Monitor the AgentCore-based payer agent that handles payment signing and content requests.`,
        width: 24,
        height: 2,
      }),
    );

    // AgentCore Gateway Metrics
    this.payerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## AgentCore Gateway',
        width: 24,
        height: 1,
      }),
    );

    this.payerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // Gateway Logs
    this.payerDashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
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
      }),
    );

    // =========================================================================
    // Seller Infrastructure Dashboard
    // =========================================================================
    this.sellerDashboard = new cloudwatch.Dashboard(this, 'X402SellerDashboard', {
      dashboardName: 'x402-seller-infrastructure',
    });

    this.sellerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# x402 Seller Infrastructure Dashboard
Monitor CloudFront distribution and Lambda@Edge payment verification.`,
        width: 24,
        height: 2,
      }),
    );

    // CloudFront Metrics
    this.sellerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## CloudFront Distribution',
        width: 24,
        height: 1,
      }),
    );

    this.sellerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // Lambda@Edge Payment Verifier Metrics
    this.sellerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Payment Verifier (Lambda@Edge)',
        width: 24,
        height: 1,
      }),
    );

    this.sellerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // Payment Verification by Network/Asset
    this.sellerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Payment Details by Network',
        width: 24,
        height: 1,
      }),
    );

    this.sellerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // Custom Metrics Section - Payment Amounts and Content
    this.sellerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Custom Metrics - Payment Amounts & Content',
        width: 24,
        height: 1,
      }),
    );

    this.sellerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // =========================================================================
    // Payer Agent Custom Metrics Dashboard Section
    // =========================================================================
    this.payerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Payer Agent Custom Metrics',
        width: 24,
        height: 1,
      }),
    );

    this.payerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    this.payerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // Payer Agent Latency Metrics
    this.payerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Payer Agent Latency Metrics',
        width: 24,
        height: 1,
      }),
    );

    this.payerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

    // Wallet Balance Tracking
    this.payerDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Wallet Balance Tracking',
        width: 24,
        height: 1,
      }),
    );

    this.payerDashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      }),
      new cloudwatch.GraphWidget({
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
      }),
    );

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
  private createAlertingRules(cloudfrontDistId: string): void {
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
      alarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(paymentFailureAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(cloudfront5xxAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(agentErrorAlarm, cloudwatch.AlarmState.ALARM),
      ),
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
