export class FacilitatorError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'FacilitatorError';
  }
}

export class NetworkError extends FacilitatorError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', undefined, details);
    this.name = 'NetworkError';
  }
}

export class VerificationError extends FacilitatorError {
  constructor(message: string, details?: unknown) {
    super(message, 'VERIFICATION_ERROR', undefined, details);
    this.name = 'VerificationError';
  }
}

export class SettlementError extends FacilitatorError {
  constructor(message: string, details?: unknown) {
    super(message, 'SETTLEMENT_ERROR', undefined, details);
    this.name = 'SettlementError';
  }
}

export class ConfigurationError extends FacilitatorError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}
