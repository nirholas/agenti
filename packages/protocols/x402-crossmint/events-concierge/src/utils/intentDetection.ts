// Simple intent detection for conversational UI

export interface Intent {
  type: 'connect' | 'list' | 'create' | 'rsvp' | 'help' | 'status' | 'unknown';
  confidence: number;
  extractedData?: {
    eventId?: string;
    amount?: string;
  };
}

export function detectIntent(message: string): Intent {
  const lowerMessage = message.toLowerCase().trim();

  // Connect intent
  if (/^(connect|start|begin|setup|init)$/.test(lowerMessage)) {
    return { type: 'connect', confidence: 1.0 };
  }

  // List events intent
  if (/(list|show|view|get|display).*(event|all)/.test(lowerMessage) || lowerMessage === 'list' || lowerMessage === 'list events') {
    return { type: 'list', confidence: 0.9 };
  }

  // Create event intent
  if (/(create|add|make|new).*(event)/.test(lowerMessage)) {
    return { type: 'create', confidence: 0.9 };
  }

  // RSVP to event intent
  if (/(rsvp|register|join|attend).*(event|to)/.test(lowerMessage)) {
    // Try to extract event ID
    const eventIdMatch = lowerMessage.match(/([a-f0-9-]{36})/);
    if (eventIdMatch) {
      return {
        type: 'rsvp',
        confidence: 0.95,
        extractedData: { eventId: eventIdMatch[1] }
      };
    }
    return { type: 'rsvp', confidence: 0.8 };
  }

  // Help intent
  if (/(help|what|how|commands?)/.test(lowerMessage)) {
    return { type: 'help', confidence: 0.9 };
  }

  // Status intent
  if (/(status|info|wallet|balance)/.test(lowerMessage)) {
    return { type: 'status', confidence: 0.8 };
  }

  return { type: 'unknown', confidence: 0.0 };
}

export function getSuggestedActions(mcpConnected: boolean, hasEvents: boolean): string[] {
  if (!mcpConnected) {
    return ['connect', 'help'];
  }

  if (hasEvents) {
    return ['list events', 'wallet status'];
  }

  return ['wallet status', 'help'];
}
