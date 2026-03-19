'use client';

import { useState } from 'react';
import {
  Package,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

interface SDKIntegrationProps {
  facilitator: string;
  serverUrl?: string;
}

export function SDKIntegration({ facilitator, serverUrl = 'https://api.x402.jobs' }: SDKIntegrationProps) {
  const [sdkFramework, setSdkFramework] = useState<'sdk' | 'hono' | 'express'>('sdk');

  const sdkCode = `import { OpenFacilitator, reportFailure } from '@openfacilitator/sdk';

const facilitator = new OpenFacilitator('${facilitator}');

const requirements = {
  scheme: 'exact',
  network: 'base',
  maxAmountRequired: '1000000',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payTo: '0xYourAddress',
};

const { isValid } = await facilitator.verify(payment, requirements);
const { transaction } = await facilitator.settle(payment, requirements);

// On failure, report for refund
if (handlerFailed) {
  await reportFailure({
    facilitatorUrl: '${serverUrl}',
    apiKey: process.env.REFUND_API_KEY,
    originalTxHash: transaction.hash,
    userWallet: payment.payload.authorization.from,
    amount: requirements.maxAmountRequired,
    asset: requirements.asset,
    network: requirements.network,
    reason: 'Handler failed',
  });
}`;

  const honoCode = `import { honoPaymentMiddleware } from '@openfacilitator/sdk';

app.post('/api/resource', honoPaymentMiddleware({
  facilitator: '${facilitator}',
  getRequirements: (c) => ({
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYourAddress',
  }),
  refundProtection: {
    apiKey: process.env.REFUND_API_KEY,
    facilitatorUrl: '${serverUrl}',
  },
}), async (c) => {
  // Your handler - failures auto-reported
  return c.json({ success: true });
});`;

  const expressCode = `import { createPaymentMiddleware } from '@openfacilitator/sdk';

const paymentMiddleware = createPaymentMiddleware({
  facilitator: '${facilitator}',
  getRequirements: (req) => ({
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0xYourAddress',
  }),
  refundProtection: {
    apiKey: process.env.REFUND_API_KEY,
    facilitatorUrl: '${serverUrl}',
  },
});

app.post('/api/resource', paymentMiddleware, async (req, res) => {
  // Your handler - failures auto-reported
  res.json({ success: true });
});`;

  const currentCode = sdkFramework === 'sdk' ? sdkCode : sdkFramework === 'hono' ? honoCode : expressCode;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Integrate Refund Protection
        </CardTitle>
        <CardDescription>
          Add the SDK to your server to enable automatic failure reporting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Install command */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">
            Install the SDK
          </Label>
          <CodeBlock code="npm install @openfacilitator/sdk" language="bash" />
        </div>

        {/* Code snippet with framework tabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm text-muted-foreground">
              Add to your API handler
            </Label>
            <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setSdkFramework('sdk')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  sdkFramework === 'sdk'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                SDK
              </button>
              <button
                onClick={() => setSdkFramework('hono')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  sdkFramework === 'hono'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Hono
              </button>
              <button
                onClick={() => setSdkFramework('express')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  sdkFramework === 'express'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Express
              </button>
            </div>
          </div>
          <CodeBlock code={currentCode} language="typescript" />
        </div>

        {/* Docs link */}
        <a
          href="/docs/sdk"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <FileText className="h-4 w-4" />
          View full documentation
          <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
