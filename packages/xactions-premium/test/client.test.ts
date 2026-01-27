/**
 * XActions Premium Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  XActionsPaymentClient,
  PREMIUM_PRICING,
  NETWORK_CONFIGS,
  BULK_DISCOUNTS,
} from '../src/client.js';
import {
  PREMIUM_TOOLS,
  XActionsPremiumToolExecutor,
} from '../src/mcp-tools.js';

describe('XActionsPaymentClient', () => {
  describe('Configuration', () => {
    it('should have valid network configs', () => {
      expect(NETWORK_CONFIGS['base-sepolia']).toBeDefined();
      expect(NETWORK_CONFIGS['base']).toBeDefined();
      expect(NETWORK_CONFIGS['ethereum']).toBeDefined();
      expect(NETWORK_CONFIGS['arbitrum']).toBeDefined();
    });

    it('should have correct USDC addresses', () => {
      expect(NETWORK_CONFIGS['base-sepolia'].usdc).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(NETWORK_CONFIGS['base'].usdc).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should have valid pricing', () => {
      expect(PREMIUM_PRICING.sentimentAnalysis).toBe('$0.001');
      expect(PREMIUM_PRICING.engagementPrediction).toBe('$0.005');
      expect(PREMIUM_PRICING.rateLimitBypass).toBe('$0.01');
      expect(PREMIUM_PRICING.autoEngagementBot).toBe('$0.10');
    });

    it('should have bulk discounts', () => {
      expect(BULK_DISCOUNTS.sentimentAnalysis.length).toBeGreaterThan(0);
      expect(BULK_DISCOUNTS.engagementPrediction.length).toBeGreaterThan(0);
    });
  });

  describe('Client instantiation', () => {
    it('should create client without private key', () => {
      const client = new XActionsPaymentClient({});
      expect(client).toBeDefined();
      expect(client.getWalletAddress()).toBeNull();
    });

    it('should default to base-sepolia network', () => {
      const client = new XActionsPaymentClient({});
      const config = client.getNetworkConfig();
      expect(config.name).toContain('Sepolia');
    });

    it('should accept custom API URL', () => {
      const client = new XActionsPaymentClient({
        apiUrl: 'https://custom.api.com',
      });
      expect(client).toBeDefined();
    });
  });
});

describe('MCP Tools', () => {
  describe('Tool Definitions', () => {
    it('should have all required premium tools', () => {
      const toolNames = PREMIUM_TOOLS.map(t => t.name);
      
      expect(toolNames).toContain('xactions_premium_sentiment');
      expect(toolNames).toContain('xactions_premium_predict');
      expect(toolNames).toContain('xactions_premium_rate_limit');
      expect(toolNames).toContain('xactions_subscribe_bot');
      expect(toolNames).toContain('xactions_subscription_status');
    });

    it('should have valid input schemas', () => {
      for (const tool of PREMIUM_TOOLS) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it('should have descriptions with pricing', () => {
      const sentimentTool = PREMIUM_TOOLS.find(t => t.name === 'xactions_premium_sentiment');
      expect(sentimentTool?.description).toContain('$0.001');

      const predictTool = PREMIUM_TOOLS.find(t => t.name === 'xactions_premium_predict');
      expect(predictTool?.description).toContain('$0.005');
    });
  });

  describe('Tool Executor', () => {
    let executor: XActionsPremiumToolExecutor;
    let mockClient: XActionsPaymentClient;

    beforeAll(() => {
      mockClient = new XActionsPaymentClient({});
      executor = new XActionsPremiumToolExecutor(mockClient);
    });

    it('should return pricing info without payment', async () => {
      const result = await executor.execute('xactions_premium_pricing', {});
      
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.pricing).toBeDefined();
      expect(data.freeTier).toBeDefined();
      expect(data.networks).toBeDefined();
    });

    it('should handle unknown tools', async () => {
      const result = await executor.execute('unknown_tool', {});
      
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('Unknown tool');
    });
  });
});

describe('Pricing Calculations', () => {
  it('should calculate bulk discounts correctly', () => {
    const tiers = BULK_DISCOUNTS.sentimentAnalysis;
    
    // Under 100 = no discount
    expect(tiers.find(t => 50 >= t.threshold)?.discount || 0).toBe(0);
    
    // 100+ = 10% off
    const tier100 = tiers.find(t => t.threshold === 100);
    expect(tier100?.discount).toBe(0.10);
    
    // 500+ = 20% off
    const tier500 = tiers.find(t => t.threshold === 500);
    expect(tier500?.discount).toBe(0.20);
    
    // 1000+ = 30% off
    const tier1000 = tiers.find(t => t.threshold === 1000);
    expect(tier1000?.discount).toBe(0.30);
  });

  it('should calculate subscription pricing', () => {
    const dailyPrice = parseFloat(PREMIUM_PRICING.autoEngagementBot.replace('$', ''));
    expect(dailyPrice).toBe(0.10);
    
    // 7 days = $0.70
    expect(dailyPrice * 7).toBe(0.70);
    
    // 30 days = $3.00
    expect(dailyPrice * 30).toBe(3.00);
  });
});
