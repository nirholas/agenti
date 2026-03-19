export interface ServiceRequest {
  type: 'service-request';
  id?: string;
  service: string;
  payload: Record<string, any>;
  payment?: { amount: string; currency: string };
}

export interface ServiceInquiry {
  type: 'service-inquiry';
  service: string;
  question: string;
}

export interface ServiceResponse {
  type: 'service-response';
  requestId?: string;
  result: any;
  status: 'success' | 'error';
}

export interface ServiceDetails {
  type: 'service-details';
  service: string;
  pricing: string;
  capabilities: string[];
  endpoint: string;
  authentication: string;
  payment: string;
}

export interface FriendRequest {
  type: 'friend-request';
  agentId: number;
  name: string;
  reputation: number;
}

export interface FriendAccept {
  type: 'friend-accept';
  agentId: number;
  name: string;
}

export interface CapabilitiesResponse {
  type: 'capabilities';
  agentId?: number;
  name: string;
  services: {
    name: string;
    description: string;
    price: string | null;
    method: string;
  }[];
  freeServices: string[];
  paidServices: string[];
  httpEndpoint?: string;
  usage: {
    free: { type: string; service: string; payload: Record<string, any> } | null;
    paid: string | null;
  };
}

export interface NotConfiguredResponse {
  type: 'not-configured';
  message: string;
  capabilities?: CapabilitiesResponse;
}

export type AgentMessage = ServiceRequest | ServiceInquiry | ServiceResponse | ServiceDetails | FriendRequest | FriendAccept;

export interface MessageContext {
  sender: string;
  timestamp: Date;
  conversationId?: string;
  reputation?: number;
}
