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
exports.X402SellerStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cdk_nag_1 = require("cdk-nag");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
class X402SellerStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Write deploy-config.json into lambda-edge/ so it gets bundled
        const lambdaEdgeDir = path.join(__dirname, 'lambda-edge');
        const deployConfig = {};
        if (process.env.PAYMENT_RECIPIENT_ADDRESS) {
            deployConfig.payTo = process.env.PAYMENT_RECIPIENT_ADDRESS;
        }
        fs.writeFileSync(path.join(lambdaEdgeDir, 'deploy-config.json'), JSON.stringify(deployConfig, null, 2));
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
        const paymentVerifier = new cloudfront.experimental.EdgeFunction(this, 'PaymentVerifier', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'payment-verifier.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-edge')),
            memorySize: 128,
            timeout: cdk.Duration.seconds(20),
            // Note: Lambda@Edge doesn't support environment variables directly
            // The bucket name is configured in content-config.ts via CONTENT_BUCKET env var
            // which must be set at build time or use the default bucket name
        });
        // Grant Lambda@Edge permission to read from the content bucket
        contentBucket.grantRead(paymentVerifier);
        // =========================================================================
        // Caching Policies
        // =========================================================================
        // Cache policy for payment-protected API endpoints
        // Disabled - each request requires unique payment verification
        const paymentApiCachePolicy = new cloudfront.CachePolicy(this, 'PaymentApiCachePolicy', {
            cachePolicyName: `X402-PaymentApi-NoCache-${suffix}`,
            comment: 'No caching for x402 payment-protected endpoints',
            defaultTtl: cdk.Duration.seconds(0),
            minTtl: cdk.Duration.seconds(0),
            maxTtl: cdk.Duration.seconds(0),
            // Note: headerBehavior cannot be set when caching is disabled (TTL=0)
            // Payment headers are forwarded via the origin request policy instead
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        });
        // Cache policy for static assets (images, CSS, JS, fonts)
        // These don't require payment and can be cached aggressively
        const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
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
        });
        // Cache policy for public content (non-payment-protected pages)
        // Short TTL to balance freshness with performance
        const publicContentCachePolicy = new cloudfront.CachePolicy(this, 'PublicContentCachePolicy', {
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
        });
        // =========================================================================
        // Origin Request Policies
        // =========================================================================
        // Origin request policy for payment APIs
        // Forward payment headers to Lambda@Edge for verification
        const paymentApiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'PaymentApiOriginRequestPolicy', {
            originRequestPolicyName: `X402-PaymentApi-ForwardHeaders-${suffix}`,
            comment: 'Forward payment headers to origin for x402 verification',
            headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList('X-Payment-Signature', 'Payment-Signature', 'Content-Type', 'Accept'),
            queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
            cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
        });
        // =========================================================================
        // Response Headers Policy
        // =========================================================================
        const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
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
        });
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
        cdk_nag_1.NagSuppressions.addResourceSuppressions(contentBucket, [
            { id: 'AwsSolutions-S1', reason: 'Demo project — access logs not required for testnet content bucket' },
            { id: 'AwsSolutions-S10', reason: 'Bucket is only accessed via CloudFront OAI, not directly over the internet' },
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(paymentVerifier, [
            { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is required for Lambda@Edge CloudWatch logging' },
            { id: 'AwsSolutions-IAM5', reason: 'Wildcard scoped to content bucket — Lambda@Edge reads S3 objects to serve paid content' },
            { id: 'AwsSolutions-L1', reason: 'Lambda@Edge runtime pinned for compatibility — CloudFront replication requires stable runtime' },
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(distribution, [
            { id: 'AwsSolutions-CFR1', reason: 'Demo project — geo restrictions not needed for testnet demo' },
            { id: 'AwsSolutions-CFR2', reason: 'Demo project — WAF not required for testnet payment demo' },
            { id: 'AwsSolutions-CFR3', reason: 'Demo project — CloudFront access logging not required' },
            { id: 'AwsSolutions-CFR4', reason: 'Using default CloudFront viewer certificate which requires default SSL policy' },
            { id: 'AwsSolutions-CFR7', reason: 'Using legacy S3Origin with OAI — migration to S3BucketOrigin with OAC is a future improvement' },
        ]);
    }
}
exports.X402SellerStack = X402SellerStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWRmcm9udC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsb3VkZnJvbnQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0RBQWlEO0FBQ2pELHVEQUF5QztBQUV6QyxxQ0FBMEM7QUFDMUMsMkNBQTZCO0FBQzdCLHVDQUF5QjtBQUN6QiwrQ0FBaUM7QUFFakMsOEJBQThCO0FBQzlCLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUU1RCxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixnRUFBZ0U7UUFDaEUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDMUQsTUFBTSxZQUFZLEdBQTJCLEVBQUUsQ0FBQztRQUNoRCxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLEVBQUUsQ0FBQztZQUMxQyxZQUFZLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUM7UUFDN0QsQ0FBQztRQUNELEVBQUUsQ0FBQyxhQUFhLENBQ2QsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsb0JBQW9CLENBQUMsRUFDOUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUN0QyxDQUFDO1FBRUYsZ0VBQWdFO1FBQ2hFLE1BQU0sTUFB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K0VBQStFLEVBQUU7WUFDcEgsRUFBRSxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxFQUFFLCtGQUErRixFQUFFO1NBQ3JJLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxZRCwwQ0FrWUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSAnY2RrLW5hZyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgZG90ZW52IGZyb20gJ2RvdGVudic7XG5cbi8vIExvYWQgLmVudiBmcm9tIHByb2plY3Qgcm9vdFxuZG90ZW52LmNvbmZpZyh7IHBhdGg6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuZW52JykgfSk7XG5cbmV4cG9ydCBjbGFzcyBYNDAyU2VsbGVyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBXcml0ZSBkZXBsb3ktY29uZmlnLmpzb24gaW50byBsYW1iZGEtZWRnZS8gc28gaXQgZ2V0cyBidW5kbGVkXG4gICAgY29uc3QgbGFtYmRhRWRnZURpciA9IHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEtZWRnZScpO1xuICAgIGNvbnN0IGRlcGxveUNvbmZpZzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGlmIChwcm9jZXNzLmVudi5QQVlNRU5UX1JFQ0lQSUVOVF9BRERSRVNTKSB7XG4gICAgICBkZXBsb3lDb25maWcucGF5VG8gPSBwcm9jZXNzLmVudi5QQVlNRU5UX1JFQ0lQSUVOVF9BRERSRVNTO1xuICAgIH1cbiAgICBmcy53cml0ZUZpbGVTeW5jKFxuICAgICAgcGF0aC5qb2luKGxhbWJkYUVkZ2VEaXIsICdkZXBsb3ktY29uZmlnLmpzb24nKSxcbiAgICAgIEpTT04uc3RyaW5naWZ5KGRlcGxveUNvbmZpZywgbnVsbCwgMilcbiAgICApO1xuXG4gICAgLy8gVW5pcXVlIHN1ZmZpeCBmb3IgcG9saWN5IG5hbWVzIHRvIGF2b2lkIGNvbmZsaWN0cyBvbiByZWRlcGxveVxuICAgIGNvbnN0IHN1ZmZpeCA9IGNkay5OYW1lcy51bmlxdWVJZCh0aGlzKS5zbGljZSgtOCk7XG5cbiAgICAvLyBDcmVhdGUgUzMgYnVja2V0IGZvciBzdGF0aWMgY29udGVudCAob3B0aW9uYWwpXG4gICAgY29uc3QgY29udGVudEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0NvbnRlbnRCdWNrZXQnLCB7XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuSEVBRF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhQEVkZ2UgZnVuY3Rpb24gZm9yIHBheW1lbnQgdmVyaWZpY2F0aW9uXG4gICAgY29uc3QgcGF5bWVudFZlcmlmaWVyID0gbmV3IGNsb3VkZnJvbnQuZXhwZXJpbWVudGFsLkVkZ2VGdW5jdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICAnUGF5bWVudFZlcmlmaWVyJyxcbiAgICAgIHtcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICAgIGhhbmRsZXI6ICdwYXltZW50LXZlcmlmaWVyLmhhbmRsZXInLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS1lZGdlJykpLFxuICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDIwKSxcbiAgICAgICAgLy8gTm90ZTogTGFtYmRhQEVkZ2UgZG9lc24ndCBzdXBwb3J0IGVudmlyb25tZW50IHZhcmlhYmxlcyBkaXJlY3RseVxuICAgICAgICAvLyBUaGUgYnVja2V0IG5hbWUgaXMgY29uZmlndXJlZCBpbiBjb250ZW50LWNvbmZpZy50cyB2aWEgQ09OVEVOVF9CVUNLRVQgZW52IHZhclxuICAgICAgICAvLyB3aGljaCBtdXN0IGJlIHNldCBhdCBidWlsZCB0aW1lIG9yIHVzZSB0aGUgZGVmYXVsdCBidWNrZXQgbmFtZVxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBMYW1iZGFARWRnZSBwZXJtaXNzaW9uIHRvIHJlYWQgZnJvbSB0aGUgY29udGVudCBidWNrZXRcbiAgICBjb250ZW50QnVja2V0LmdyYW50UmVhZChwYXltZW50VmVyaWZpZXIpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENhY2hpbmcgUG9saWNpZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBDYWNoZSBwb2xpY3kgZm9yIHBheW1lbnQtcHJvdGVjdGVkIEFQSSBlbmRwb2ludHNcbiAgICAvLyBEaXNhYmxlZCAtIGVhY2ggcmVxdWVzdCByZXF1aXJlcyB1bmlxdWUgcGF5bWVudCB2ZXJpZmljYXRpb25cbiAgICBjb25zdCBwYXltZW50QXBpQ2FjaGVQb2xpY3kgPSBuZXcgY2xvdWRmcm9udC5DYWNoZVBvbGljeShcbiAgICAgIHRoaXMsXG4gICAgICAnUGF5bWVudEFwaUNhY2hlUG9saWN5JyxcbiAgICAgIHtcbiAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiBgWDQwMi1QYXltZW50QXBpLU5vQ2FjaGUtJHtzdWZmaXh9YCxcbiAgICAgICAgY29tbWVudDogJ05vIGNhY2hpbmcgZm9yIHg0MDIgcGF5bWVudC1wcm90ZWN0ZWQgZW5kcG9pbnRzJyxcbiAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgIC8vIE5vdGU6IGhlYWRlckJlaGF2aW9yIGNhbm5vdCBiZSBzZXQgd2hlbiBjYWNoaW5nIGlzIGRpc2FibGVkIChUVEw9MClcbiAgICAgICAgLy8gUGF5bWVudCBoZWFkZXJzIGFyZSBmb3J3YXJkZWQgdmlhIHRoZSBvcmlnaW4gcmVxdWVzdCBwb2xpY3kgaW5zdGVhZFxuICAgICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlUXVlcnlTdHJpbmdCZWhhdmlvci5ub25lKCksXG4gICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDYWNoZSBwb2xpY3kgZm9yIHN0YXRpYyBhc3NldHMgKGltYWdlcywgQ1NTLCBKUywgZm9udHMpXG4gICAgLy8gVGhlc2UgZG9uJ3QgcmVxdWlyZSBwYXltZW50IGFuZCBjYW4gYmUgY2FjaGVkIGFnZ3Jlc3NpdmVseVxuICAgIGNvbnN0IHN0YXRpY0Fzc2V0c0NhY2hlUG9saWN5ID0gbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3koXG4gICAgICB0aGlzLFxuICAgICAgJ1N0YXRpY0Fzc2V0c0NhY2hlUG9saWN5JyxcbiAgICAgIHtcbiAgICAgICAgY2FjaGVQb2xpY3lOYW1lOiBgWDQwMi1TdGF0aWNBc3NldHMtTG9uZ0NhY2hlLSR7c3VmZml4fWAsXG4gICAgICAgIGNvbW1lbnQ6ICdMb25nLXRlcm0gY2FjaGluZyBmb3Igc3RhdGljIGFzc2V0cyB0aGF0IGRvIG5vdCByZXF1aXJlIHBheW1lbnQnLFxuICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygxKSxcbiAgICAgICAgbWF4VHRsOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgcXVlcnlTdHJpbmdCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZVF1ZXJ5U3RyaW5nQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICBjb29raWVCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUNvb2tpZUJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgZW5hYmxlQWNjZXB0RW5jb2RpbmdHemlwOiB0cnVlLFxuICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0Jyb3RsaTogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQ2FjaGUgcG9saWN5IGZvciBwdWJsaWMgY29udGVudCAobm9uLXBheW1lbnQtcHJvdGVjdGVkIHBhZ2VzKVxuICAgIC8vIFNob3J0IFRUTCB0byBiYWxhbmNlIGZyZXNobmVzcyB3aXRoIHBlcmZvcm1hbmNlXG4gICAgY29uc3QgcHVibGljQ29udGVudENhY2hlUG9saWN5ID0gbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3koXG4gICAgICB0aGlzLFxuICAgICAgJ1B1YmxpY0NvbnRlbnRDYWNoZVBvbGljeScsXG4gICAgICB7XG4gICAgICAgIGNhY2hlUG9saWN5TmFtZTogYFg0MDItUHVibGljQ29udGVudC1TaG9ydENhY2hlLSR7c3VmZml4fWAsXG4gICAgICAgIGNvbW1lbnQ6ICdTaG9ydC10ZXJtIGNhY2hpbmcgZm9yIHB1YmxpYyBjb250ZW50IHBhZ2VzJyxcbiAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMSksXG4gICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZUhlYWRlckJlaGF2aW9yLm5vbmUoKSxcbiAgICAgICAgcXVlcnlTdHJpbmdCZWhhdmlvcjogY2xvdWRmcm9udC5DYWNoZVF1ZXJ5U3RyaW5nQmVoYXZpb3IuYWxsKCksXG4gICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250LkNhY2hlQ29va2llQmVoYXZpb3Iubm9uZSgpLFxuICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0d6aXA6IHRydWUsXG4gICAgICAgIGVuYWJsZUFjY2VwdEVuY29kaW5nQnJvdGxpOiB0cnVlLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3JpZ2luIFJlcXVlc3QgUG9saWNpZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBPcmlnaW4gcmVxdWVzdCBwb2xpY3kgZm9yIHBheW1lbnQgQVBJc1xuICAgIC8vIEZvcndhcmQgcGF5bWVudCBoZWFkZXJzIHRvIExhbWJkYUBFZGdlIGZvciB2ZXJpZmljYXRpb25cbiAgICBjb25zdCBwYXltZW50QXBpT3JpZ2luUmVxdWVzdFBvbGljeSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3koXG4gICAgICB0aGlzLFxuICAgICAgJ1BheW1lbnRBcGlPcmlnaW5SZXF1ZXN0UG9saWN5JyxcbiAgICAgIHtcbiAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeU5hbWU6IGBYNDAyLVBheW1lbnRBcGktRm9yd2FyZEhlYWRlcnMtJHtzdWZmaXh9YCxcbiAgICAgICAgY29tbWVudDogJ0ZvcndhcmQgcGF5bWVudCBoZWFkZXJzIHRvIG9yaWdpbiBmb3IgeDQwMiB2ZXJpZmljYXRpb24nLFxuICAgICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0SGVhZGVyQmVoYXZpb3IuYWxsb3dMaXN0KFxuICAgICAgICAgICdYLVBheW1lbnQtU2lnbmF0dXJlJyxcbiAgICAgICAgICAnUGF5bWVudC1TaWduYXR1cmUnLFxuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdBY2NlcHQnXG4gICAgICAgICksXG4gICAgICAgIHF1ZXJ5U3RyaW5nQmVoYXZpb3I6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFF1ZXJ5U3RyaW5nQmVoYXZpb3IuYWxsKCksXG4gICAgICAgIGNvb2tpZUJlaGF2aW9yOiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RDb29raWVCZWhhdmlvci5ub25lKCksXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBSZXNwb25zZSBIZWFkZXJzIFBvbGljeVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IHJlc3BvbnNlSGVhZGVyc1BvbGljeSA9IG5ldyBjbG91ZGZyb250LlJlc3BvbnNlSGVhZGVyc1BvbGljeShcbiAgICAgIHRoaXMsXG4gICAgICAnUmVzcG9uc2VIZWFkZXJzUG9saWN5JyxcbiAgICAgIHtcbiAgICAgICAgcmVzcG9uc2VIZWFkZXJzUG9saWN5TmFtZTogYFg0MDItUmVzcG9uc2VIZWFkZXJzLSR7c3VmZml4fWAsXG4gICAgICAgIGNvbW1lbnQ6ICdDT1JTIGFuZCB4NDAyIHBheW1lbnQgcmVzcG9uc2UgaGVhZGVycycsXG4gICAgICAgIGNvcnNCZWhhdmlvcjoge1xuICAgICAgICAgIGFjY2Vzc0NvbnRyb2xBbGxvd09yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFjY2Vzc0NvbnRyb2xBbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICAgJ1gtUGF5bWVudC1TaWduYXR1cmUnLFxuICAgICAgICAgICAgJ1BheW1lbnQtU2lnbmF0dXJlJyxcbiAgICAgICAgICAgICdBY2NlcHQnLFxuICAgICAgICAgICAgJ09yaWdpbicsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhY2Nlc3NDb250cm9sQWxsb3dNZXRob2RzOiBbJ0dFVCcsICdIRUFEJywgJ09QVElPTlMnXSxcbiAgICAgICAgICBhY2Nlc3NDb250cm9sRXhwb3NlSGVhZGVyczogW1xuICAgICAgICAgICAgJ1gtUEFZTUVOVC1SRVNQT05TRScsXG4gICAgICAgICAgICAnWC1QQVlNRU5ULVJFUVVJUkVEJyxcbiAgICAgICAgICAgICdYLVJlcXVlc3QtSWQnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWNjZXNzQ29udHJvbEFsbG93Q3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICAgIGFjY2Vzc0NvbnRyb2xNYXhBZ2U6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICBvcmlnaW5PdmVycmlkZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gU2VjdXJpdHkgaGVhZGVycyBmb3IgYmVzdCBwcmFjdGljZXNcbiAgICAgICAgc2VjdXJpdHlIZWFkZXJzQmVoYXZpb3I6IHtcbiAgICAgICAgICBjb250ZW50VHlwZU9wdGlvbnM6IHsgb3ZlcnJpZGU6IHRydWUgfSxcbiAgICAgICAgICBmcmFtZU9wdGlvbnM6IHtcbiAgICAgICAgICAgIGZyYW1lT3B0aW9uOiBjbG91ZGZyb250LkhlYWRlcnNGcmFtZU9wdGlvbi5ERU5ZLFxuICAgICAgICAgICAgb3ZlcnJpZGU6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByZWZlcnJlclBvbGljeToge1xuICAgICAgICAgICAgcmVmZXJyZXJQb2xpY3k6IGNsb3VkZnJvbnQuSGVhZGVyc1JlZmVycmVyUG9saWN5LlNUUklDVF9PUklHSU5fV0hFTl9DUk9TU19PUklHSU4sXG4gICAgICAgICAgICBvdmVycmlkZTogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHhzc1Byb3RlY3Rpb246IHtcbiAgICAgICAgICAgIHByb3RlY3Rpb246IHRydWUsXG4gICAgICAgICAgICBtb2RlQmxvY2s6IHRydWUsXG4gICAgICAgICAgICBvdmVycmlkZTogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBDdXN0b20gaGVhZGVycyBmb3IgY2FjaGUgZGVidWdnaW5nXG4gICAgICAgIGN1c3RvbUhlYWRlcnNCZWhhdmlvcjoge1xuICAgICAgICAgIGN1c3RvbUhlYWRlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaGVhZGVyOiAnWC1DYWNoZS1Qb2xpY3knLFxuICAgICAgICAgICAgICB2YWx1ZTogJ3g0MDItc2VsbGVyJyxcbiAgICAgICAgICAgICAgb3ZlcnJpZGU6IGZhbHNlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xvdWRGcm9udCBEaXN0cmlidXRpb25cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gd2l0aCBvcHRpbWl6ZWQgY2FjaGluZ1xuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnWDQwMkRpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGNvbW1lbnQ6ICd4NDAyIFBheW1lbnQtUHJvdGVjdGVkIENvbnRlbnQgRGlzdHJpYnV0aW9uJyxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGNvbnRlbnRCdWNrZXQpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgIC8vIERlZmF1bHQgYmVoYXZpb3IgdXNlcyBwYXltZW50IHZlcmlmaWNhdGlvbiBmb3IgYWxsIGNvbnRlbnRcbiAgICAgICAgY2FjaGVQb2xpY3k6IHBheW1lbnRBcGlDYWNoZVBvbGljeSxcbiAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogcGF5bWVudEFwaU9yaWdpblJlcXVlc3RQb2xpY3ksXG4gICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogcmVzcG9uc2VIZWFkZXJzUG9saWN5LFxuICAgICAgICBlZGdlTGFtYmRhczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uVmVyc2lvbjogcGF5bWVudFZlcmlmaWVyLmN1cnJlbnRWZXJzaW9uLFxuICAgICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkxhbWJkYUVkZ2VFdmVudFR5cGUuT1JJR0lOX1JFUVVFU1QsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICB9LFxuICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAvLyBNQ1AgZGlzY292ZXJ5IGVuZHBvaW50IC0gTk8gcGF5bWVudCByZXF1aXJlZCwgc2hvcnQgY2FjaGluZ1xuICAgICAgICAnL21jcC8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4oY29udGVudEJ1Y2tldCksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogcHVibGljQ29udGVudENhY2hlUG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogcmVzcG9uc2VIZWFkZXJzUG9saWN5LFxuICAgICAgICAgIGVkZ2VMYW1iZGFzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGZ1bmN0aW9uVmVyc2lvbjogcGF5bWVudFZlcmlmaWVyLmN1cnJlbnRWZXJzaW9uLFxuICAgICAgICAgICAgICBldmVudFR5cGU6IGNsb3VkZnJvbnQuTGFtYmRhRWRnZUV2ZW50VHlwZS5PUklHSU5fUkVRVUVTVCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gUGF5bWVudC1wcm90ZWN0ZWQgQVBJIGVuZHBvaW50cyAtIE5PIGNhY2hpbmdcbiAgICAgICAgJy9hcGkvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGNvbnRlbnRCdWNrZXQpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IHBheW1lbnRBcGlDYWNoZVBvbGljeSxcbiAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBwYXltZW50QXBpT3JpZ2luUmVxdWVzdFBvbGljeSxcbiAgICAgICAgICByZXNwb25zZUhlYWRlcnNQb2xpY3k6IHJlc3BvbnNlSGVhZGVyc1BvbGljeSxcbiAgICAgICAgICBlZGdlTGFtYmRhczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBmdW5jdGlvblZlcnNpb246IHBheW1lbnRWZXJpZmllci5jdXJyZW50VmVyc2lvbixcbiAgICAgICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkxhbWJkYUVkZ2VFdmVudFR5cGUuT1JJR0lOX1JFUVVFU1QsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIFN0YXRpYyBhc3NldHMgLSBhZ2dyZXNzaXZlIGNhY2hpbmdcbiAgICAgICAgJy9zdGF0aWMvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGNvbnRlbnRCdWNrZXQpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFELFxuICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogc3RhdGljQXNzZXRzQ2FjaGVQb2xpY3ksXG4gICAgICAgICAgcmVzcG9uc2VIZWFkZXJzUG9saWN5OiByZXNwb25zZUhlYWRlcnNQb2xpY3ksXG4gICAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIEltYWdlcyAtIGFnZ3Jlc3NpdmUgY2FjaGluZ1xuICAgICAgICAnKi5qcGcnOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbihjb250ZW50QnVja2V0KSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRCxcbiAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQUQsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IHN0YXRpY0Fzc2V0c0NhY2hlUG9saWN5LFxuICAgICAgICAgIGNvbXByZXNzOiBmYWxzZSwgLy8gSW1hZ2VzIGFyZSBhbHJlYWR5IGNvbXByZXNzZWRcbiAgICAgICAgfSxcbiAgICAgICAgJyoucG5nJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4oY29udGVudEJ1Y2tldCksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQUQsXG4gICAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFELFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBzdGF0aWNBc3NldHNDYWNoZVBvbGljeSxcbiAgICAgICAgICBjb21wcmVzczogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgICcqLnN2Zyc6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGNvbnRlbnRCdWNrZXQpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFELFxuICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogc3RhdGljQXNzZXRzQ2FjaGVQb2xpY3ksXG4gICAgICAgICAgY29tcHJlc3M6IHRydWUsIC8vIFNWR3MgYmVuZWZpdCBmcm9tIGNvbXByZXNzaW9uXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENTUyBhbmQgSlMgLSBhZ2dyZXNzaXZlIGNhY2hpbmdcbiAgICAgICAgJyouY3NzJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4oY29udGVudEJ1Y2tldCksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQUQsXG4gICAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFELFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBzdGF0aWNBc3NldHNDYWNoZVBvbGljeSxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJyouanMnOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbihjb250ZW50QnVja2V0KSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRCxcbiAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQUQsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IHN0YXRpY0Fzc2V0c0NhY2hlUG9saWN5LFxuICAgICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAvLyBGb250cyAtIGFnZ3Jlc3NpdmUgY2FjaGluZ1xuICAgICAgICAnKi53b2ZmMic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGNvbnRlbnRCdWNrZXQpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFELFxuICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogc3RhdGljQXNzZXRzQ2FjaGVQb2xpY3ksXG4gICAgICAgICAgY29tcHJlc3M6IGZhbHNlLCAvLyBGb250cyBhcmUgYWxyZWFkeSBjb21wcmVzc2VkXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgLy8gRW5hYmxlIEhUVFAvMiBhbmQgSFRUUC8zIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2VcbiAgICAgIGh0dHBWZXJzaW9uOiBjbG91ZGZyb250Lkh0dHBWZXJzaW9uLkhUVFAyX0FORF8zLFxuICAgICAgLy8gUHJpY2UgY2xhc3MgLSB1c2UgYWxsIGVkZ2UgbG9jYXRpb25zIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfQUxMLFxuICAgICAgLy8gTG9nZ2luZyBkaXNhYmxlZCBmb3IgZGVtbyBzaW1wbGljaXR5XG4gICAgICAvLyBDbG91ZEZyb250IHN0YW5kYXJkIGxvZ2dpbmcgcmVxdWlyZXMgQUNMLWVuYWJsZWQgYnVja2V0c1xuICAgICAgZW5hYmxlTG9nZ2luZzogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXN0cmlidXRpb25Eb21haW5OYW1lJywge1xuICAgICAgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBEb21haW4gTmFtZScsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMkRpc3RyaWJ1dGlvbkRvbWFpbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdYNDAyRGlzdHJpYnV0aW9uVXJsJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXN0cmlidXRpb25JZCcsIHtcbiAgICAgIHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIElEIChmb3IgY2FjaGUgaW52YWxpZGF0aW9uKScsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMkRpc3RyaWJ1dGlvbklkJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb250ZW50QnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBjb250ZW50QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIENvbnRlbnQgQnVja2V0IE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogJ1g0MDJDb250ZW50QnVja2V0JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQYXltZW50QXBpRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX0vYXBpL2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BheW1lbnQtcHJvdGVjdGVkIEFQSSBlbmRwb2ludCAocmVxdWlyZXMgeDQwMiBwYXltZW50KScsXG4gICAgICBleHBvcnROYW1lOiAnWDQwMlBheW1lbnRBcGlFbmRwb2ludCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2FjaGVQb2xpY3lTdW1tYXJ5Jywge1xuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcGF5bWVudEFwaTogJ05vIGNhY2hpbmcgKFRUTD0wKSAtIGVhY2ggcmVxdWVzdCByZXF1aXJlcyBwYXltZW50IHZlcmlmaWNhdGlvbicsXG4gICAgICAgIHN0YXRpY0Fzc2V0czogJ0xvbmctdGVybSBjYWNoaW5nIChkZWZhdWx0IDEgZGF5LCBtYXggMSB5ZWFyKScsXG4gICAgICAgIHB1YmxpY0NvbnRlbnQ6ICdTaG9ydC10ZXJtIGNhY2hpbmcgKGRlZmF1bHQgNSBtaW4sIG1heCAxIGhvdXIpJyxcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246ICdTdW1tYXJ5IG9mIGNhY2hpbmcgcG9saWNpZXMgYXBwbGllZCB0byBkaWZmZXJlbnQgY29udGVudCB0eXBlcycsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDREsgTmFnIFN1cHByZXNzaW9uc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhjb250ZW50QnVja2V0LCBbXG4gICAgICB7IGlkOiAnQXdzU29sdXRpb25zLVMxJywgcmVhc29uOiAnRGVtbyBwcm9qZWN0IOKAlCBhY2Nlc3MgbG9ncyBub3QgcmVxdWlyZWQgZm9yIHRlc3RuZXQgY29udGVudCBidWNrZXQnIH0sXG4gICAgICB7IGlkOiAnQXdzU29sdXRpb25zLVMxMCcsIHJlYXNvbjogJ0J1Y2tldCBpcyBvbmx5IGFjY2Vzc2VkIHZpYSBDbG91ZEZyb250IE9BSSwgbm90IGRpcmVjdGx5IG92ZXIgdGhlIGludGVybmV0JyB9LFxuICAgIF0sIHRydWUpO1xuXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKHBheW1lbnRWZXJpZmllciwgW1xuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1JQU00JywgcmVhc29uOiAnQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlIGlzIHJlcXVpcmVkIGZvciBMYW1iZGFARWRnZSBDbG91ZFdhdGNoIGxvZ2dpbmcnIH0sXG4gICAgICB7IGlkOiAnQXdzU29sdXRpb25zLUlBTTUnLCByZWFzb246ICdXaWxkY2FyZCBzY29wZWQgdG8gY29udGVudCBidWNrZXQg4oCUIExhbWJkYUBFZGdlIHJlYWRzIFMzIG9iamVjdHMgdG8gc2VydmUgcGFpZCBjb250ZW50JyB9LFxuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1MMScsIHJlYXNvbjogJ0xhbWJkYUBFZGdlIHJ1bnRpbWUgcGlubmVkIGZvciBjb21wYXRpYmlsaXR5IOKAlCBDbG91ZEZyb250IHJlcGxpY2F0aW9uIHJlcXVpcmVzIHN0YWJsZSBydW50aW1lJyB9LFxuICAgIF0sIHRydWUpO1xuXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKGRpc3RyaWJ1dGlvbiwgW1xuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1DRlIxJywgcmVhc29uOiAnRGVtbyBwcm9qZWN0IOKAlCBnZW8gcmVzdHJpY3Rpb25zIG5vdCBuZWVkZWQgZm9yIHRlc3RuZXQgZGVtbycgfSxcbiAgICAgIHsgaWQ6ICdBd3NTb2x1dGlvbnMtQ0ZSMicsIHJlYXNvbjogJ0RlbW8gcHJvamVjdCDigJQgV0FGIG5vdCByZXF1aXJlZCBmb3IgdGVzdG5ldCBwYXltZW50IGRlbW8nIH0sXG4gICAgICB7IGlkOiAnQXdzU29sdXRpb25zLUNGUjMnLCByZWFzb246ICdEZW1vIHByb2plY3Qg4oCUIENsb3VkRnJvbnQgYWNjZXNzIGxvZ2dpbmcgbm90IHJlcXVpcmVkJyB9LFxuICAgICAgeyBpZDogJ0F3c1NvbHV0aW9ucy1DRlI0JywgcmVhc29uOiAnVXNpbmcgZGVmYXVsdCBDbG91ZEZyb250IHZpZXdlciBjZXJ0aWZpY2F0ZSB3aGljaCByZXF1aXJlcyBkZWZhdWx0IFNTTCBwb2xpY3knIH0sXG4gICAgICB7IGlkOiAnQXdzU29sdXRpb25zLUNGUjcnLCByZWFzb246ICdVc2luZyBsZWdhY3kgUzNPcmlnaW4gd2l0aCBPQUkg4oCUIG1pZ3JhdGlvbiB0byBTM0J1Y2tldE9yaWdpbiB3aXRoIE9BQyBpcyBhIGZ1dHVyZSBpbXByb3ZlbWVudCcgfSxcbiAgICBdKTtcbiAgfVxufVxuIl19