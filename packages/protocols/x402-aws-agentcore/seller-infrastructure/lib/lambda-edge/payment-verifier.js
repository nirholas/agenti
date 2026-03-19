"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const types_1 = require("./types");
const content_config_1 = require("./content-config");
// ============================================================================
// Logging and Metrics Infrastructure
// ============================================================================
class Logger {
    constructor(requestId, uri) {
        this.requestId = requestId;
        this.uri = uri;
        this.startTime = Date.now();
        this.metrics = new Map();
        this.dimensions = {
            Uri: uri,
            Environment: process.env.ENVIRONMENT || 'production',
        };
    }
    /**
     * Creates a structured log entry
     */
    createLogEntry(level, message, extra) {
        return {
            timestamp: new Date().toISOString(),
            level,
            requestId: this.requestId,
            message,
            uri: this.uri,
            durationMs: Date.now() - this.startTime,
            ...extra,
        };
    }
    /**
     * Logs a debug message
     */
    debug(message, extra) {
        const entry = this.createLogEntry(types_1.LogLevel.DEBUG, message, extra);
        console.log(JSON.stringify(entry));
    }
    /**
     * Logs an info message
     */
    info(message, extra) {
        const entry = this.createLogEntry(types_1.LogLevel.INFO, message, extra);
        console.log(JSON.stringify(entry));
    }
    /**
     * Logs a warning message
     */
    warn(message, extra) {
        const entry = this.createLogEntry(types_1.LogLevel.WARN, message, extra);
        console.warn(JSON.stringify(entry));
    }
    /**
     * Logs an error message
     */
    error(message, error, extra) {
        const errorDetails = { ...extra };
        if (error instanceof Error) {
            errorDetails.errorMessage = error.message;
            errorDetails.errorStack = error.stack;
        }
        else if (error) {
            errorDetails.errorMessage = String(error);
        }
        const entry = this.createLogEntry(types_1.LogLevel.ERROR, message, errorDetails);
        console.error(JSON.stringify(entry));
    }
    /**
     * Records a metric value
     */
    recordMetric(name, value) {
        this.metrics.set(name, value);
    }
    /**
     * Increments a counter metric
     */
    incrementCounter(name) {
        const current = this.metrics.get(name) || 0;
        this.metrics.set(name, current + 1);
    }
    /**
     * Sets a dimension for metrics
     */
    setDimension(key, value) {
        this.dimensions[key] = value;
    }
    /**
     * Emits all recorded metrics in CloudWatch EMF format
     */
    emitMetrics() {
        if (this.metrics.size === 0)
            return;
        const metricsArray = [];
        const metricValues = {};
        this.metrics.forEach((value, name) => {
            const unit = name.includes('Latency') ? 'Milliseconds' : 'Count';
            metricsArray.push({ Name: name, Unit: unit });
            metricValues[name] = value;
        });
        const emf = {
            _aws: {
                Timestamp: Date.now(),
                CloudWatchMetrics: [
                    {
                        Namespace: 'X402/PaymentVerifier',
                        Dimensions: [Object.keys(this.dimensions)],
                        Metrics: metricsArray,
                    },
                ],
            },
            ...this.dimensions,
            ...metricValues,
            requestId: this.requestId,
        };
        // EMF logs must be printed to stdout for CloudWatch to parse them
        console.log(JSON.stringify(emf));
    }
    /**
     * Gets elapsed time since logger creation
     */
    getElapsedMs() {
        return Date.now() - this.startTime;
    }
}
/**
 * Generates a unique request ID for tracing
 */
function generateRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}
// ============================================================================
// x402 v2 Types - imported from ./types
// ============================================================================
// Facilitator URL for payment verification
// Note: Lambda@Edge doesn't support environment variables, so this is bundled
// Using www subdomain to avoid 308 redirect (x402.org redirects to www.x402.org)
const FACILITATOR_URL = 'https://www.x402.org/facilitator';
// Seller wallet address is configured in content-config.ts (DEFAULT_PAY_TO)
/**
 * Validates the structure of a payment payload
 */
function validatePayloadStructure(payload) {
    if (!payload || typeof payload !== 'object')
        return false;
    const p = payload;
    // Check required top-level fields
    if (typeof p.x402Version !== 'number' || p.x402Version !== 2)
        return false;
    if (!p.accepted || typeof p.accepted !== 'object')
        return false;
    if (!p.payload || typeof p.payload !== 'object')
        return false;
    // Check accepted requirements
    const accepted = p.accepted;
    if (typeof accepted.scheme !== 'string')
        return false;
    if (typeof accepted.network !== 'string')
        return false;
    if (typeof accepted.amount !== 'string')
        return false;
    if (typeof accepted.asset !== 'string')
        return false;
    if (typeof accepted.payTo !== 'string')
        return false;
    // Check payload (exact EVM scheme)
    const payloadData = p.payload;
    if (typeof payloadData.signature !== 'string')
        return false;
    if (!payloadData.authorization || typeof payloadData.authorization !== 'object')
        return false;
    // Check authorization
    const auth = payloadData.authorization;
    if (typeof auth.from !== 'string')
        return false;
    if (typeof auth.to !== 'string')
        return false;
    if (typeof auth.value !== 'string')
        return false;
    if (typeof auth.validAfter !== 'string')
        return false;
    if (typeof auth.validBefore !== 'string')
        return false;
    if (typeof auth.nonce !== 'string')
        return false;
    return true;
}
/**
 * Validates that the payment authorization matches the requirements
 */
function validateAuthorizationParameters(payload, requirements) {
    const { authorization } = payload.payload;
    const payer = authorization.from;
    // Verify scheme matches
    if (payload.accepted.scheme !== requirements.scheme) {
        return {
            isValid: false,
            invalidReason: 'scheme_mismatch',
            payer,
        };
    }
    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
        return {
            isValid: false,
            invalidReason: 'network_mismatch',
            payer,
        };
    }
    // Verify recipient matches
    if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
        return {
            isValid: false,
            invalidReason: 'invalid_exact_evm_payload_recipient_mismatch',
            payer,
        };
    }
    // Verify amount is sufficient
    const paymentValue = BigInt(authorization.value);
    const requiredAmount = BigInt(requirements.amount);
    if (paymentValue < requiredAmount) {
        return {
            isValid: false,
            invalidReason: 'invalid_exact_evm_payload_authorization_value',
            payer,
        };
    }
    // Verify time validity
    const now = Math.floor(Date.now() / 1000);
    const validAfter = parseInt(authorization.validAfter, 10);
    const validBefore = parseInt(authorization.validBefore, 10);
    // Check validAfter is not in the future
    if (validAfter > now) {
        return {
            isValid: false,
            invalidReason: 'invalid_exact_evm_payload_authorization_valid_after',
            payer,
        };
    }
    // Check validBefore is in the future (with 6 second buffer for block time)
    if (validBefore < now + 6) {
        return {
            isValid: false,
            invalidReason: 'invalid_exact_evm_payload_authorization_valid_before',
            payer,
        };
    }
    // Verify asset matches
    if (payload.accepted.asset.toLowerCase() !== requirements.asset.toLowerCase()) {
        return {
            isValid: false,
            invalidReason: 'asset_mismatch',
            payer,
        };
    }
    // Verify signature format (should be 65 bytes = 130 hex chars + 0x prefix)
    const signature = payload.payload.signature;
    if (!signature.startsWith('0x')) {
        return {
            isValid: false,
            invalidReason: 'invalid_signature_format',
            payer,
        };
    }
    const signatureLength = signature.length - 2; // Remove 0x prefix
    // EOA signatures are 130 chars, smart wallet signatures can be longer
    if (signatureLength < 130) {
        return {
            isValid: false,
            invalidReason: 'invalid_signature_length',
            payer,
        };
    }
    // Verify nonce format (should be 32 bytes = 64 hex chars + 0x prefix)
    const nonce = authorization.nonce;
    if (!nonce.startsWith('0x') || nonce.length !== 66) {
        return {
            isValid: false,
            invalidReason: 'invalid_nonce_format',
            payer,
        };
    }
    return {
        isValid: true,
        payer,
    };
}
/**
 * Verifies the payment signature using the facilitator service
 * In production, this would call the x402 facilitator's /verify endpoint
 */
async function verifySignatureWithFacilitator(payload, requirements, logger) {
    const payer = payload.payload.authorization.from;
    try {
        logger.debug('Calling facilitator /verify endpoint', {
            facilitatorUrl: FACILITATOR_URL,
        });
        // Call facilitator /verify endpoint
        const response = await fetch(`${FACILITATOR_URL}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                paymentPayload: payload,
                paymentRequirements: requirements,
            }),
        });
        if (!response.ok) {
            logger.warn('Facilitator verify request failed', {
                statusCode: response.status,
                statusText: response.statusText,
            });
            logger.incrementCounter(types_1.MetricName.FACILITATOR_ERROR);
            return {
                isValid: false,
                invalidReason: 'facilitator_verification_failed',
                payer,
            };
        }
        const result = await response.json();
        logger.debug('Facilitator verification response received', {
            isValid: result.isValid,
        });
        return result;
    }
    catch (error) {
        logger.error('Error calling facilitator', error, {
            facilitatorUrl: FACILITATOR_URL,
        });
        logger.incrementCounter(types_1.MetricName.FACILITATOR_ERROR);
        // Fail properly - don't accept payments if facilitator is unavailable
        logger.error('Facilitator unavailable - rejecting payment for safety');
        return {
            isValid: false,
            invalidReason: 'facilitator_unavailable',
            payer,
        };
    }
}
/**
 * Settles the payment using the facilitator service
 */
async function settlePaymentWithFacilitator(payload, requirements, logger) {
    const payer = payload.payload.authorization.from;
    try {
        logger.debug('Calling facilitator /settle endpoint', {
            facilitatorUrl: FACILITATOR_URL,
            amount: requirements.amount,
        });
        const response = await fetch(`${FACILITATOR_URL}/settle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                paymentPayload: payload,
                paymentRequirements: requirements,
            }),
        });
        if (!response.ok) {
            logger.warn('Facilitator settle request failed', {
                statusCode: response.status,
                statusText: response.statusText,
            });
            logger.incrementCounter(types_1.MetricName.FACILITATOR_ERROR);
            return {
                success: false,
                transaction: '',
                network: requirements.network,
                payer,
                errorReason: 'settlement_failed',
            };
        }
        const result = await response.json();
        logger.debug('Facilitator settlement response received', {
            success: result.success,
            transaction: result.transaction,
        });
        return result;
    }
    catch (error) {
        logger.error('Error settling payment', error, {
            facilitatorUrl: FACILITATOR_URL,
        });
        logger.incrementCounter(types_1.MetricName.FACILITATOR_ERROR);
        // Fail properly - don't fake settlements
        logger.error('Facilitator unavailable - settlement failed');
        return {
            success: false,
            transaction: '',
            network: requirements.network,
            payer,
            errorReason: 'facilitator_unavailable',
        };
    }
}
/**
 * Creates a 402 Payment Required response
 */
function create402Response(uri, requirements, errorMessage) {
    const paymentRequired = {
        x402Version: 2,
        error: errorMessage || 'Payment required to access this resource',
        resource: {
            url: uri,
            description: `Protected resource at ${uri}`,
            mimeType: 'application/json',
        },
        accepts: [requirements],
        extensions: {},
    };
    return {
        status: '402',
        statusDescription: 'Payment Required',
        headers: {
            'content-type': [{ key: 'Content-Type', value: 'application/json' }],
            'x-payment-required': [{
                    key: 'X-PAYMENT-REQUIRED',
                    value: Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
                }],
            'access-control-allow-origin': [{ key: 'Access-Control-Allow-Origin', value: '*' }],
            'access-control-allow-headers': [{
                    key: 'Access-Control-Allow-Headers',
                    value: 'Content-Type, X-Payment-Signature'
                }],
            'access-control-expose-headers': [{
                    key: 'Access-Control-Expose-Headers',
                    value: 'X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE',
                }],
        },
        body: JSON.stringify({
            error: 'Payment Required',
            message: errorMessage || 'This content requires payment to access',
            x402Version: 2,
        }),
    };
}
/**
 * Creates an error response
 */
function createErrorResponse(status, statusDescription, error, message) {
    return {
        status,
        statusDescription,
        headers: {
            'content-type': [{ key: 'Content-Type', value: 'application/json' }],
            'access-control-allow-origin': [{ key: 'Access-Control-Allow-Origin', value: '*' }],
        },
        body: JSON.stringify({ error, message }),
    };
}
/**
 * Creates MCP tool discovery response
 * Returns all available services with their pricing and metadata
 */
function createMCPDiscoveryResponse(requestId) {
    const tools = [];
    // Get all content items from the registry
    const paths = content_config_1.contentManager.listContentPaths();
    for (const path of paths) {
        // Only expose /api/ prefixed paths (root paths are duplicates)
        if (!path.startsWith('/api/'))
            continue;
        const item = content_config_1.contentManager.getContentItem(path);
        if (!item)
            continue;
        // Convert path to tool name: /api/premium-article -> get_premium_article
        const toolName = 'get_' + path.replace('/api/', '').replace(/-/g, '_');
        // Calculate display price (USDC has 6 decimals)
        const amountUnits = parseInt(item.pricing.amount, 10);
        const displayPrice = (amountUnits / 1000000).toFixed(6).replace(/\.?0+$/, '');
        tools.push({
            tool_name: toolName,
            tool_description: `${item.description}. Requires x402 payment: ${item.pricing.amount} USDC units (${displayPrice} USDC) on Base Sepolia testnet.`,
            operation_id: toolName,
            endpoint_path: path,
            mcp_metadata: {
                category: path.includes('market') || path.includes('weather') ? 'market-data' :
                    path.includes('research') || path.includes('dataset') ? 'research' : 'content',
                tags: ['x402-payment', 'premium-content'],
                priority: 1,
                requires_payment: true,
                estimated_latency_ms: 2000,
            },
            x402_metadata: {
                price_usdc_units: item.pricing.amount,
                price_usdc_display: `${displayPrice} USDC`,
                network: item.pricing.network,
                network_name: 'Base Sepolia',
                scheme: item.pricing.scheme,
                asset_address: item.pricing.asset,
                asset_name: 'USDC',
                timeout_seconds: item.pricing.maxTimeoutSeconds,
            },
            input_schema: {
                type: 'object',
                properties: {},
                required: [],
                description: 'No input parameters required. Payment is handled via x402 headers.',
            },
        });
    }
    const response = {
        version: '1.0',
        tools,
        metadata: {
            gateway: 'x402-seller-gateway',
            protocol: 'x402-v2',
            network: 'base-sepolia',
            total_services: tools.length,
        },
    };
    return {
        status: '200',
        statusDescription: 'OK',
        headers: {
            'content-type': [{ key: 'Content-Type', value: 'application/json' }],
            'x-request-id': [{ key: 'X-Request-Id', value: requestId }],
            'access-control-allow-origin': [{ key: 'Access-Control-Allow-Origin', value: '*' }],
            'access-control-allow-headers': [{
                    key: 'Access-Control-Allow-Headers',
                    value: 'Content-Type, Accept'
                }],
            'cache-control': [{ key: 'Cache-Control', value: 'public, max-age=300' }],
        },
        body: JSON.stringify(response),
    };
}
const handler = async (event) => {
    const request = event.Records[0].cf.request;
    const uri = request.uri;
    // Extract S3 bucket name from CloudFront origin config (avoids hardcoding)
    const originDomain = request.origin?.s3?.domainName || '';
    if (originDomain) {
        (0, content_config_1.setContentBucket)(originDomain.split('.s3')[0]);
    }
    // Initialize logger with request ID for tracing
    const requestId = generateRequestId();
    const logger = new Logger(requestId, uri);
    // Record request metric
    logger.incrementCounter(types_1.MetricName.REQUEST_COUNT);
    logger.info('Processing request', { method: request.method });
    try {
        // Handle MCP discovery endpoint (no payment required)
        if (uri === '/mcp/tools') {
            logger.info('MCP discovery request');
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return createMCPDiscoveryResponse(requestId);
        }
        // Check if this path requires payment using dynamic content manager
        const paymentRequirement = content_config_1.contentManager.getPaymentRequirements(uri);
        if (!paymentRequirement) {
            // No payment required for this path
            logger.debug('No payment required for path');
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return request;
        }
        logger.setDimension('Network', paymentRequirement.network);
        logger.setDimension('Asset', paymentRequirement.asset);
        // Check for payment signature header (x402 v2 uses X-PAYMENT-SIGNATURE)
        const paymentSignatureHeader = request.headers['x-payment-signature'] ||
            request.headers['payment-signature'];
        if (!paymentSignatureHeader || !paymentSignatureHeader[0]) {
            // No payment provided - return 402 Payment Required
            logger.info('No payment signature found, returning 402', {
                requiredAmount: paymentRequirement.amount,
            });
            logger.incrementCounter(types_1.MetricName.PAYMENT_REQUIRED);
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return create402Response(uri, paymentRequirement);
        }
        // Payment signature present
        logger.incrementCounter(types_1.MetricName.PAYMENT_RECEIVED);
        // Decode and verify payment
        const paymentPayloadBase64 = paymentSignatureHeader[0].value;
        let paymentPayload;
        try {
            paymentPayload = JSON.parse(Buffer.from(paymentPayloadBase64, 'base64').toString('utf-8'));
        }
        catch (decodeError) {
            logger.warn('Failed to decode payment payload', {
                errorCode: 'DECODE_ERROR',
            });
            logger.incrementCounter(types_1.MetricName.VALIDATION_ERROR);
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return create402Response(uri, paymentRequirement, 'Invalid payment payload encoding');
        }
        logger.debug('Payment payload decoded successfully');
        // Validate payload structure
        if (!validatePayloadStructure(paymentPayload)) {
            logger.warn('Invalid payment payload structure', {
                errorCode: 'INVALID_STRUCTURE',
            });
            logger.incrementCounter(types_1.MetricName.VALIDATION_ERROR);
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return createErrorResponse('400', 'Bad Request', 'Invalid Payment', 'Payment payload structure is invalid');
        }
        // Extract payer address for logging
        const payer = paymentPayload.payload.authorization.from;
        logger.setDimension('Payer', payer.substring(0, 10) + '...');
        logger.info('Payment payload validated', {
            payer,
            amount: paymentPayload.accepted.amount,
            scheme: paymentPayload.accepted.scheme,
        });
        // Validate authorization parameters
        const paramValidation = validateAuthorizationParameters(paymentPayload, paymentRequirement);
        if (!paramValidation.isValid) {
            logger.warn('Payment parameter validation failed', {
                errorCode: paramValidation.invalidReason,
                payer,
            });
            logger.incrementCounter(types_1.MetricName.VALIDATION_ERROR);
            // Record specific validation error metrics
            switch (paramValidation.invalidReason) {
                case 'invalid_exact_evm_payload_authorization_valid_before':
                case 'invalid_exact_evm_payload_authorization_valid_after':
                    logger.incrementCounter(types_1.MetricName.AUTHORIZATION_EXPIRED);
                    break;
                case 'invalid_signature_format':
                case 'invalid_signature_length':
                    logger.incrementCounter(types_1.MetricName.SIGNATURE_INVALID);
                    break;
                case 'invalid_exact_evm_payload_authorization_value':
                    logger.incrementCounter(types_1.MetricName.AMOUNT_INSUFFICIENT);
                    break;
                case 'network_mismatch':
                    logger.incrementCounter(types_1.MetricName.NETWORK_MISMATCH);
                    break;
                case 'asset_mismatch':
                    logger.incrementCounter(types_1.MetricName.ASSET_MISMATCH);
                    break;
            }
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return create402Response(uri, paymentRequirement, `Payment validation failed: ${paramValidation.invalidReason}`);
        }
        logger.debug('Authorization parameters validated');
        // Verify signature with facilitator
        const verificationStartTime = Date.now();
        const signatureValidation = await verifySignatureWithFacilitator(paymentPayload, paymentRequirement, logger);
        logger.recordMetric(types_1.MetricName.VERIFICATION_LATENCY, Date.now() - verificationStartTime);
        if (!signatureValidation.isValid) {
            logger.warn('Signature verification failed', {
                errorCode: signatureValidation.invalidReason,
                payer,
            });
            logger.incrementCounter(types_1.MetricName.PAYMENT_FAILED);
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return create402Response(uri, paymentRequirement, `Signature verification failed: ${signatureValidation.invalidReason}`);
        }
        logger.incrementCounter(types_1.MetricName.PAYMENT_VERIFIED);
        logger.info('Payment signature verified', { payer });
        // Settle payment with facilitator
        const settlementStartTime = Date.now();
        const settlement = await settlePaymentWithFacilitator(paymentPayload, paymentRequirement, logger);
        logger.recordMetric(types_1.MetricName.SETTLEMENT_LATENCY, Date.now() - settlementStartTime);
        if (!settlement.success) {
            logger.error('Payment settlement failed', undefined, {
                errorCode: settlement.errorReason,
                payer,
            });
            logger.incrementCounter(types_1.MetricName.PAYMENT_FAILED);
            logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
            logger.emitMetrics();
            return createErrorResponse('402', 'Payment Required', 'Settlement Failed', `Payment settlement failed: ${settlement.errorReason}`);
        }
        // Payment verified and settled - return dynamic content
        logger.incrementCounter(types_1.MetricName.PAYMENT_SETTLED);
        // Record payment amount metric
        try {
            const amountWei = BigInt(paymentPayload.payload.authorization.value);
            logger.recordMetric(types_1.MetricName.PAYMENT_AMOUNT_WEI, Number(amountWei));
        }
        catch {
            // Ignore if amount parsing fails
        }
        logger.info('Payment settled successfully', {
            payer,
            transactionHash: settlement.transaction,
            amount: paymentRequirement.amount,
            network: paymentRequirement.network,
        });
        // Get dynamic content from content manager
        const content = await content_config_1.contentManager.getContent(uri);
        logger.incrementCounter(types_1.MetricName.CONTENT_GENERATED);
        // Record content size metric
        const contentJson = JSON.stringify(content);
        logger.recordMetric(types_1.MetricName.CONTENT_BYTES_SERVED, contentJson.length);
        // Create settlement response header
        const settlementResponse = {
            success: true,
            transaction: settlement.transaction,
            network: paymentRequirement.network,
            payer: paymentPayload.payload.authorization.from,
        };
        logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
        logger.emitMetrics();
        return {
            status: '200',
            statusDescription: 'OK',
            headers: {
                'content-type': [{ key: 'Content-Type', value: 'application/json' }],
                'x-payment-response': [{
                        key: 'X-PAYMENT-RESPONSE',
                        value: Buffer.from(JSON.stringify(settlementResponse)).toString('base64'),
                    }],
                'x-request-id': [{ key: 'X-Request-Id', value: requestId }],
                'access-control-allow-origin': [{ key: 'Access-Control-Allow-Origin', value: '*' }],
                'access-control-allow-headers': [{
                        key: 'Access-Control-Allow-Headers',
                        value: 'Content-Type, X-Payment-Signature'
                    }],
                'access-control-expose-headers': [{
                        key: 'Access-Control-Expose-Headers',
                        value: 'X-PAYMENT-RESPONSE, X-Request-Id'
                    }],
            },
            body: JSON.stringify(content),
        };
    }
    catch (error) {
        logger.error('Unexpected error processing payment', error);
        logger.incrementCounter(types_1.MetricName.PAYMENT_FAILED);
        logger.recordMetric(types_1.MetricName.LATENCY, logger.getElapsedMs());
        logger.emitMetrics();
        return createErrorResponse('500', 'Internal Server Error', 'Payment Processing Error', 'Failed to process payment');
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bWVudC12ZXJpZmllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBheW1lbnQtdmVyaWZpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsbUNBVWlCO0FBQ2pCLHFEQUFvRTtBQUVwRSwrRUFBK0U7QUFDL0UscUNBQXFDO0FBQ3JDLCtFQUErRTtBQUMvRSxNQUFNLE1BQU07SUFPVixZQUFZLFNBQWlCLEVBQUUsR0FBVztRQUN4QyxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzVCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsVUFBVSxHQUFHO1lBQ2hCLEdBQUcsRUFBRSxHQUFHO1lBQ1IsV0FBVyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLFlBQVk7U0FDckQsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNLLGNBQWMsQ0FDcEIsS0FBZSxFQUNmLE9BQWUsRUFDZixLQUErQjtRQUUvQixPQUFPO1lBQ0wsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1lBQ25DLEtBQUs7WUFDTCxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIsT0FBTztZQUNQLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRztZQUNiLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVM7WUFDdkMsR0FBRyxLQUFLO1NBQ1QsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxPQUFlLEVBQUUsS0FBK0I7UUFDcEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBUSxDQUFDLEtBQUssRUFBRSxPQUFP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QUcsRUFBRSw4QkFBOEI7d0JBQ25DLEtBQUssRUFBRSxtQ0FBbUM7cUJBQzNDLENBQUM7Z0JBQ0YsK0JBQStCLEVBQUUsQ0FBQzt3QkFDaEMsR0FBRyxFQUFFLCtCQUErQjt3QkFDcEMsS0FBSyxFQUFFLGtDQUFrQztxQkFDMUMsQ0FBQzthQUNIO1lBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO1NBQzlCLENBQUM7SUFDSixDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMscUNBQXFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0QsTUFBTSxDQUFDLGdCQUFnQixDQUFDLGtCQUFVLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDbkQsTUFBTSxDQUFDLFlBQVksQ0FBQyxrQkFBVSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUMvRCxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDckIsT0FBTyxtQkFBbUIsQ0FDeEIsS0FBSyxFQUNMLHVCQUF1QixFQUN2QiwwQkFBMEIsRUFDMUIsMkJBQTJCLENBQzVCLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBdlJXLFFBQUEsT0FBTyxXQXVSbEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDbG91ZEZyb250UmVxdWVzdEV2ZW50LCBDbG91ZEZyb250UmVxdWVzdFJlc3VsdCB9IGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHtcbiAgTG9nTGV2ZWwsXG4gIE1ldHJpY05hbWUsXG4gIExvZ0VudHJ5LFxuICBFTUZNZXRyaWMsXG4gIFBheW1lbnRSZXF1aXJlbWVudHMsXG4gIFBheW1lbnRSZXF1aXJlZCxcbiAgUGF5bWVudFBheWxvYWQsXG4gIFZlcmlmeVJlc3BvbnNlLFxuICBTZXR0bGVtZW50UmVzcG9uc2UsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgY29udGVudE1hbmFnZXIsIHNldENvbnRlbnRCdWNrZXQgfSBmcm9tICcuL2NvbnRlbnQtY29uZmlnJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gTG9nZ2luZyBhbmQgTWV0cmljcyBJbmZyYXN0cnVjdHVyZVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY2xhc3MgTG9nZ2VyIHtcbiAgcHJpdmF0ZSByZXF1ZXN0SWQ6IHN0cmluZztcbiAgcHJpdmF0ZSB1cmk6IHN0cmluZztcbiAgcHJpdmF0ZSBzdGFydFRpbWU6IG51bWJlcjtcbiAgcHJpdmF0ZSBtZXRyaWNzOiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICBwcml2YXRlIGRpbWVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG5cbiAgY29uc3RydWN0b3IocmVxdWVzdElkOiBzdHJpbmcsIHVyaTogc3RyaW5nKSB7XG4gICAgdGhpcy5yZXF1ZXN0SWQgPSByZXF1ZXN0SWQ7XG4gICAgdGhpcy51cmkgPSB1cmk7XG4gICAgdGhpcy5zdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMubWV0cmljcyA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLmRpbWVuc2lvbnMgPSB7XG4gICAgICBVcmk6IHVyaSxcbiAgICAgIEVudmlyb25tZW50OiBwcm9jZXNzLmVudi5FTlZJUk9OTUVOVCB8fCAncHJvZHVjdGlvbicsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgc3RydWN0dXJlZCBsb2cgZW50cnlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTG9nRW50cnkoXG4gICAgbGV2ZWw6IExvZ0xldmVsLFxuICAgIG1lc3NhZ2U6IHN0cmluZyxcbiAgICBleHRyYT86IFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICk6IExvZ0VudHJ5IHtcbiAgICByZXR1cm4ge1xuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBsZXZlbCxcbiAgICAgIHJlcXVlc3RJZDogdGhpcy5yZXF1ZXN0SWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgdXJpOiB0aGlzLnVyaSxcbiAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSB0aGlzLnN0YXJ0VGltZSxcbiAgICAgIC4uLmV4dHJhLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogTG9ncyBhIGRlYnVnIG1lc3NhZ2VcbiAgICovXG4gIGRlYnVnKG1lc3NhZ2U6IHN0cmluZywgZXh0cmE/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5jcmVhdGVMb2dFbnRyeShMb2dMZXZlbC5ERUJVRywgbWVzc2FnZSwgZXh0cmEpO1xuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGVudHJ5KSk7XG4gIH1cblxuICAvKipcbiAgICogTG9ncyBhbiBpbmZvIG1lc3NhZ2VcbiAgICovXG4gIGluZm8obWVzc2FnZTogc3RyaW5nLCBleHRyYT86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLmNyZWF0ZUxvZ0VudHJ5KExvZ0xldmVsLklORk8sIG1lc3NhZ2UsIGV4dHJhKTtcbiAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShlbnRyeSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZ3MgYSB3YXJuaW5nIG1lc3NhZ2VcbiAgICovXG4gIHdhcm4obWVzc2FnZTogc3RyaW5nLCBleHRyYT86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLmNyZWF0ZUxvZ0VudHJ5KExvZ0xldmVsLldBUk4sIG1lc3NhZ2UsIGV4dHJhKTtcbiAgICBjb25zb2xlLndhcm4oSlNPTi5zdHJpbmdpZnkoZW50cnkpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2dzIGFuIGVycm9yIG1lc3NhZ2VcbiAgICovXG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBFcnJvciB8IHVua25vd24sIGV4dHJhPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiB2b2lkIHtcbiAgICBjb25zdCBlcnJvckRldGFpbHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0geyAuLi5leHRyYSB9O1xuICAgIFxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBlcnJvckRldGFpbHMuZXJyb3JNZXNzYWdlID0gZXJyb3IubWVzc2FnZTtcbiAgICAgIGVycm9yRGV0YWlscy5lcnJvclN0YWNrID0gZXJyb3Iuc3RhY2s7XG4gICAgfSBlbHNlIGlmIChlcnJvcikge1xuICAgICAgZXJyb3JEZXRhaWxzLmVycm9yTWVzc2FnZSA9IFN0cmluZyhlcnJvcik7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5jcmVhdGVMb2dFbnRyeShMb2dMZXZlbC5FUlJPUiwgbWVzc2FnZSwgZXJyb3JEZXRhaWxzKTtcbiAgICBjb25zb2xlLmVycm9yKEpTT04uc3RyaW5naWZ5KGVudHJ5KSk7XG4gIH1cblxuICAvKipcbiAgICogUmVjb3JkcyBhIG1ldHJpYyB2YWx1ZVxuICAgKi9cbiAgcmVjb3JkTWV0cmljKG5hbWU6IE1ldHJpY05hbWUsIHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLm1ldHJpY3Muc2V0KG5hbWUsIHZhbHVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmNyZW1lbnRzIGEgY291bnRlciBtZXRyaWNcbiAgICovXG4gIGluY3JlbWVudENvdW50ZXIobmFtZTogTWV0cmljTmFtZSk6IHZvaWQge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLm1ldHJpY3MuZ2V0KG5hbWUpIHx8IDA7XG4gICAgdGhpcy5tZXRyaWNzLnNldChuYW1lLCBjdXJyZW50ICsgMSk7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBhIGRpbWVuc2lvbiBmb3IgbWV0cmljc1xuICAgKi9cbiAgc2V0RGltZW5zaW9uKGtleTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5kaW1lbnNpb25zW2tleV0gPSB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbWl0cyBhbGwgcmVjb3JkZWQgbWV0cmljcyBpbiBDbG91ZFdhdGNoIEVNRiBmb3JtYXRcbiAgICovXG4gIGVtaXRNZXRyaWNzKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLm1ldHJpY3Muc2l6ZSA9PT0gMCkgcmV0dXJuO1xuXG4gICAgY29uc3QgbWV0cmljc0FycmF5OiBBcnJheTx7IE5hbWU6IHN0cmluZzsgVW5pdDogc3RyaW5nIH0+ID0gW107XG4gICAgY29uc3QgbWV0cmljVmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG5cbiAgICB0aGlzLm1ldHJpY3MuZm9yRWFjaCgodmFsdWUsIG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IHVuaXQgPSBuYW1lLmluY2x1ZGVzKCdMYXRlbmN5JykgPyAnTWlsbGlzZWNvbmRzJyA6ICdDb3VudCc7XG4gICAgICBtZXRyaWNzQXJyYXkucHVzaCh7IE5hbWU6IG5hbWUsIFVuaXQ6IHVuaXQgfSk7XG4gICAgICBtZXRyaWNWYWx1ZXNbbmFtZV0gPSB2YWx1ZTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGVtZjogRU1GTWV0cmljID0ge1xuICAgICAgX2F3czoge1xuICAgICAgICBUaW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIENsb3VkV2F0Y2hNZXRyaWNzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgTmFtZXNwYWNlOiAnWDQwMi9QYXltZW50VmVyaWZpZXInLFxuICAgICAgICAgICAgRGltZW5zaW9uczogW09iamVjdC5rZXlzKHRoaXMuZGltZW5zaW9ucyldLFxuICAgICAgICAgICAgTWV0cmljczogbWV0cmljc0FycmF5LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgLi4udGhpcy5kaW1lbnNpb25zLFxuICAgICAgLi4ubWV0cmljVmFsdWVzLFxuICAgICAgcmVxdWVzdElkOiB0aGlzLnJlcXVlc3RJZCxcbiAgICB9O1xuXG4gICAgLy8gRU1GIGxvZ3MgbXVzdCBiZSBwcmludGVkIHRvIHN0ZG91dCBmb3IgQ2xvdWRXYXRjaCB0byBwYXJzZSB0aGVtXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoZW1mKSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBlbGFwc2VkIHRpbWUgc2luY2UgbG9nZ2VyIGNyZWF0aW9uXG4gICAqL1xuICBnZXRFbGFwc2VkTXMoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gRGF0ZS5ub3coKSAtIHRoaXMuc3RhcnRUaW1lO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgdW5pcXVlIHJlcXVlc3QgSUQgZm9yIHRyYWNpbmdcbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVSZXF1ZXN0SWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGByZXFfJHtEYXRlLm5vdygpLnRvU3RyaW5nKDM2KX1fJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMiwgOSl9YDtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8geDQwMiB2MiBUeXBlcyAtIGltcG9ydGVkIGZyb20gLi90eXBlc1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBGYWNpbGl0YXRvciBVUkwgZm9yIHBheW1lbnQgdmVyaWZpY2F0aW9uXG4vLyBOb3RlOiBMYW1iZGFARWRnZSBkb2Vzbid0IHN1cHBvcnQgZW52aXJvbm1lbnQgdmFyaWFibGVzLCBzbyB0aGlzIGlzIGJ1bmRsZWRcbi8vIFVzaW5nIHd3dyBzdWJkb21haW4gdG8gYXZvaWQgMzA4IHJlZGlyZWN0ICh4NDAyLm9yZyByZWRpcmVjdHMgdG8gd3d3Lng0MDIub3JnKVxuY29uc3QgRkFDSUxJVEFUT1JfVVJMID0gJ2h0dHBzOi8vd3d3Lng0MDIub3JnL2ZhY2lsaXRhdG9yJztcblxuLy8gU2VsbGVyIHdhbGxldCBhZGRyZXNzIGlzIGNvbmZpZ3VyZWQgaW4gY29udGVudC1jb25maWcudHMgKERFRkFVTFRfUEFZX1RPKVxuXG4vKipcbiAqIFZhbGlkYXRlcyB0aGUgc3RydWN0dXJlIG9mIGEgcGF5bWVudCBwYXlsb2FkXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlUGF5bG9hZFN0cnVjdHVyZShwYXlsb2FkOiB1bmtub3duKTogcGF5bG9hZCBpcyBQYXltZW50UGF5bG9hZCB7XG4gIGlmICghcGF5bG9hZCB8fCB0eXBlb2YgcGF5bG9hZCAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgXG4gIGNvbnN0IHAgPSBwYXlsb2FkIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBcbiAgLy8gQ2hlY2sgcmVxdWlyZWQgdG9wLWxldmVsIGZpZWxkc1xuICBpZiAodHlwZW9mIHAueDQwMlZlcnNpb24gIT09ICdudW1iZXInIHx8IHAueDQwMlZlcnNpb24gIT09IDIpIHJldHVybiBmYWxzZTtcbiAgaWYgKCFwLmFjY2VwdGVkIHx8IHR5cGVvZiBwLmFjY2VwdGVkICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBpZiAoIXAucGF5bG9hZCB8fCB0eXBlb2YgcC5wYXlsb2FkICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICBcbiAgLy8gQ2hlY2sgYWNjZXB0ZWQgcmVxdWlyZW1lbnRzXG4gIGNvbnN0IGFjY2VwdGVkID0gcC5hY2NlcHRlZCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgaWYgKHR5cGVvZiBhY2NlcHRlZC5zY2hlbWUgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgYWNjZXB0ZWQubmV0d29yayAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiBhY2NlcHRlZC5hbW91bnQgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgYWNjZXB0ZWQuYXNzZXQgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgYWNjZXB0ZWQucGF5VG8gIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gIFxuICAvLyBDaGVjayBwYXlsb2FkIChleGFjdCBFVk0gc2NoZW1lKVxuICBjb25zdCBwYXlsb2FkRGF0YSA9IHAucGF5bG9hZCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgaWYgKHR5cGVvZiBwYXlsb2FkRGF0YS5zaWduYXR1cmUgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gIGlmICghcGF5bG9hZERhdGEuYXV0aG9yaXphdGlvbiB8fCB0eXBlb2YgcGF5bG9hZERhdGEuYXV0aG9yaXphdGlvbiAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgXG4gIC8vIENoZWNrIGF1dGhvcml6YXRpb25cbiAgY29uc3QgYXV0aCA9IHBheWxvYWREYXRhLmF1dGhvcml6YXRpb24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIGlmICh0eXBlb2YgYXV0aC5mcm9tICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICBpZiAodHlwZW9mIGF1dGgudG8gIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgYXV0aC52YWx1ZSAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiBhdXRoLnZhbGlkQWZ0ZXIgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgYXV0aC52YWxpZEJlZm9yZSAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiBhdXRoLm5vbmNlICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICBcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoYXQgdGhlIHBheW1lbnQgYXV0aG9yaXphdGlvbiBtYXRjaGVzIHRoZSByZXF1aXJlbWVudHNcbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVBdXRob3JpemF0aW9uUGFyYW1ldGVycyhcbiAgcGF5bG9hZDogUGF5bWVudFBheWxvYWQsXG4gIHJlcXVpcmVtZW50czogUGF5bWVudFJlcXVpcmVtZW50c1xuKTogVmVyaWZ5UmVzcG9uc2Uge1xuICBjb25zdCB7IGF1dGhvcml6YXRpb24gfSA9IHBheWxvYWQucGF5bG9hZDtcbiAgY29uc3QgcGF5ZXIgPSBhdXRob3JpemF0aW9uLmZyb207XG4gIFxuICAvLyBWZXJpZnkgc2NoZW1lIG1hdGNoZXNcbiAgaWYgKHBheWxvYWQuYWNjZXB0ZWQuc2NoZW1lICE9PSByZXF1aXJlbWVudHMuc2NoZW1lKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlzVmFsaWQ6IGZhbHNlLFxuICAgICAgaW52YWxpZFJlYXNvbjogJ3NjaGVtZV9taXNtYXRjaCcsXG4gICAgICBwYXllcixcbiAgICB9O1xuICB9XG4gIFxuICAvLyBWZXJpZnkgbmV0d29yayBtYXRjaGVzXG4gIGlmIChwYXlsb2FkLmFjY2VwdGVkLm5ldHdvcmsgIT09IHJlcXVpcmVtZW50cy5uZXR3b3JrKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlzVmFsaWQ6IGZhbHNlLFxuICAgICAgaW52YWxpZFJlYXNvbjogJ25ldHdvcmtfbWlzbWF0Y2gnLFxuICAgICAgcGF5ZXIsXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gVmVyaWZ5IHJlY2lwaWVudCBtYXRjaGVzXG4gIGlmIChhdXRob3JpemF0aW9uLnRvLnRvTG93ZXJDYXNlKCkgIT09IHJlcXVpcmVtZW50cy5wYXlUby50b0xvd2VyQ2FzZSgpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlzVmFsaWQ6IGZhbHNlLFxuICAgICAgaW52YWxpZFJlYXNvbjogJ2ludmFsaWRfZXhhY3RfZXZtX3BheWxvYWRfcmVjaXBpZW50X21pc21hdGNoJyxcbiAgICAgIHBheWVyLFxuICAgIH07XG4gIH1cbiAgXG4gIC8vIFZlcmlmeSBhbW91bnQgaXMgc3VmZmljaWVudFxuICBjb25zdCBwYXltZW50VmFsdWUgPSBCaWdJbnQoYXV0aG9yaXphdGlvbi52YWx1ZSk7XG4gIGNvbnN0IHJlcXVpcmVkQW1vdW50ID0gQmlnSW50KHJlcXVpcmVtZW50cy5hbW91bnQpO1xuICBpZiAocGF5bWVudFZhbHVlIDwgcmVxdWlyZWRBbW91bnQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZmFsc2UsXG4gICAgICBpbnZhbGlkUmVhc29uOiAnaW52YWxpZF9leGFjdF9ldm1fcGF5bG9hZF9hdXRob3JpemF0aW9uX3ZhbHVlJyxcbiAgICAgIHBheWVyLFxuICAgIH07XG4gIH1cbiAgXG4gIC8vIFZlcmlmeSB0aW1lIHZhbGlkaXR5XG4gIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICBjb25zdCB2YWxpZEFmdGVyID0gcGFyc2VJbnQoYXV0aG9yaXphdGlvbi52YWxpZEFmdGVyLCAxMCk7XG4gIGNvbnN0IHZhbGlkQmVmb3JlID0gcGFyc2VJbnQoYXV0aG9yaXphdGlvbi52YWxpZEJlZm9yZSwgMTApO1xuICBcbiAgLy8gQ2hlY2sgdmFsaWRBZnRlciBpcyBub3QgaW4gdGhlIGZ1dHVyZVxuICBpZiAodmFsaWRBZnRlciA+IG5vdykge1xuICAgIHJldHVybiB7XG4gICAgICBpc1ZhbGlkOiBmYWxzZSxcbiAgICAgIGludmFsaWRSZWFzb246ICdpbnZhbGlkX2V4YWN0X2V2bV9wYXlsb2FkX2F1dGhvcml6YXRpb25fdmFsaWRfYWZ0ZXInLFxuICAgICAgcGF5ZXIsXG4gICAgfTtcbiAgfVxuICBcbiAgLy8gQ2hlY2sgdmFsaWRCZWZvcmUgaXMgaW4gdGhlIGZ1dHVyZSAod2l0aCA2IHNlY29uZCBidWZmZXIgZm9yIGJsb2NrIHRpbWUpXG4gIGlmICh2YWxpZEJlZm9yZSA8IG5vdyArIDYpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZmFsc2UsXG4gICAgICBpbnZhbGlkUmVhc29uOiAnaW52YWxpZF9leGFjdF9ldm1fcGF5bG9hZF9hdXRob3JpemF0aW9uX3ZhbGlkX2JlZm9yZScsXG4gICAgICBwYXllcixcbiAgICB9O1xuICB9XG4gIFxuICAvLyBWZXJpZnkgYXNzZXQgbWF0Y2hlc1xuICBpZiAocGF5bG9hZC5hY2NlcHRlZC5hc3NldC50b0xvd2VyQ2FzZSgpICE9PSByZXF1aXJlbWVudHMuYXNzZXQudG9Mb3dlckNhc2UoKSkge1xuICAgIHJldHVybiB7XG4gICAgICBpc1ZhbGlkOiBmYWxzZSxcbiAgICAgIGludmFsaWRSZWFzb246ICdhc3NldF9taXNtYXRjaCcsXG4gICAgICBwYXllcixcbiAgICB9O1xuICB9XG4gIFxuICAvLyBWZXJpZnkgc2lnbmF0dXJlIGZvcm1hdCAoc2hvdWxkIGJlIDY1IGJ5dGVzID0gMTMwIGhleCBjaGFycyArIDB4IHByZWZpeClcbiAgY29uc3Qgc2lnbmF0dXJlID0gcGF5bG9hZC5wYXlsb2FkLnNpZ25hdHVyZTtcbiAgaWYgKCFzaWduYXR1cmUuc3RhcnRzV2l0aCgnMHgnKSkge1xuICAgIHJldHVybiB7XG4gICAgICBpc1ZhbGlkOiBmYWxzZSxcbiAgICAgIGludmFsaWRSZWFzb246ICdpbnZhbGlkX3NpZ25hdHVyZV9mb3JtYXQnLFxuICAgICAgcGF5ZXIsXG4gICAgfTtcbiAgfVxuICBcbiAgY29uc3Qgc2lnbmF0dXJlTGVuZ3RoID0gc2lnbmF0dXJlLmxlbmd0aCAtIDI7IC8vIFJlbW92ZSAweCBwcmVmaXhcbiAgLy8gRU9BIHNpZ25hdHVyZXMgYXJlIDEzMCBjaGFycywgc21hcnQgd2FsbGV0IHNpZ25hdHVyZXMgY2FuIGJlIGxvbmdlclxuICBpZiAoc2lnbmF0dXJlTGVuZ3RoIDwgMTMwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlzVmFsaWQ6IGZhbHNlLFxuICAgICAgaW52YWxpZFJlYXNvbjogJ2ludmFsaWRfc2lnbmF0dXJlX2xlbmd0aCcsXG4gICAgICBwYXllcixcbiAgICB9O1xuICB9XG4gIFxuICAvLyBWZXJpZnkgbm9uY2UgZm9ybWF0IChzaG91bGQgYmUgMzIgYnl0ZXMgPSA2NCBoZXggY2hhcnMgKyAweCBwcmVmaXgpXG4gIGNvbnN0IG5vbmNlID0gYXV0aG9yaXphdGlvbi5ub25jZTtcbiAgaWYgKCFub25jZS5zdGFydHNXaXRoKCcweCcpIHx8IG5vbmNlLmxlbmd0aCAhPT0gNjYpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZmFsc2UsXG4gICAgICBpbnZhbGlkUmVhc29uOiAnaW52YWxpZF9ub25jZV9mb3JtYXQnLFxuICAgICAgcGF5ZXIsXG4gICAgfTtcbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBpc1ZhbGlkOiB0cnVlLFxuICAgIHBheWVyLFxuICB9O1xufVxuXG4vKipcbiAqIFZlcmlmaWVzIHRoZSBwYXltZW50IHNpZ25hdHVyZSB1c2luZyB0aGUgZmFjaWxpdGF0b3Igc2VydmljZVxuICogSW4gcHJvZHVjdGlvbiwgdGhpcyB3b3VsZCBjYWxsIHRoZSB4NDAyIGZhY2lsaXRhdG9yJ3MgL3ZlcmlmeSBlbmRwb2ludFxuICovXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlTaWduYXR1cmVXaXRoRmFjaWxpdGF0b3IoXG4gIHBheWxvYWQ6IFBheW1lbnRQYXlsb2FkLFxuICByZXF1aXJlbWVudHM6IFBheW1lbnRSZXF1aXJlbWVudHMsXG4gIGxvZ2dlcjogTG9nZ2VyXG4pOiBQcm9taXNlPFZlcmlmeVJlc3BvbnNlPiB7XG4gIGNvbnN0IHBheWVyID0gcGF5bG9hZC5wYXlsb2FkLmF1dGhvcml6YXRpb24uZnJvbTtcbiAgXG4gIHRyeSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdDYWxsaW5nIGZhY2lsaXRhdG9yIC92ZXJpZnkgZW5kcG9pbnQnLCB7XG4gICAgICBmYWNpbGl0YXRvclVybDogRkFDSUxJVEFUT1JfVVJMLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIENhbGwgZmFjaWxpdGF0b3IgL3ZlcmlmeSBlbmRwb2ludFxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7RkFDSUxJVEFUT1JfVVJMfS92ZXJpZnlgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHBheW1lbnRQYXlsb2FkOiBwYXlsb2FkLFxuICAgICAgICBwYXltZW50UmVxdWlyZW1lbnRzOiByZXF1aXJlbWVudHMsXG4gICAgICB9KSxcbiAgICB9KTtcbiAgICBcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICBsb2dnZXIud2FybignRmFjaWxpdGF0b3IgdmVyaWZ5IHJlcXVlc3QgZmFpbGVkJywge1xuICAgICAgICBzdGF0dXNDb2RlOiByZXNwb25zZS5zdGF0dXMsXG4gICAgICAgIHN0YXR1c1RleHQ6IHJlc3BvbnNlLnN0YXR1c1RleHQsXG4gICAgICB9KTtcbiAgICAgIGxvZ2dlci5pbmNyZW1lbnRDb3VudGVyKE1ldHJpY05hbWUuRkFDSUxJVEFUT1JfRVJST1IpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaXNWYWxpZDogZmFsc2UsXG4gICAgICAgIGludmFsaWRSZWFzb246ICdmYWNpbGl0YXRvcl92ZXJpZmljYXRpb25fZmFpbGVkJyxcbiAgICAgICAgcGF5ZXIsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCkgYXMgVmVyaWZ5UmVzcG9uc2U7XG4gICAgbG9nZ2VyLmRlYnVnKCdGYWNpbGl0YXRvciB2ZXJpZmljYXRpb24gcmVzcG9uc2UgcmVjZWl2ZWQnLCB7XG4gICAgICBpc1ZhbGlkOiByZXN1bHQuaXNWYWxpZCxcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ2dlci5lcnJvcignRXJyb3IgY2FsbGluZyBmYWNpbGl0YXRvcicsIGVycm9yLCB7XG4gICAgICBmYWNpbGl0YXRvclVybDogRkFDSUxJVEFUT1JfVVJMLFxuICAgIH0pO1xuICAgIGxvZ2dlci5pbmNyZW1lbnRDb3VudGVyKE1ldHJpY05hbWUuRkFDSUxJVEFUT1JfRVJST1IpO1xuICAgIC8vIEZhaWwgcHJvcGVybHkgLSBkb24ndCBhY2NlcHQgcGF5bWVudHMgaWYgZmFjaWxpdGF0b3IgaXMgdW5hdmFpbGFibGVcbiAgICBsb2dnZXIuZXJyb3IoJ0ZhY2lsaXRhdG9yIHVuYXZhaWxhYmxlIC0gcmVqZWN0aW5nIHBheW1lbnQgZm9yIHNhZmV0eScpO1xuICAgIHJldHVybiB7XG4gICAgICBpc1ZhbGlkOiBmYWxzZSxcbiAgICAgIGludmFsaWRSZWFzb246ICdmYWNpbGl0YXRvcl91bmF2YWlsYWJsZScsXG4gICAgICBwYXllcixcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogU2V0dGxlcyB0aGUgcGF5bWVudCB1c2luZyB0aGUgZmFjaWxpdGF0b3Igc2VydmljZVxuICovXG5hc3luYyBmdW5jdGlvbiBzZXR0bGVQYXltZW50V2l0aEZhY2lsaXRhdG9yKFxuICBwYXlsb2FkOiBQYXltZW50UGF5bG9hZCxcbiAgcmVxdWlyZW1lbnRzOiBQYXltZW50UmVxdWlyZW1lbnRzLFxuICBsb2dnZXI6IExvZ2dlclxuKTogUHJvbWlzZTxTZXR0bGVtZW50UmVzcG9uc2U+IHtcbiAgY29uc3QgcGF5ZXIgPSBwYXlsb2FkLnBheWxvYWQuYXV0aG9yaXphdGlvbi5mcm9tO1xuICBcbiAgdHJ5IHtcbiAgICBsb2dnZXIuZGVidWcoJ0NhbGxpbmcgZmFjaWxpdGF0b3IgL3NldHRsZSBlbmRwb2ludCcsIHtcbiAgICAgIGZhY2lsaXRhdG9yVXJsOiBGQUNJTElUQVRPUl9VUkwsXG4gICAgICBhbW91bnQ6IHJlcXVpcmVtZW50cy5hbW91bnQsXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtGQUNJTElUQVRPUl9VUkx9L3NldHRsZWAsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcGF5bWVudFBheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgIHBheW1lbnRSZXF1aXJlbWVudHM6IHJlcXVpcmVtZW50cyxcbiAgICAgIH0pLFxuICAgIH0pO1xuICAgIFxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGxvZ2dlci53YXJuKCdGYWNpbGl0YXRvciBzZXR0bGUgcmVxdWVzdCBmYWlsZWQnLCB7XG4gICAgICAgIHN0YXR1c0NvZGU6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogcmVzcG9uc2Uuc3RhdHVzVGV4dCxcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5GQUNJTElUQVRPUl9FUlJPUik7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgdHJhbnNhY3Rpb246ICcnLFxuICAgICAgICBuZXR3b3JrOiByZXF1aXJlbWVudHMubmV0d29yayxcbiAgICAgICAgcGF5ZXIsXG4gICAgICAgIGVycm9yUmVhc29uOiAnc2V0dGxlbWVudF9mYWlsZWQnLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpIGFzIFNldHRsZW1lbnRSZXNwb25zZTtcbiAgICBsb2dnZXIuZGVidWcoJ0ZhY2lsaXRhdG9yIHNldHRsZW1lbnQgcmVzcG9uc2UgcmVjZWl2ZWQnLCB7XG4gICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgIHRyYW5zYWN0aW9uOiByZXN1bHQudHJhbnNhY3Rpb24sXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXIuZXJyb3IoJ0Vycm9yIHNldHRsaW5nIHBheW1lbnQnLCBlcnJvciwge1xuICAgICAgZmFjaWxpdGF0b3JVcmw6IEZBQ0lMSVRBVE9SX1VSTCxcbiAgICB9KTtcbiAgICBsb2dnZXIuaW5jcmVtZW50Q291bnRlcihNZXRyaWNOYW1lLkZBQ0lMSVRBVE9SX0VSUk9SKTtcbiAgICAvLyBGYWlsIHByb3Blcmx5IC0gZG9uJ3QgZmFrZSBzZXR0bGVtZW50c1xuICAgIGxvZ2dlci5lcnJvcignRmFjaWxpdGF0b3IgdW5hdmFpbGFibGUgLSBzZXR0bGVtZW50IGZhaWxlZCcpO1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIHRyYW5zYWN0aW9uOiAnJyxcbiAgICAgIG5ldHdvcms6IHJlcXVpcmVtZW50cy5uZXR3b3JrLFxuICAgICAgcGF5ZXIsXG4gICAgICBlcnJvclJlYXNvbjogJ2ZhY2lsaXRhdG9yX3VuYXZhaWxhYmxlJyxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIDQwMiBQYXltZW50IFJlcXVpcmVkIHJlc3BvbnNlXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZTQwMlJlc3BvbnNlKFxuICB1cmk6IHN0cmluZyxcbiAgcmVxdWlyZW1lbnRzOiBQYXltZW50UmVxdWlyZW1lbnRzLFxuICBlcnJvck1lc3NhZ2U/OiBzdHJpbmdcbik6IENsb3VkRnJvbnRSZXF1ZXN0UmVzdWx0IHtcbiAgY29uc3QgcGF5bWVudFJlcXVpcmVkOiBQYXltZW50UmVxdWlyZWQgPSB7XG4gICAgeDQwMlZlcnNpb246IDIsXG4gICAgZXJyb3I6IGVycm9yTWVzc2FnZSB8fCAnUGF5bWVudCByZXF1aXJlZCB0byBhY2Nlc3MgdGhpcyByZXNvdXJjZScsXG4gICAgcmVzb3VyY2U6IHtcbiAgICAgIHVybDogdXJpLFxuICAgICAgZGVzY3JpcHRpb246IGBQcm90ZWN0ZWQgcmVzb3VyY2UgYXQgJHt1cml9YCxcbiAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgfSxcbiAgICBhY2NlcHRzOiBbcmVxdWlyZW1lbnRzXSxcbiAgICBleHRlbnNpb25zOiB7fSxcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIHN0YXR1czogJzQwMicsXG4gICAgc3RhdHVzRGVzY3JpcHRpb246ICdQYXltZW50IFJlcXVpcmVkJyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnY29udGVudC10eXBlJzogW3sga2V5OiAnQ29udGVudC1UeXBlJywgdmFsdWU6ICdhcHBsaWNhdGlvbi9qc29uJyB9XSxcbiAgICAgICd4LXBheW1lbnQtcmVxdWlyZWQnOiBbe1xuICAgICAgICBrZXk6ICdYLVBBWU1FTlQtUkVRVUlSRUQnLFxuICAgICAgICB2YWx1ZTogQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkocGF5bWVudFJlcXVpcmVkKSkudG9TdHJpbmcoJ2Jhc2U2NCcpLFxuICAgICAgfV0sXG4gICAgICAnYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luJzogW3sga2V5OiAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgdmFsdWU6ICcqJyB9XSxcbiAgICAgICdhY2Nlc3MtY29udHJvbC1hbGxvdy1oZWFkZXJzJzogW3sgXG4gICAgICAgIGtleTogJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnLCBcbiAgICAgICAgdmFsdWU6ICdDb250ZW50LVR5cGUsIFgtUGF5bWVudC1TaWduYXR1cmUnIFxuICAgICAgfV0sXG4gICAgICAnYWNjZXNzLWNvbnRyb2wtZXhwb3NlLWhlYWRlcnMnOiBbe1xuICAgICAgICBrZXk6ICdBY2Nlc3MtQ29udHJvbC1FeHBvc2UtSGVhZGVycycsXG4gICAgICAgIHZhbHVlOiAnWC1QQVlNRU5ULVJFUVVJUkVELCBYLVBBWU1FTlQtUkVTUE9OU0UnLFxuICAgICAgfV0sXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBlcnJvcjogJ1BheW1lbnQgUmVxdWlyZWQnLFxuICAgICAgbWVzc2FnZTogZXJyb3JNZXNzYWdlIHx8ICdUaGlzIGNvbnRlbnQgcmVxdWlyZXMgcGF5bWVudCB0byBhY2Nlc3MnLFxuICAgICAgeDQwMlZlcnNpb246IDIsXG4gICAgfSksXG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBlcnJvciByZXNwb25zZVxuICovXG5mdW5jdGlvbiBjcmVhdGVFcnJvclJlc3BvbnNlKFxuICBzdGF0dXM6IHN0cmluZyxcbiAgc3RhdHVzRGVzY3JpcHRpb246IHN0cmluZyxcbiAgZXJyb3I6IHN0cmluZyxcbiAgbWVzc2FnZTogc3RyaW5nXG4pOiBDbG91ZEZyb250UmVxdWVzdFJlc3VsdCB7XG4gIHJldHVybiB7XG4gICAgc3RhdHVzLFxuICAgIHN0YXR1c0Rlc2NyaXB0aW9uLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdjb250ZW50LXR5cGUnOiBbeyBrZXk6ICdDb250ZW50LVR5cGUnLCB2YWx1ZTogJ2FwcGxpY2F0aW9uL2pzb24nIH1dLFxuICAgICAgJ2FjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpbic6IFt7IGtleTogJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsIHZhbHVlOiAnKicgfV0sXG4gICAgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yLCBtZXNzYWdlIH0pLFxuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgTUNQIHRvb2wgZGlzY292ZXJ5IHJlc3BvbnNlXG4gKiBSZXR1cm5zIGFsbCBhdmFpbGFibGUgc2VydmljZXMgd2l0aCB0aGVpciBwcmljaW5nIGFuZCBtZXRhZGF0YVxuICovXG5mdW5jdGlvbiBjcmVhdGVNQ1BEaXNjb3ZlcnlSZXNwb25zZShyZXF1ZXN0SWQ6IHN0cmluZyk6IENsb3VkRnJvbnRSZXF1ZXN0UmVzdWx0IHtcbiAgY29uc3QgdG9vbHMgPSBbXTtcbiAgXG4gIC8vIEdldCBhbGwgY29udGVudCBpdGVtcyBmcm9tIHRoZSByZWdpc3RyeVxuICBjb25zdCBwYXRocyA9IGNvbnRlbnRNYW5hZ2VyLmxpc3RDb250ZW50UGF0aHMoKTtcbiAgXG4gIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocykge1xuICAgIC8vIE9ubHkgZXhwb3NlIC9hcGkvIHByZWZpeGVkIHBhdGhzIChyb290IHBhdGhzIGFyZSBkdXBsaWNhdGVzKVxuICAgIGlmICghcGF0aC5zdGFydHNXaXRoKCcvYXBpLycpKSBjb250aW51ZTtcbiAgICBjb25zdCBpdGVtID0gY29udGVudE1hbmFnZXIuZ2V0Q29udGVudEl0ZW0ocGF0aCk7XG4gICAgaWYgKCFpdGVtKSBjb250aW51ZTtcbiAgICBcbiAgICAvLyBDb252ZXJ0IHBhdGggdG8gdG9vbCBuYW1lOiAvYXBpL3ByZW1pdW0tYXJ0aWNsZSAtPiBnZXRfcHJlbWl1bV9hcnRpY2xlXG4gICAgY29uc3QgdG9vbE5hbWUgPSAnZ2V0XycgKyBwYXRoLnJlcGxhY2UoJy9hcGkvJywgJycpLnJlcGxhY2UoLy0vZywgJ18nKTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgZGlzcGxheSBwcmljZSAoVVNEQyBoYXMgNiBkZWNpbWFscylcbiAgICBjb25zdCBhbW91bnRVbml0cyA9IHBhcnNlSW50KGl0ZW0ucHJpY2luZy5hbW91bnQsIDEwKTtcbiAgICBjb25zdCBkaXNwbGF5UHJpY2UgPSAoYW1vdW50VW5pdHMgLyAxMDAwMDAwKS50b0ZpeGVkKDYpLnJlcGxhY2UoL1xcLj8wKyQvLCAnJyk7XG4gICAgXG4gICAgdG9vbHMucHVzaCh7XG4gICAgICB0b29sX25hbWU6IHRvb2xOYW1lLFxuICAgICAgdG9vbF9kZXNjcmlwdGlvbjogYCR7aXRlbS5kZXNjcmlwdGlvbn0uIFJlcXVpcmVzIHg0MDIgcGF5bWVudDogJHtpdGVtLnByaWNpbmcuYW1vdW50fSBVU0RDIHVuaXRzICgke2Rpc3BsYXlQcmljZX0gVVNEQykgb24gQmFzZSBTZXBvbGlhIHRlc3RuZXQuYCxcbiAgICAgIG9wZXJhdGlvbl9pZDogdG9vbE5hbWUsXG4gICAgICBlbmRwb2ludF9wYXRoOiBwYXRoLFxuICAgICAgbWNwX21ldGFkYXRhOiB7XG4gICAgICAgIGNhdGVnb3J5OiBwYXRoLmluY2x1ZGVzKCdtYXJrZXQnKSB8fCBwYXRoLmluY2x1ZGVzKCd3ZWF0aGVyJykgPyAnbWFya2V0LWRhdGEnIDogXG4gICAgICAgICAgICAgICAgICBwYXRoLmluY2x1ZGVzKCdyZXNlYXJjaCcpIHx8IHBhdGguaW5jbHVkZXMoJ2RhdGFzZXQnKSA/ICdyZXNlYXJjaCcgOiAnY29udGVudCcsXG4gICAgICAgIHRhZ3M6IFsneDQwMi1wYXltZW50JywgJ3ByZW1pdW0tY29udGVudCddLFxuICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgcmVxdWlyZXNfcGF5bWVudDogdHJ1ZSxcbiAgICAgICAgZXN0aW1hdGVkX2xhdGVuY3lfbXM6IDIwMDAsXG4gICAgICB9LFxuICAgICAgeDQwMl9tZXRhZGF0YToge1xuICAgICAgICBwcmljZV91c2RjX3VuaXRzOiBpdGVtLnByaWNpbmcuYW1vdW50LFxuICAgICAgICBwcmljZV91c2RjX2Rpc3BsYXk6IGAke2Rpc3BsYXlQcmljZX0gVVNEQ2AsXG4gICAgICAgIG5ldHdvcms6IGl0ZW0ucHJpY2luZy5uZXR3b3JrLFxuICAgICAgICBuZXR3b3JrX25hbWU6ICdCYXNlIFNlcG9saWEnLFxuICAgICAgICBzY2hlbWU6IGl0ZW0ucHJpY2luZy5zY2hlbWUsXG4gICAgICAgIGFzc2V0X2FkZHJlc3M6IGl0ZW0ucHJpY2luZy5hc3NldCxcbiAgICAgICAgYXNzZXRfbmFtZTogJ1VTREMnLFxuICAgICAgICB0aW1lb3V0X3NlY29uZHM6IGl0ZW0ucHJpY2luZy5tYXhUaW1lb3V0U2Vjb25kcyxcbiAgICAgIH0sXG4gICAgICBpbnB1dF9zY2hlbWE6IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgICByZXF1aXJlZDogW10sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTm8gaW5wdXQgcGFyYW1ldGVycyByZXF1aXJlZC4gUGF5bWVudCBpcyBoYW5kbGVkIHZpYSB4NDAyIGhlYWRlcnMuJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgXG4gIGNvbnN0IHJlc3BvbnNlID0ge1xuICAgIHZlcnNpb246ICcxLjAnLFxuICAgIHRvb2xzLFxuICAgIG1ldGFkYXRhOiB7XG4gICAgICBnYXRld2F5OiAneDQwMi1zZWxsZXItZ2F0ZXdheScsXG4gICAgICBwcm90b2NvbDogJ3g0MDItdjInLFxuICAgICAgbmV0d29yazogJ2Jhc2Utc2Vwb2xpYScsXG4gICAgICB0b3RhbF9zZXJ2aWNlczogdG9vbHMubGVuZ3RoLFxuICAgIH0sXG4gIH07XG4gIFxuICByZXR1cm4ge1xuICAgIHN0YXR1czogJzIwMCcsXG4gICAgc3RhdHVzRGVzY3JpcHRpb246ICdPSycsXG4gICAgaGVhZGVyczoge1xuICAgICAgJ2NvbnRlbnQtdHlwZSc6IFt7IGtleTogJ0NvbnRlbnQtVHlwZScsIHZhbHVlOiAnYXBwbGljYXRpb24vanNvbicgfV0sXG4gICAgICAneC1yZXF1ZXN0LWlkJzogW3sga2V5OiAnWC1SZXF1ZXN0LUlkJywgdmFsdWU6IHJlcXVlc3RJZCB9XSxcbiAgICAgICdhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW4nOiBbeyBrZXk6ICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCB2YWx1ZTogJyonIH1dLFxuICAgICAgJ2FjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnMnOiBbeyBcbiAgICAgICAga2V5OiAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsIFxuICAgICAgICB2YWx1ZTogJ0NvbnRlbnQtVHlwZSwgQWNjZXB0JyBcbiAgICAgIH1dLFxuICAgICAgJ2NhY2hlLWNvbnRyb2wnOiBbeyBrZXk6ICdDYWNoZS1Db250cm9sJywgdmFsdWU6ICdwdWJsaWMsIG1heC1hZ2U9MzAwJyB9XSxcbiAgICB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlKSxcbiAgfTtcbn1cblxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoXG4gIGV2ZW50OiBDbG91ZEZyb250UmVxdWVzdEV2ZW50XG4pOiBQcm9taXNlPENsb3VkRnJvbnRSZXF1ZXN0UmVzdWx0PiA9PiB7XG4gIGNvbnN0IHJlcXVlc3QgPSBldmVudC5SZWNvcmRzWzBdLmNmLnJlcXVlc3Q7XG4gIGNvbnN0IHVyaSA9IHJlcXVlc3QudXJpO1xuXG4gIC8vIEV4dHJhY3QgUzMgYnVja2V0IG5hbWUgZnJvbSBDbG91ZEZyb250IG9yaWdpbiBjb25maWcgKGF2b2lkcyBoYXJkY29kaW5nKVxuICBjb25zdCBvcmlnaW5Eb21haW4gPSAocmVxdWVzdC5vcmlnaW4gYXMgYW55KT8uczM/LmRvbWFpbk5hbWUgfHwgJyc7XG4gIGlmIChvcmlnaW5Eb21haW4pIHtcbiAgICBzZXRDb250ZW50QnVja2V0KG9yaWdpbkRvbWFpbi5zcGxpdCgnLnMzJylbMF0pO1xuICB9XG4gIFxuICAvLyBJbml0aWFsaXplIGxvZ2dlciB3aXRoIHJlcXVlc3QgSUQgZm9yIHRyYWNpbmdcbiAgY29uc3QgcmVxdWVzdElkID0gZ2VuZXJhdGVSZXF1ZXN0SWQoKTtcbiAgY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcihyZXF1ZXN0SWQsIHVyaSk7XG4gIFxuICAvLyBSZWNvcmQgcmVxdWVzdCBtZXRyaWNcbiAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5SRVFVRVNUX0NPVU5UKTtcbiAgbG9nZ2VyLmluZm8oJ1Byb2Nlc3NpbmcgcmVxdWVzdCcsIHsgbWV0aG9kOiByZXF1ZXN0Lm1ldGhvZCB9KTtcblxuICB0cnkge1xuICAgIC8vIEhhbmRsZSBNQ1AgZGlzY292ZXJ5IGVuZHBvaW50IChubyBwYXltZW50IHJlcXVpcmVkKVxuICAgIGlmICh1cmkgPT09ICcvbWNwL3Rvb2xzJykge1xuICAgICAgbG9nZ2VyLmluZm8oJ01DUCBkaXNjb3ZlcnkgcmVxdWVzdCcpO1xuICAgICAgbG9nZ2VyLnJlY29yZE1ldHJpYyhNZXRyaWNOYW1lLkxBVEVOQ1ksIGxvZ2dlci5nZXRFbGFwc2VkTXMoKSk7XG4gICAgICBsb2dnZXIuZW1pdE1ldHJpY3MoKTtcbiAgICAgIHJldHVybiBjcmVhdGVNQ1BEaXNjb3ZlcnlSZXNwb25zZShyZXF1ZXN0SWQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDaGVjayBpZiB0aGlzIHBhdGggcmVxdWlyZXMgcGF5bWVudCB1c2luZyBkeW5hbWljIGNvbnRlbnQgbWFuYWdlclxuICAgIGNvbnN0IHBheW1lbnRSZXF1aXJlbWVudCA9IGNvbnRlbnRNYW5hZ2VyLmdldFBheW1lbnRSZXF1aXJlbWVudHModXJpKTtcbiAgICBcbiAgICBpZiAoIXBheW1lbnRSZXF1aXJlbWVudCkge1xuICAgICAgLy8gTm8gcGF5bWVudCByZXF1aXJlZCBmb3IgdGhpcyBwYXRoXG4gICAgICBsb2dnZXIuZGVidWcoJ05vIHBheW1lbnQgcmVxdWlyZWQgZm9yIHBhdGgnKTtcbiAgICAgIGxvZ2dlci5yZWNvcmRNZXRyaWMoTWV0cmljTmFtZS5MQVRFTkNZLCBsb2dnZXIuZ2V0RWxhcHNlZE1zKCkpO1xuICAgICAgbG9nZ2VyLmVtaXRNZXRyaWNzKCk7XG4gICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICB9XG5cbiAgICBsb2dnZXIuc2V0RGltZW5zaW9uKCdOZXR3b3JrJywgcGF5bWVudFJlcXVpcmVtZW50Lm5ldHdvcmspO1xuICAgIGxvZ2dlci5zZXREaW1lbnNpb24oJ0Fzc2V0JywgcGF5bWVudFJlcXVpcmVtZW50LmFzc2V0KTtcblxuICAgIC8vIENoZWNrIGZvciBwYXltZW50IHNpZ25hdHVyZSBoZWFkZXIgKHg0MDIgdjIgdXNlcyBYLVBBWU1FTlQtU0lHTkFUVVJFKVxuICAgIGNvbnN0IHBheW1lbnRTaWduYXR1cmVIZWFkZXIgPSBcbiAgICAgIHJlcXVlc3QuaGVhZGVyc1sneC1wYXltZW50LXNpZ25hdHVyZSddIHx8IFxuICAgICAgcmVxdWVzdC5oZWFkZXJzWydwYXltZW50LXNpZ25hdHVyZSddO1xuICAgIFxuICAgIGlmICghcGF5bWVudFNpZ25hdHVyZUhlYWRlciB8fCAhcGF5bWVudFNpZ25hdHVyZUhlYWRlclswXSkge1xuICAgICAgLy8gTm8gcGF5bWVudCBwcm92aWRlZCAtIHJldHVybiA0MDIgUGF5bWVudCBSZXF1aXJlZFxuICAgICAgbG9nZ2VyLmluZm8oJ05vIHBheW1lbnQgc2lnbmF0dXJlIGZvdW5kLCByZXR1cm5pbmcgNDAyJywge1xuICAgICAgICByZXF1aXJlZEFtb3VudDogcGF5bWVudFJlcXVpcmVtZW50LmFtb3VudCxcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5QQVlNRU5UX1JFUVVJUkVEKTtcbiAgICAgIGxvZ2dlci5yZWNvcmRNZXRyaWMoTWV0cmljTmFtZS5MQVRFTkNZLCBsb2dnZXIuZ2V0RWxhcHNlZE1zKCkpO1xuICAgICAgbG9nZ2VyLmVtaXRNZXRyaWNzKCk7XG4gICAgICByZXR1cm4gY3JlYXRlNDAyUmVzcG9uc2UodXJpLCBwYXltZW50UmVxdWlyZW1lbnQpO1xuICAgIH1cblxuICAgIC8vIFBheW1lbnQgc2lnbmF0dXJlIHByZXNlbnRcbiAgICBsb2dnZXIuaW5jcmVtZW50Q291bnRlcihNZXRyaWNOYW1lLlBBWU1FTlRfUkVDRUlWRUQpO1xuXG4gICAgLy8gRGVjb2RlIGFuZCB2ZXJpZnkgcGF5bWVudFxuICAgIGNvbnN0IHBheW1lbnRQYXlsb2FkQmFzZTY0ID0gcGF5bWVudFNpZ25hdHVyZUhlYWRlclswXS52YWx1ZTtcbiAgICBsZXQgcGF5bWVudFBheWxvYWQ6IHVua25vd247XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIHBheW1lbnRQYXlsb2FkID0gSlNPTi5wYXJzZShcbiAgICAgICAgQnVmZmVyLmZyb20ocGF5bWVudFBheWxvYWRCYXNlNjQsICdiYXNlNjQnKS50b1N0cmluZygndXRmLTgnKVxuICAgICAgKTtcbiAgICB9IGNhdGNoIChkZWNvZGVFcnJvcikge1xuICAgICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byBkZWNvZGUgcGF5bWVudCBwYXlsb2FkJywge1xuICAgICAgICBlcnJvckNvZGU6ICdERUNPREVfRVJST1InLFxuICAgICAgfSk7XG4gICAgICBsb2dnZXIuaW5jcmVtZW50Q291bnRlcihNZXRyaWNOYW1lLlZBTElEQVRJT05fRVJST1IpO1xuICAgICAgbG9nZ2VyLnJlY29yZE1ldHJpYyhNZXRyaWNOYW1lLkxBVEVOQ1ksIGxvZ2dlci5nZXRFbGFwc2VkTXMoKSk7XG4gICAgICBsb2dnZXIuZW1pdE1ldHJpY3MoKTtcbiAgICAgIHJldHVybiBjcmVhdGU0MDJSZXNwb25zZShcbiAgICAgICAgdXJpLCBcbiAgICAgICAgcGF5bWVudFJlcXVpcmVtZW50LCBcbiAgICAgICAgJ0ludmFsaWQgcGF5bWVudCBwYXlsb2FkIGVuY29kaW5nJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBsb2dnZXIuZGVidWcoJ1BheW1lbnQgcGF5bG9hZCBkZWNvZGVkIHN1Y2Nlc3NmdWxseScpO1xuXG4gICAgLy8gVmFsaWRhdGUgcGF5bG9hZCBzdHJ1Y3R1cmVcbiAgICBpZiAoIXZhbGlkYXRlUGF5bG9hZFN0cnVjdHVyZShwYXltZW50UGF5bG9hZCkpIHtcbiAgICAgIGxvZ2dlci53YXJuKCdJbnZhbGlkIHBheW1lbnQgcGF5bG9hZCBzdHJ1Y3R1cmUnLCB7XG4gICAgICAgIGVycm9yQ29kZTogJ0lOVkFMSURfU1RSVUNUVVJFJyxcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5WQUxJREFUSU9OX0VSUk9SKTtcbiAgICAgIGxvZ2dlci5yZWNvcmRNZXRyaWMoTWV0cmljTmFtZS5MQVRFTkNZLCBsb2dnZXIuZ2V0RWxhcHNlZE1zKCkpO1xuICAgICAgbG9nZ2VyLmVtaXRNZXRyaWNzKCk7XG4gICAgICByZXR1cm4gY3JlYXRlRXJyb3JSZXNwb25zZShcbiAgICAgICAgJzQwMCcsXG4gICAgICAgICdCYWQgUmVxdWVzdCcsXG4gICAgICAgICdJbnZhbGlkIFBheW1lbnQnLFxuICAgICAgICAnUGF5bWVudCBwYXlsb2FkIHN0cnVjdHVyZSBpcyBpbnZhbGlkJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBFeHRyYWN0IHBheWVyIGFkZHJlc3MgZm9yIGxvZ2dpbmdcbiAgICBjb25zdCBwYXllciA9IHBheW1lbnRQYXlsb2FkLnBheWxvYWQuYXV0aG9yaXphdGlvbi5mcm9tO1xuICAgIGxvZ2dlci5zZXREaW1lbnNpb24oJ1BheWVyJywgcGF5ZXIuc3Vic3RyaW5nKDAsIDEwKSArICcuLi4nKTtcbiAgICBsb2dnZXIuaW5mbygnUGF5bWVudCBwYXlsb2FkIHZhbGlkYXRlZCcsIHtcbiAgICAgIHBheWVyLFxuICAgICAgYW1vdW50OiBwYXltZW50UGF5bG9hZC5hY2NlcHRlZC5hbW91bnQsXG4gICAgICBzY2hlbWU6IHBheW1lbnRQYXlsb2FkLmFjY2VwdGVkLnNjaGVtZSxcbiAgICB9KTtcblxuICAgIC8vIFZhbGlkYXRlIGF1dGhvcml6YXRpb24gcGFyYW1ldGVyc1xuICAgIGNvbnN0IHBhcmFtVmFsaWRhdGlvbiA9IHZhbGlkYXRlQXV0aG9yaXphdGlvblBhcmFtZXRlcnMoXG4gICAgICBwYXltZW50UGF5bG9hZCxcbiAgICAgIHBheW1lbnRSZXF1aXJlbWVudFxuICAgICk7XG4gICAgXG4gICAgaWYgKCFwYXJhbVZhbGlkYXRpb24uaXNWYWxpZCkge1xuICAgICAgbG9nZ2VyLndhcm4oJ1BheW1lbnQgcGFyYW1ldGVyIHZhbGlkYXRpb24gZmFpbGVkJywge1xuICAgICAgICBlcnJvckNvZGU6IHBhcmFtVmFsaWRhdGlvbi5pbnZhbGlkUmVhc29uLFxuICAgICAgICBwYXllcixcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5WQUxJREFUSU9OX0VSUk9SKTtcbiAgICAgIFxuICAgICAgLy8gUmVjb3JkIHNwZWNpZmljIHZhbGlkYXRpb24gZXJyb3IgbWV0cmljc1xuICAgICAgc3dpdGNoIChwYXJhbVZhbGlkYXRpb24uaW52YWxpZFJlYXNvbikge1xuICAgICAgICBjYXNlICdpbnZhbGlkX2V4YWN0X2V2bV9wYXlsb2FkX2F1dGhvcml6YXRpb25fdmFsaWRfYmVmb3JlJzpcbiAgICAgICAgY2FzZSAnaW52YWxpZF9leGFjdF9ldm1fcGF5bG9hZF9hdXRob3JpemF0aW9uX3ZhbGlkX2FmdGVyJzpcbiAgICAgICAgICBsb2dnZXIuaW5jcmVtZW50Q291bnRlcihNZXRyaWNOYW1lLkFVVEhPUklaQVRJT05fRVhQSVJFRCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2ludmFsaWRfc2lnbmF0dXJlX2Zvcm1hdCc6XG4gICAgICAgIGNhc2UgJ2ludmFsaWRfc2lnbmF0dXJlX2xlbmd0aCc6XG4gICAgICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5TSUdOQVRVUkVfSU5WQUxJRCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2ludmFsaWRfZXhhY3RfZXZtX3BheWxvYWRfYXV0aG9yaXphdGlvbl92YWx1ZSc6XG4gICAgICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5BTU9VTlRfSU5TVUZGSUNJRU5UKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbmV0d29ya19taXNtYXRjaCc6XG4gICAgICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5ORVRXT1JLX01JU01BVENIKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYXNzZXRfbWlzbWF0Y2gnOlxuICAgICAgICAgIGxvZ2dlci5pbmNyZW1lbnRDb3VudGVyKE1ldHJpY05hbWUuQVNTRVRfTUlTTUFUQ0gpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgXG4gICAgICBsb2dnZXIucmVjb3JkTWV0cmljKE1ldHJpY05hbWUuTEFURU5DWSwgbG9nZ2VyLmdldEVsYXBzZWRNcygpKTtcbiAgICAgIGxvZ2dlci5lbWl0TWV0cmljcygpO1xuICAgICAgcmV0dXJuIGNyZWF0ZTQwMlJlc3BvbnNlKFxuICAgICAgICB1cmksXG4gICAgICAgIHBheW1lbnRSZXF1aXJlbWVudCxcbiAgICAgICAgYFBheW1lbnQgdmFsaWRhdGlvbiBmYWlsZWQ6ICR7cGFyYW1WYWxpZGF0aW9uLmludmFsaWRSZWFzb259YFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBsb2dnZXIuZGVidWcoJ0F1dGhvcml6YXRpb24gcGFyYW1ldGVycyB2YWxpZGF0ZWQnKTtcblxuICAgIC8vIFZlcmlmeSBzaWduYXR1cmUgd2l0aCBmYWNpbGl0YXRvclxuICAgIGNvbnN0IHZlcmlmaWNhdGlvblN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc3Qgc2lnbmF0dXJlVmFsaWRhdGlvbiA9IGF3YWl0IHZlcmlmeVNpZ25hdHVyZVdpdGhGYWNpbGl0YXRvcihcbiAgICAgIHBheW1lbnRQYXlsb2FkLFxuICAgICAgcGF5bWVudFJlcXVpcmVtZW50LFxuICAgICAgbG9nZ2VyXG4gICAgKTtcbiAgICBsb2dnZXIucmVjb3JkTWV0cmljKE1ldHJpY05hbWUuVkVSSUZJQ0FUSU9OX0xBVEVOQ1ksIERhdGUubm93KCkgLSB2ZXJpZmljYXRpb25TdGFydFRpbWUpO1xuICAgIFxuICAgIGlmICghc2lnbmF0dXJlVmFsaWRhdGlvbi5pc1ZhbGlkKSB7XG4gICAgICBsb2dnZXIud2FybignU2lnbmF0dXJlIHZlcmlmaWNhdGlvbiBmYWlsZWQnLCB7XG4gICAgICAgIGVycm9yQ29kZTogc2lnbmF0dXJlVmFsaWRhdGlvbi5pbnZhbGlkUmVhc29uLFxuICAgICAgICBwYXllcixcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5QQVlNRU5UX0ZBSUxFRCk7XG4gICAgICBsb2dnZXIucmVjb3JkTWV0cmljKE1ldHJpY05hbWUuTEFURU5DWSwgbG9nZ2VyLmdldEVsYXBzZWRNcygpKTtcbiAgICAgIGxvZ2dlci5lbWl0TWV0cmljcygpO1xuICAgICAgcmV0dXJuIGNyZWF0ZTQwMlJlc3BvbnNlKFxuICAgICAgICB1cmksXG4gICAgICAgIHBheW1lbnRSZXF1aXJlbWVudCxcbiAgICAgICAgYFNpZ25hdHVyZSB2ZXJpZmljYXRpb24gZmFpbGVkOiAke3NpZ25hdHVyZVZhbGlkYXRpb24uaW52YWxpZFJlYXNvbn1gXG4gICAgICApO1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmNyZW1lbnRDb3VudGVyKE1ldHJpY05hbWUuUEFZTUVOVF9WRVJJRklFRCk7XG4gICAgbG9nZ2VyLmluZm8oJ1BheW1lbnQgc2lnbmF0dXJlIHZlcmlmaWVkJywgeyBwYXllciB9KTtcblxuICAgIC8vIFNldHRsZSBwYXltZW50IHdpdGggZmFjaWxpdGF0b3JcbiAgICBjb25zdCBzZXR0bGVtZW50U3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBzZXR0bGVtZW50ID0gYXdhaXQgc2V0dGxlUGF5bWVudFdpdGhGYWNpbGl0YXRvcihcbiAgICAgIHBheW1lbnRQYXlsb2FkLFxuICAgICAgcGF5bWVudFJlcXVpcmVtZW50LFxuICAgICAgbG9nZ2VyXG4gICAgKTtcbiAgICBsb2dnZXIucmVjb3JkTWV0cmljKE1ldHJpY05hbWUuU0VUVExFTUVOVF9MQVRFTkNZLCBEYXRlLm5vdygpIC0gc2V0dGxlbWVudFN0YXJ0VGltZSk7XG4gICAgXG4gICAgaWYgKCFzZXR0bGVtZW50LnN1Y2Nlc3MpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignUGF5bWVudCBzZXR0bGVtZW50IGZhaWxlZCcsIHVuZGVmaW5lZCwge1xuICAgICAgICBlcnJvckNvZGU6IHNldHRsZW1lbnQuZXJyb3JSZWFzb24sXG4gICAgICAgIHBheWVyLFxuICAgICAgfSk7XG4gICAgICBsb2dnZXIuaW5jcmVtZW50Q291bnRlcihNZXRyaWNOYW1lLlBBWU1FTlRfRkFJTEVEKTtcbiAgICAgIGxvZ2dlci5yZWNvcmRNZXRyaWMoTWV0cmljTmFtZS5MQVRFTkNZLCBsb2dnZXIuZ2V0RWxhcHNlZE1zKCkpO1xuICAgICAgbG9nZ2VyLmVtaXRNZXRyaWNzKCk7XG4gICAgICByZXR1cm4gY3JlYXRlRXJyb3JSZXNwb25zZShcbiAgICAgICAgJzQwMicsXG4gICAgICAgICdQYXltZW50IFJlcXVpcmVkJyxcbiAgICAgICAgJ1NldHRsZW1lbnQgRmFpbGVkJyxcbiAgICAgICAgYFBheW1lbnQgc2V0dGxlbWVudCBmYWlsZWQ6ICR7c2V0dGxlbWVudC5lcnJvclJlYXNvbn1gXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFBheW1lbnQgdmVyaWZpZWQgYW5kIHNldHRsZWQgLSByZXR1cm4gZHluYW1pYyBjb250ZW50XG4gICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5QQVlNRU5UX1NFVFRMRUQpO1xuICAgIFxuICAgIC8vIFJlY29yZCBwYXltZW50IGFtb3VudCBtZXRyaWNcbiAgICB0cnkge1xuICAgICAgY29uc3QgYW1vdW50V2VpID0gQmlnSW50KHBheW1lbnRQYXlsb2FkLnBheWxvYWQuYXV0aG9yaXphdGlvbi52YWx1ZSk7XG4gICAgICBsb2dnZXIucmVjb3JkTWV0cmljKE1ldHJpY05hbWUuUEFZTUVOVF9BTU9VTlRfV0VJLCBOdW1iZXIoYW1vdW50V2VpKSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBJZ25vcmUgaWYgYW1vdW50IHBhcnNpbmcgZmFpbHNcbiAgICB9XG4gICAgXG4gICAgbG9nZ2VyLmluZm8oJ1BheW1lbnQgc2V0dGxlZCBzdWNjZXNzZnVsbHknLCB7XG4gICAgICBwYXllcixcbiAgICAgIHRyYW5zYWN0aW9uSGFzaDogc2V0dGxlbWVudC50cmFuc2FjdGlvbixcbiAgICAgIGFtb3VudDogcGF5bWVudFJlcXVpcmVtZW50LmFtb3VudCxcbiAgICAgIG5ldHdvcms6IHBheW1lbnRSZXF1aXJlbWVudC5uZXR3b3JrLFxuICAgIH0pO1xuXG4gICAgLy8gR2V0IGR5bmFtaWMgY29udGVudCBmcm9tIGNvbnRlbnQgbWFuYWdlclxuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBjb250ZW50TWFuYWdlci5nZXRDb250ZW50KHVyaSk7XG4gICAgbG9nZ2VyLmluY3JlbWVudENvdW50ZXIoTWV0cmljTmFtZS5DT05URU5UX0dFTkVSQVRFRCk7XG4gICAgXG4gICAgLy8gUmVjb3JkIGNvbnRlbnQgc2l6ZSBtZXRyaWNcbiAgICBjb25zdCBjb250ZW50SnNvbiA9IEpTT04uc3RyaW5naWZ5KGNvbnRlbnQpO1xuICAgIGxvZ2dlci5yZWNvcmRNZXRyaWMoTWV0cmljTmFtZS5DT05URU5UX0JZVEVTX1NFUlZFRCwgY29udGVudEpzb24ubGVuZ3RoKTtcbiAgICBcbiAgICAvLyBDcmVhdGUgc2V0dGxlbWVudCByZXNwb25zZSBoZWFkZXJcbiAgICBjb25zdCBzZXR0bGVtZW50UmVzcG9uc2U6IFNldHRsZW1lbnRSZXNwb25zZSA9IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICB0cmFuc2FjdGlvbjogc2V0dGxlbWVudC50cmFuc2FjdGlvbixcbiAgICAgIG5ldHdvcms6IHBheW1lbnRSZXF1aXJlbWVudC5uZXR3b3JrLFxuICAgICAgcGF5ZXI6IHBheW1lbnRQYXlsb2FkLnBheWxvYWQuYXV0aG9yaXphdGlvbi5mcm9tLFxuICAgIH07XG5cbiAgICBsb2dnZXIucmVjb3JkTWV0cmljKE1ldHJpY05hbWUuTEFURU5DWSwgbG9nZ2VyLmdldEVsYXBzZWRNcygpKTtcbiAgICBsb2dnZXIuZW1pdE1ldHJpY3MoKTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6ICcyMDAnLFxuICAgICAgc3RhdHVzRGVzY3JpcHRpb246ICdPSycsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdjb250ZW50LXR5cGUnOiBbeyBrZXk6ICdDb250ZW50LVR5cGUnLCB2YWx1ZTogJ2FwcGxpY2F0aW9uL2pzb24nIH1dLFxuICAgICAgICAneC1wYXltZW50LXJlc3BvbnNlJzogW3tcbiAgICAgICAgICBrZXk6ICdYLVBBWU1FTlQtUkVTUE9OU0UnLFxuICAgICAgICAgIHZhbHVlOiBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShzZXR0bGVtZW50UmVzcG9uc2UpKS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICAgIH1dLFxuICAgICAgICAneC1yZXF1ZXN0LWlkJzogW3sga2V5OiAnWC1SZXF1ZXN0LUlkJywgdmFsdWU6IHJlcXVlc3RJZCB9XSxcbiAgICAgICAgJ2FjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpbic6IFt7IGtleTogJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsIHZhbHVlOiAnKicgfV0sXG4gICAgICAgICdhY2Nlc3MtY29udHJvbC1hbGxvdy1oZWFkZXJzJzogW3sgXG4gICAgICAgICAga2V5OiAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsIFxuICAgICAgICAgIHZhbHVlOiAnQ29udGVudC1UeXBlLCBYLVBheW1lbnQtU2lnbmF0dXJlJyBcbiAgICAgICAgfV0sXG4gICAgICAgICdhY2Nlc3MtY29udHJvbC1leHBvc2UtaGVhZGVycyc6IFt7IFxuICAgICAgICAgIGtleTogJ0FjY2Vzcy1Db250cm9sLUV4cG9zZS1IZWFkZXJzJywgXG4gICAgICAgICAgdmFsdWU6ICdYLVBBWU1FTlQtUkVTUE9OU0UsIFgtUmVxdWVzdC1JZCcgXG4gICAgICAgIH1dLFxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGNvbnRlbnQpLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nZ2VyLmVycm9yKCdVbmV4cGVjdGVkIGVycm9yIHByb2Nlc3NpbmcgcGF5bWVudCcsIGVycm9yKTtcbiAgICBsb2dnZXIuaW5jcmVtZW50Q291bnRlcihNZXRyaWNOYW1lLlBBWU1FTlRfRkFJTEVEKTtcbiAgICBsb2dnZXIucmVjb3JkTWV0cmljKE1ldHJpY05hbWUuTEFURU5DWSwgbG9nZ2VyLmdldEVsYXBzZWRNcygpKTtcbiAgICBsb2dnZXIuZW1pdE1ldHJpY3MoKTtcbiAgICByZXR1cm4gY3JlYXRlRXJyb3JSZXNwb25zZShcbiAgICAgICc1MDAnLFxuICAgICAgJ0ludGVybmFsIFNlcnZlciBFcnJvcicsXG4gICAgICAnUGF5bWVudCBQcm9jZXNzaW5nIEVycm9yJyxcbiAgICAgICdGYWlsZWQgdG8gcHJvY2VzcyBwYXltZW50J1xuICAgICk7XG4gIH1cbn07XG4iXX0=