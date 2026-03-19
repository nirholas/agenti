import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export class X402SellerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Write deploy-config.json into lambda-edge/ so it gets bundled
    const lambdaEdgeDir = path.join(__dirname, 'lambda-edge');
    const deployConfig: Record<string, string> = {};
    if (process.env.PAYMENT_RECIPIENT_ADDRESS) {
      deployConfig.payTo = process.env.PAYMENT_RECIPIENT_ADDRESS;
    }
    fs.writeFileSync(
      path.join(lambdaEdgeDir, 'deploy-config.json'),
      JSON.stringify(deployConfig, null, 2)
    );

    // Unique suffix for policy names to avoid conflicts on redeploy
    const suffix = cdk.Names.uniqueId(this).slice(-8);

    // Create S3 bucket for static content (optional)
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // Create Lambda@Edge function for payment verification
    const paymentVerifier = new cloudfront.experimental.EdgeFunction(
      this,
      'PaymentVerifier',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'payment-verifier.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-edge')),
        memorySize: 128,
        timeout: cdk.Duration.seconds(20),
        // Note: Lambda@Edge doesn't support environment variables directly
        // The bucket name is configured in content-config.ts via CONTENT_BUCKET env var
        // which must be set at build time or use the default bucket name
      }
    );

    // Grant Lambda@Edge permission to read from the content bucket
    contentBucket.grantRead(paymentVerifier);

    // =========================================================================
    // Caching Policies
    // =========================================================================

    // Cache policy for payment-protected API endpoints
    // Disabled - each request requires unique payment verification
    const paymentApiCachePolicy = new cloudfront.CachePolicy(
      this,
      'PaymentApiCachePolicy',
      {
        cachePolicyName: `X402-PaymentApi-NoCache-${suffix}`,
        comment: 'No caching for x402 payment-protected endpoints',
        defaultTtl: cdk.Duration.seconds(0),
        minTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.seconds(0),
        // Note: headerBehavior cannot be set when caching is disabled (TTL=0)
        // Payment headers are forwarded via the origin request policy instead
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      }
    );

    // Cache policy for static assets (images, CSS, JS, fonts)
    // These don't require payment and can be cached aggressively
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(
      this,
      'StaticAssetsCachePolicy',
      {
        cachePolicyName: `X402-StaticAssets-LongCache-${suffix}`,
        comment: 'Long-term caching for static assets that do not require payment',
        defaultTtl: cdk.Duration.days(1),
        minTtl: cdk.Duration.seconds(1),
        maxTtl: cdk.Duration.days(365),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      }
    );

    // Cache policy for public content (non-payment-protected pages)
    // Short TTL to balance freshness with performance
    const publicContentCachePolicy = new cloudfront.CachePolicy(
      this,
      'PublicContentCachePolicy',
      {
        cachePolicyName: `X402-PublicContent-ShortCache-${suffix}`,
        comment: 'Short-term caching for public content pages',
        defaultTtl: cdk.Duration.minutes(5),
        minTtl: cdk.Duration.seconds(1),
        maxTtl: cdk.Duration.hours(1),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      }
    );

    // =========================================================================
    // Origin Request Policies
    // =========================================================================

    // Origin request policy for payment APIs
    // Forward payment headers to Lambda@Edge for verification
    const paymentApiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      'PaymentApiOriginRequestPolicy',
      {
        originRequestPolicyName: `X402-PaymentApi-ForwardHeaders-${suffix}`,
        comment: 'Forward payment headers to origin for x402 verification',
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          'X-Payment-Signature',
          'Payment-Signature',
          'Content-Type',
          'Accept'
        ),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      }
    );

    // =========================================================================
    // Response Headers Policy
    // =========================================================================

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'ResponseHeadersPolicy',
      {
        responseHeadersPolicyName: `X402-ResponseHeaders-${suffix}`,
        comment: 'CORS and x402 payment response headers',
        corsBehavior: {
          accessControlAllowOrigins: ['*'],
          accessControlAllowHeaders: [
            'Content-Type',
            'X-Payment-Signature',
            'Payment-Signature',
            'Accept',
            'Origin',
          ],
          accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
          accessControlExposeHeaders: [
            'X-PAYMENT-RESPONSE',
            'X-PAYMENT-REQUIRED',
            'X-Request-Id',
          ],
          accessControlAllowCredentials: false,
          accessControlMaxAge: cdk.Duration.hours(1),
          originOverride: true,
        },
        // Security headers for best practices
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
        // Custom headers for cache debugging
        customHeadersBehavior: {
          customHeaders: [
            {
              header: 'X-Cache-Policy',
              value: 'x402-seller',
              override: false,
            },
          ],
        },
      }
    );

    // =========================================================================
    // CloudFront Distribution
    // =========================================================================

    // Create CloudFront distribution with optimized caching
    const distribution = new cloudfront.Distribution(this, 'X402Distribution', {
      comment: 'x402 Payment-Protected Content Distribution',
      defaultBehavior: {
        origin: new origins.S3Origin(contentBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        // Default behavior uses payment verification for all content
        cachePolicy: paymentApiCachePolicy,
        originRequestPolicy: paymentApiOriginRequestPolicy,
        responseHeadersPolicy: responseHeadersPolicy,
        edgeLambdas: [
          {
            functionVersion: paymentVerifier.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
          },
        ],
        compress: true,
      },
      additionalBehaviors: {
        // MCP discovery endpoint - NO payment required, short caching
        '/mcp/*': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: publicContentCachePolicy,
          responseHeadersPolicy: responseHeadersPolicy,
          edgeLambdas: [
            {
              functionVersion: paymentVerifier.currentVersion,
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            },
          ],
          compress: true,
        },
        // Payment-protected API endpoints - NO caching
        '/api/*': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: paymentApiCachePolicy,
          originRequestPolicy: paymentApiOriginRequestPolicy,
          responseHeadersPolicy: responseHeadersPolicy,
          edgeLambdas: [
            {
              functionVersion: paymentVerifier.currentVersion,
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            },
          ],
          compress: true,
        },
        // Static assets - aggressive caching
        '/static/*': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          responseHeadersPolicy: responseHeadersPolicy,
          compress: true,
        },
        // Images - aggressive caching
        '*.jpg': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: false, // Images are already compressed
        },
        '*.png': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: false,
        },
        '*.svg': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: true, // SVGs benefit from compression
        },
        // CSS and JS - aggressive caching
        '*.css': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: true,
        },
        '*.js': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: true,
        },
        // Fonts - aggressive caching
        '*.woff2': {
          origin: new origins.S3Origin(contentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: false, // Fonts are already compressed
        },
      },
      // Enable HTTP/2 and HTTP/3 for better performance
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Price class - use all edge locations for best performance
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      // Logging disabled for demo simplicity
      // CloudFront standard logging requires ACL-enabled buckets
      enableLogging: false,
    });

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: 'X402DistributionDomain',
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: 'X402DistributionUrl',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID (for cache invalidation)',
      exportName: 'X402DistributionId',
    });

    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      description: 'S3 Content Bucket Name',
      exportName: 'X402ContentBucket',
    });

    new cdk.CfnOutput(this, 'PaymentApiEndpoint', {
      value: `https://${distribution.distributionDomainName}/api/`,
      description: 'Payment-protected API endpoint (requires x402 payment)',
      exportName: 'X402PaymentApiEndpoint',
    });

    new cdk.CfnOutput(this, 'CachePolicySummary', {
      value: JSON.stringify({
        paymentApi: 'No caching (TTL=0) - each request requires payment verification',
        staticAssets: 'Long-term caching (default 1 day, max 1 year)',
        publicContent: 'Short-term caching (default 5 min, max 1 hour)',
      }),
      description: 'Summary of caching policies applied to different content types',
    });

    // ==========================================
    // CDK Nag Suppressions
    // ==========================================
    NagSuppressions.addResourceSuppressions(contentBucket, [
      { id: 'AwsSolutions-S1', reason: 'Demo project — access logs not required for testnet content bucket' },
      { id: 'AwsSolutions-S10', reason: 'Bucket is only accessed via CloudFront OAI, not directly over the internet' },
    ], true);

    NagSuppressions.addResourceSuppressions(paymentVerifier, [
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is required for Lambda@Edge CloudWatch logging' },
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard scoped to content bucket — Lambda@Edge reads S3 objects to serve paid content' },
      { id: 'AwsSolutions-L1', reason: 'Lambda@Edge runtime pinned for compatibility — CloudFront replication requires stable runtime' },
    ], true);

    NagSuppressions.addResourceSuppressions(distribution, [
      { id: 'AwsSolutions-CFR1', reason: 'Demo project — geo restrictions not needed for testnet demo' },
      { id: 'AwsSolutions-CFR2', reason: 'Demo project — WAF not required for testnet payment demo' },
      { id: 'AwsSolutions-CFR3', reason: 'Demo project — CloudFront access logging not required' },
      { id: 'AwsSolutions-CFR4', reason: 'Using default CloudFront viewer certificate which requires default SSL policy' },
      { id: 'AwsSolutions-CFR7', reason: 'Using legacy S3Origin with OAI — migration to S3BucketOrigin with OAC is a future improvement' },
    ]);
  }
}
