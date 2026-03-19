#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { X402SellerStack } from '../lib/cloudfront-stack';

const app = new cdk.App();
cdk.Aspects.of(app).add(new AwsSolutionsChecks());

new X402SellerStack(app, 'X402SellerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // Lambda@Edge must be deployed to us-east-1
  },
  description: 'x402 Seller Infrastructure with CloudFront and Lambda@Edge',
});

app.synth();
