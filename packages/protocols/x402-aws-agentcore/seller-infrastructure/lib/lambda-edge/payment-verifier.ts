import { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';
import {
  LogLevel,
  MetricName,
  LogEntry,
  EMFMetric,
  PaymentRequirements,
  PaymentRequired,
  PaymentPayload,
  VerifyResponse,
  SettlementResponse,
} from './types';
import { contentManager, setContentBucket } from './content-config';

// ============================================================================
// Logging and Metrics Infrastructure
// ============================================================================
class Logger {
  private requestId: string;
  private uri: string;
  private startTime: number;
  private metrics: Map<string, number>;
  private dimensions: Record<string, string>;

  constructor(requestId: string, uri: string) {
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
  private createLogEntry(
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>
  ): LogEntry {
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
  debug(message: string, extra?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, extra);
    console.log(JSON.stringify(entry));
  }

  /**
   * Logs an info message
   */
  info(message: string, extra?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, extra);
    console.log(JSON.stringify(entry));
  }

  /**
   * Logs a warning message
   */
  warn(message: string, extra?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, extra);
    console.warn(JSON.stringify(entry));
  }

  /**
   * Logs an error message
   */
  error(message: string, error?: Error | unknown, extra?: Record<string, unknown>): void {
    const errorDetails: Record<string, unknown> = { ...extra };
    
    if (error instanceof Error) {
      errorDetails.errorMessage = error.message;
      errorDetails.errorStack = error.stack;
    } else if (error) {
      errorDetails.errorMessage = String(error);
    }
    
    const entry = this.createLogEntry(LogLevel.ERROR, message, errorDetails);
    console.error(JSON.stringify(entry));
  }

  /**
   * Records a metric value
   */
  recordMetric(name: MetricName, value: number): void {
    this.metrics.set(name, value);
  }

  /**
   * Increments a counter metric
   */
  incrementCounter(name: MetricName): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + 1);
  }

  /**
   * Sets a dimension for metrics
   */
  setDimension(key: string, value: string): void {
    this.dimensions[key] = value;
  }

  /**
   * Emits all recorded metrics in CloudWatch EMF format
   */
  emitMetrics(): void {
    if (this.metrics.size === 0) return;

    const metricsArray: Array<{ Name: string; Unit: string }> = [];
    const metricValues: Record<string, number> = {};

    this.metrics.forEach((value, name) => {
      const unit = name.includes('Latency') ? 'Milliseconds' : 'Count';
      metricsArray.push({ Name: name, Unit: unit });
      metricValues[name] = value;
    });

    const emf: EMFMetric = {
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
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Generates a unique request ID for tracing
 */
function generateRequestId(): string {
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
function validatePayloadStructure(payload: unknown): payload is PaymentPayload {
  if (!payload || typeof payload !== 'object') return false;
  
  const p = payload as Record<string, unknown>;
  
  // Check required top-level fields
  if (typeof p.x402Version !== 'number' || p.x402Version !== 2) return false;
  if (!p.accepted || typeof p.accepted !== 'object') return false;
  if (!p.payload || typeof p.payload !== 'object') return false;
  
  // Check accepted requirements
  const accepted = p.accepted as Record<string, unknown>;
  if (typeof accepted.scheme !== 'string') return false;
  if (typeof accepted.network !== 'string') return false;
  if (typeof accepted.amount !== 'string') return false;
  if (typeof accepted.asset !== 'string') return false;
  if (typeof accepted.payTo !== 'string') return false;
  
  // Check payload (exact EVM scheme)
  const payloadData = p.payload as Record<string, unknown>;
  if (typeof payloadData.signature !== 'string') return false;
  if (!payloadData.authorization || typeof payloadData.authorization !== 'object') return false;
  
  // Check authorization
  const auth = payloadData.authorization as Record<string, unknown>;
  if (typeof auth.from !== 'string') return false;
  if (typeof auth.to !== 'string') return false;
  if (typeof auth.value !== 'string') return false;
  if (typeof auth.validAfter !== 'string') return false;
  if (typeof auth.validBefore !== 'string') return false;
  if (typeof auth.nonce !== 'string') return false;
  
  return true;
}

/**
 * Validates that the payment authorization matches the requirements
 */
function validateAuthorizationParameters(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): VerifyResponse {
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
async function verifySignatureWithFacilitator(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  logger: Logger
): Promise<VerifyResponse> {
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
      logger.incrementCounter(MetricName.FACILITATOR_ERROR);
      return {
        isValid: false,
        invalidReason: 'facilitator_verification_failed',
        payer,
      };
    }
    
    const result = await response.json() as VerifyResponse;
    logger.debug('Facilitator verification response received', {
      isValid: result.isValid,
    });
    return result;
  } catch (error) {
    logger.error('Error calling facilitator', error, {
      facilitatorUrl: FACILITATOR_URL,
    });
    logger.incrementCounter(MetricName.FACILITATOR_ERROR);
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
async function settlePaymentWithFacilitator(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  logger: Logger
): Promise<SettlementResponse> {
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
      logger.incrementCounter(MetricName.FACILITATOR_ERROR);
      return {
        success: false,
        transaction: '',
        network: requirements.network,
        payer,
        errorReason: 'settlement_failed',
      };
    }
    
    const result = await response.json() as SettlementResponse;
    logger.debug('Facilitator settlement response received', {
      success: result.success,
      transaction: result.transaction,
    });
    return result;
  } catch (error) {
    logger.error('Error settling payment', error, {
      facilitatorUrl: FACILITATOR_URL,
    });
    logger.incrementCounter(MetricName.FACILITATOR_ERROR);
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
function create402Response(
  uri: string,
  requirements: PaymentRequirements,
  errorMessage?: string
): CloudFrontRequestResult {
  const paymentRequired: PaymentRequired = {
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
function createErrorResponse(
  status: string,
  statusDescription: string,
  error: string,
  message: string
): CloudFrontRequestResult {
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
function createMCPDiscoveryResponse(requestId: string): CloudFrontRequestResult {
  const tools = [];
  
  // Get all content items from the registry
  const paths = contentManager.listContentPaths();
  
  for (const path of paths) {
    // Only expose /api/ prefixed paths (root paths are duplicates)
    if (!path.startsWith('/api/')) continue;
    const item = contentManager.getContentItem(path);
    if (!item) continue;
    
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

export const handler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;

  // Extract S3 bucket name from CloudFront origin config (avoids hardcoding)
  const originDomain = (request.origin as any)?.s3?.domainName || '';
  if (originDomain) {
    setContentBucket(originDomain.split('.s3')[0]);
  }
  
  // Initialize logger with request ID for tracing
  const requestId = generateRequestId();
  const logger = new Logger(requestId, uri);
  
  // Record request metric
  logger.incrementCounter(MetricName.REQUEST_COUNT);
  logger.info('Processing request', { method: request.method });

  try {
    // Handle MCP discovery endpoint (no payment required)
    if (uri === '/mcp/tools') {
      logger.info('MCP discovery request');
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return createMCPDiscoveryResponse(requestId);
    }
    
    // Check if this path requires payment using dynamic content manager
    const paymentRequirement = contentManager.getPaymentRequirements(uri);
    
    if (!paymentRequirement) {
      // No payment required for this path
      logger.debug('No payment required for path');
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return request;
    }

    logger.setDimension('Network', paymentRequirement.network);
    logger.setDimension('Asset', paymentRequirement.asset);

    // Check for payment signature header (x402 v2 uses X-PAYMENT-SIGNATURE)
    const paymentSignatureHeader = 
      request.headers['x-payment-signature'] || 
      request.headers['payment-signature'];
    
    if (!paymentSignatureHeader || !paymentSignatureHeader[0]) {
      // No payment provided - return 402 Payment Required
      logger.info('No payment signature found, returning 402', {
        requiredAmount: paymentRequirement.amount,
      });
      logger.incrementCounter(MetricName.PAYMENT_REQUIRED);
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return create402Response(uri, paymentRequirement);
    }

    // Payment signature present
    logger.incrementCounter(MetricName.PAYMENT_RECEIVED);

    // Decode and verify payment
    const paymentPayloadBase64 = paymentSignatureHeader[0].value;
    let paymentPayload: unknown;
    
    try {
      paymentPayload = JSON.parse(
        Buffer.from(paymentPayloadBase64, 'base64').toString('utf-8')
      );
    } catch (decodeError) {
      logger.warn('Failed to decode payment payload', {
        errorCode: 'DECODE_ERROR',
      });
      logger.incrementCounter(MetricName.VALIDATION_ERROR);
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return create402Response(
        uri, 
        paymentRequirement, 
        'Invalid payment payload encoding'
      );
    }

    logger.debug('Payment payload decoded successfully');

    // Validate payload structure
    if (!validatePayloadStructure(paymentPayload)) {
      logger.warn('Invalid payment payload structure', {
        errorCode: 'INVALID_STRUCTURE',
      });
      logger.incrementCounter(MetricName.VALIDATION_ERROR);
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return createErrorResponse(
        '400',
        'Bad Request',
        'Invalid Payment',
        'Payment payload structure is invalid'
      );
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
    const paramValidation = validateAuthorizationParameters(
      paymentPayload,
      paymentRequirement
    );
    
    if (!paramValidation.isValid) {
      logger.warn('Payment parameter validation failed', {
        errorCode: paramValidation.invalidReason,
        payer,
      });
      logger.incrementCounter(MetricName.VALIDATION_ERROR);
      
      // Record specific validation error metrics
      switch (paramValidation.invalidReason) {
        case 'invalid_exact_evm_payload_authorization_valid_before':
        case 'invalid_exact_evm_payload_authorization_valid_after':
          logger.incrementCounter(MetricName.AUTHORIZATION_EXPIRED);
          break;
        case 'invalid_signature_format':
        case 'invalid_signature_length':
          logger.incrementCounter(MetricName.SIGNATURE_INVALID);
          break;
        case 'invalid_exact_evm_payload_authorization_value':
          logger.incrementCounter(MetricName.AMOUNT_INSUFFICIENT);
          break;
        case 'network_mismatch':
          logger.incrementCounter(MetricName.NETWORK_MISMATCH);
          break;
        case 'asset_mismatch':
          logger.incrementCounter(MetricName.ASSET_MISMATCH);
          break;
      }
      
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return create402Response(
        uri,
        paymentRequirement,
        `Payment validation failed: ${paramValidation.invalidReason}`
      );
    }

    logger.debug('Authorization parameters validated');

    // Verify signature with facilitator
    const verificationStartTime = Date.now();
    const signatureValidation = await verifySignatureWithFacilitator(
      paymentPayload,
      paymentRequirement,
      logger
    );
    logger.recordMetric(MetricName.VERIFICATION_LATENCY, Date.now() - verificationStartTime);
    
    if (!signatureValidation.isValid) {
      logger.warn('Signature verification failed', {
        errorCode: signatureValidation.invalidReason,
        payer,
      });
      logger.incrementCounter(MetricName.PAYMENT_FAILED);
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return create402Response(
        uri,
        paymentRequirement,
        `Signature verification failed: ${signatureValidation.invalidReason}`
      );
    }

    logger.incrementCounter(MetricName.PAYMENT_VERIFIED);
    logger.info('Payment signature verified', { payer });

    // Settle payment with facilitator
    const settlementStartTime = Date.now();
    const settlement = await settlePaymentWithFacilitator(
      paymentPayload,
      paymentRequirement,
      logger
    );
    logger.recordMetric(MetricName.SETTLEMENT_LATENCY, Date.now() - settlementStartTime);
    
    if (!settlement.success) {
      logger.error('Payment settlement failed', undefined, {
        errorCode: settlement.errorReason,
        payer,
      });
      logger.incrementCounter(MetricName.PAYMENT_FAILED);
      logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
      logger.emitMetrics();
      return createErrorResponse(
        '402',
        'Payment Required',
        'Settlement Failed',
        `Payment settlement failed: ${settlement.errorReason}`
      );
    }

    // Payment verified and settled - return dynamic content
    logger.incrementCounter(MetricName.PAYMENT_SETTLED);
    
    // Record payment amount metric
    try {
      const amountWei = BigInt(paymentPayload.payload.authorization.value);
      logger.recordMetric(MetricName.PAYMENT_AMOUNT_WEI, Number(amountWei));
    } catch {
      // Ignore if amount parsing fails
    }
    
    logger.info('Payment settled successfully', {
      payer,
      transactionHash: settlement.transaction,
      amount: paymentRequirement.amount,
      network: paymentRequirement.network,
    });

    // Get dynamic content from content manager
    const content = await contentManager.getContent(uri);
    logger.incrementCounter(MetricName.CONTENT_GENERATED);
    
    // Record content size metric
    const contentJson = JSON.stringify(content);
    logger.recordMetric(MetricName.CONTENT_BYTES_SERVED, contentJson.length);
    
    // Create settlement response header
    const settlementResponse: SettlementResponse = {
      success: true,
      transaction: settlement.transaction,
      network: paymentRequirement.network,
      payer: paymentPayload.payload.authorization.from,
    };

    logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
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
  } catch (error) {
    logger.error('Unexpected error processing payment', error);
    logger.incrementCounter(MetricName.PAYMENT_FAILED);
    logger.recordMetric(MetricName.LATENCY, logger.getElapsedMs());
    logger.emitMetrics();
    return createErrorResponse(
      '500',
      'Internal Server Error',
      'Payment Processing Error',
      'Failed to process payment'
    );
  }
};
