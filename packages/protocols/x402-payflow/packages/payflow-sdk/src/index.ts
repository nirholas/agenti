import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { McpServer, type RegisteredTool, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  CallToolResult,
  Implementation,
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import { z, type ZodRawShape, type ZodTypeAny } from 'zod';
import debug from 'debug';
import type { Network, PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from 'x402/types';
import { ErrorReasons } from 'x402/types';
import { useFacilitator } from 'x402/verify';
import { createFacilitatorConfig } from '@coinbase/x402';
import { exact } from 'x402/schemes';
import { findMatchingPaymentRequirements, processPriceToAtomicAmount } from 'x402/shared';

/**
 * Options for a paid tool.
 */
export type PaymentOptions = {
  /**
   * The price of the tool in the given asset.
   */
  price: number;
  /**
   * The recipient of the payment.
   */
  recipient: string;
  /**
   * The asset to use for the tool.
   */
  asset?: string;
  /**
   * The network to settle the payment on.
   */
  network?: number | string;
};

type PayflowOptions = {
  x402?: {
    /**
     * The version of the x402 protocol to use.
     */
    version?: number;
    /**
     * The API key ID for the Coinbase X402 facilitator.
     */
    keyId?: string;
    /**
     * The API key secret for the Coinbase X402 facilitator.
     */
    keySecret?: string;
  };
};

export type PayflowMcpServerOptions = ServerOptions & PayflowOptions;

/**
 * An extended MCP server that supports paid tools.
 */
export class PayflowMcpServer extends McpServer {
  private readonly log: debug.Debugger;
  private readonly options: PayflowOptions;
  private readonly verify: (
    payload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ) => Promise<VerifyResponse>;
  private readonly settle: (
    payload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ) => Promise<SettleResponse>;
  /**
   * Creates a new PayflowMcpServer instance.
   *
   * @param serverInfo - The server implementation details including name and version
   * @param options - Optional configuration for the server including x402 payment settings
   *
   * @example
   * ```typescript
   * const server = new PayflowMcpServer({
   *   name: 'my-paid-server',
   *   version: '1.0.0'
   * }, {
   *   x402: {
   *     version: 1,
   *     keyId: 'your-api-key-id',
   *     keySecret: 'your-api-key-secret'
   *   }
   * });
   * ```
   */
  constructor(serverInfo: Implementation, options?: PayflowMcpServerOptions) {
    super(serverInfo, options);
    this.log = debug('payflow-sdk');

    // Define default x402 options
    const defaultX402Options = {
      version: 1,
      keyId: process.env.CDP_API_KEY_ID,
      keySecret: process.env.CDP_API_KEY_SECRET,
    };

    // Merge user options with defaults
    this.options = {
      x402: {
        ...defaultX402Options,
        ...(options?.x402 || {}),
      },
    };

    const { verify, settle } = useFacilitator(
      createFacilitatorConfig(this.options.x402?.keyId, this.options.x402?.keySecret)
    );
    this.verify = verify;
    this.settle = settle;
  }

  private generateRequirements(
    payload: PaymentPayload,
    tool: string,
    price: number,
    recipient: string,
    network: Network
  ): PaymentRequirements {
    // TODO: support other assets
    const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
    if ('error' in atomicAmountForAsset) {
      throw new Error(atomicAmountForAsset.error);
    }

    const { maxAmountRequired, asset } = atomicAmountForAsset;

    const paymentRequirements: PaymentRequirements[] = [
      {
        scheme: 'exact',
        network: network,
        maxAmountRequired,
        resource: tool,
        // TODO: support description through arguments
        description: '',
        // TODO: support other mime types through arguments
        mimeType: 'text/plain',
        payTo: recipient,
        maxTimeoutSeconds: 60,
        asset: asset.address,
        outputSchema: undefined,
        extra: {
          name: asset.eip712.name,
          version: asset.eip712.version,
        },
      },
    ];

    // NOTE: This ONLY finds matches on the scheme and the network. Nothing else!
    const selectedPaymentRequirements = findMatchingPaymentRequirements(paymentRequirements, payload);
    if (!selectedPaymentRequirements) {
      throw new Error('No matching payment requirements found');
    }

    return selectedPaymentRequirements;
  }

  private async verifyPayment(payload: PaymentPayload, requirements: PaymentRequirements) {
    const verifyResponse = await this.verify(payload, requirements);

    if (!verifyResponse.isValid) {
      throw enrichVerificationError(requirements, verifyResponse.invalidReason);
    }
  }

  private async settlePayment(
    payload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const settleResponse = await this.settle(payload, paymentRequirements);
    if (!settleResponse.success) {
      throw new Error(settleResponse.errorReason);
    }

    return settleResponse;
  }

  private createPaidCallback<ArgsSchema extends ZodTypeAny>(
    name: string,
    price: number,
    recipient: string,
    schema: ArgsSchema,
    cb: ToolCallback
  ): (
    args: z.infer<ArgsSchema> & { payment: string },
    context: RequestHandlerExtra<ServerRequest, ServerNotification>
  ) => Promise<any> {
    return async (args, context) => {
      this.log('Called paid tool:', name, args);

      // Validate args using the schema (excluding payment)
      const { payment, ...toolArgs } = args;
      schema.parse(toolArgs); // throws if invalid

      // Step 0: Decode the payment.
      const payload = exact.evm.decodePayment(payment);
      payload.x402Version = this.options.x402?.version ?? 1;

      let requirements: PaymentRequirements;
      try {
        requirements = this.generateRequirements(payload, name, price, recipient, 'base');
      } catch (error) {
        this.log('Error generating requirements:', error);
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error), isError: true }],
        };
      }

      // Step 1: Verify the payment.
      try {
        await this.verifyPayment(payload, requirements);
      } catch (error) {
        this.log('Error verifying payment:', error);
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error), isError: true }],
        };
      }

      // Step 2: Handle the tool call.
      let result: CallToolResult;
      try {
        if (cb.length > 1) {
          // Callback expects (args, context)
          result = await (cb as any)(toolArgs, context);
        } else {
          // Callback expects only (context)
          result = await cb(context);
        }
      } catch (error) {
        this.log('Error in tool call:', error);
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error), isError: true }],
        };
      }

      // Step 3: Settle the payment.
      let settleResponse: SettleResponse;
      try {
        settleResponse = await this.settlePayment(payload, requirements);
      } catch (error) {
        this.log('Error settling payment:', error);
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error), isError: true }],
        };
      }

      // Add the payment reference to the existing result.
      result.content.push({
        type: 'text',
        text: `Payment: ${settleResponse.transaction}`,
      });

      // Step 4: Return the result.
      return result;
    };
  }

  // Overload signatures
  public paidTool(name: string, options: PaymentOptions, cb: ToolCallback): RegisteredTool;
  public paidTool(name: string, description: string, options: PaymentOptions, cb: ToolCallback): RegisteredTool;
  public paidTool<Args extends ZodRawShape>(
    name: string,
    options: PaymentOptions,
    paramsSchema: Args,
    cb: ToolCallback<Args>
  ): RegisteredTool;
  public paidTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    options: PaymentOptions,
    paramsSchema: Args,
    cb: ToolCallback<Args>
  ): RegisteredTool;
  public paidTool<Args extends ZodRawShape>(
    name: string,
    options: PaymentOptions,
    paramsSchema: Args,
    annotations: ToolAnnotations,
    cb: ToolCallback<Args>
  ): RegisteredTool;
  public paidTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    options: PaymentOptions,
    paramsSchema: Args,
    annotations: ToolAnnotations,
    cb: ToolCallback<Args>
  ): RegisteredTool;

  /**
   * paidTool() implementation. Parses and processes the argument defined in the overloaded signatures.
   */
  public paidTool(name: string, ...rest: any[]): RegisteredTool {
    let description: string | undefined;
    let paymentOptions: PaymentOptions | undefined;
    let inputSchema: ZodRawShape | undefined;
    let annotations: ToolAnnotations | undefined;

    // Check for description as first argument
    if (rest.length >= 1 && typeof rest[0] === 'string') {
      description = rest.shift();
    }

    // Check for PaymentOptions object
    if (
      rest.length >= 1 &&
      typeof rest[0] === 'object' &&
      rest[0] !== null &&
      'price' in rest[0] &&
      'recipient' in rest[0]
    ) {
      paymentOptions = rest.shift() as PaymentOptions;
    }

    // Check for input schema or annotations
    if (rest.length >= 1) {
      if (this.isZodRawShape(rest[0])) {
        inputSchema = rest.shift();
      } else if (typeof rest[0] === 'object' && rest[0] !== null && 'title' in rest[0]) {
        annotations = rest.shift();
      }
    }

    // Check for annotations if not found yet
    if (rest.length >= 1 && typeof rest[0] === 'object' && rest[0] !== null && 'title' in rest[0]) {
      annotations = rest.shift();
    }

    if (rest.length > 1) {
      throw new Error('Too many arguments to paidTool()');
    }

    if (!paymentOptions) {
      throw new Error('PaymentOptions are required for paidTool()');
    }

    const cb = rest[0] as ToolCallback;

    // Create the schema that includes payment field
    const paymentSchema = z.object({
      payment: z.string().describe('The x402 payment header for the query.'),
    });

    let finalSchema: ZodRawShape;
    if (inputSchema) {
      // Merge the input schema with payment schema
      finalSchema = {
        ...inputSchema,
        payment: paymentSchema.shape.payment,
      };
    } else {
      finalSchema = paymentSchema.shape;
    }

    // Create the schema object for createPaidCallback
    const schemaForCallback = inputSchema ? z.object(inputSchema) : z.object({});

    // Create the paid callback
    const paidCb = this.createPaidCallback(
      name,
      paymentOptions.price,
      paymentOptions.recipient,
      schemaForCallback,
      cb
    ) as any;

    // Generate description
    const toolDescription = description || `Paid tool ${name}`;
    const fullDescription = `${toolDescription}\nIMPORTANT: Payflow payment details:\n-Price: ${paymentOptions.price}\n- Recipient: ${paymentOptions.recipient}`;

    // Register the tool
    if (annotations) {
      return this.tool(name, fullDescription, finalSchema, annotations, paidCb);
    } else {
      return this.tool(name, fullDescription, finalSchema, paidCb);
    }
  }

  // Helper function from MCP SDK to check if an object is a Zod schema
  private isZodRawShape(obj: unknown): obj is ZodRawShape {
    if (typeof obj !== 'object' || obj === null) return false;
    const isEmptyObject = Object.keys(obj).length === 0;
    // Check if object is empty or at least one property is a ZodType instance
    return isEmptyObject || Object.values(obj as object).some(this.isZodTypeLike);
  }

  private isZodTypeLike(value: unknown): value is ZodTypeAny {
    return (
      value !== null &&
      typeof value === 'object' &&
      'parse' in value &&
      typeof value.parse === 'function' &&
      'safeParse' in value &&
      typeof value.safeParse === 'function'
    );
  }
}

function enrichVerificationError(requirements: PaymentRequirements, reason?: (typeof ErrorReasons)[number]): Error {
  switch (reason) {
    case 'insufficient_funds':
      return new Error(`${reason}: Insufficient funds for payment. Required: ${requirements.maxAmountRequired}`);
    case 'invalid_exact_evm_payload_authorization_valid_after':
      return new Error(`${reason}: Invalid validAfter value in the payment`);
    case 'invalid_exact_evm_payload_authorization_valid_before':
      return new Error(`${reason}: Invalid validBefore value in the payment`);
    case 'invalid_exact_evm_payload_authorization_value':
      return new Error(
        `${reason}: The value of the payment is incorrect, it should be ${requirements.maxAmountRequired}`
      );
    case 'invalid_exact_evm_payload_signature':
      return new Error(`${reason}: Invalid signature in the payment`);
    case 'invalid_exact_evm_payload_recipient_mismatch':
      return new Error(`${reason}: Recipient mismatch in the payment. Pay to: ${requirements.payTo}`);
    case 'invalid_network':
      return new Error(`${reason}: Invalid network in the payment. Network: ${requirements.network}`);
    default:
      return new Error(`Payment verification failed: ${reason || 'unknown reason'}`);
  }
}
