#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { AgentCoreStack } from '../lib/agentcore-stack';
import { ObservabilityStack } from '../lib/observability-stack';

const app = new cdk.App();

// Main AgentCore infrastructure stack
const agentCoreStack = new AgentCoreStack(app, 'X402PayerAgentStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
  description: 'x402 Payer Agent - Bedrock AgentCore infrastructure',
});

cdk.Aspects.of(agentCoreStack).add(new AwsSolutionsChecks());

// Observability stack with CloudWatch dashboards
new ObservabilityStack(app, 'X402ObservabilityStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
  description: 'x402 Enterprise Demo - CloudWatch Observability Dashboards',
  // These can be overridden via context or environment variables
  cloudfrontDistributionId: app.node.tryGetContext('cloudfrontDistributionId'),
  gatewayLogGroupName: app.node.tryGetContext('gatewayLogGroupName'),
});

app.synth();
