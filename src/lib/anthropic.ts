import Anthropic from '@anthropic-ai/sdk';

// Create a client with user-provided API key (no server-side env var needed)
export function getAnthropicClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ApiError('No Anthropic API key provided. Please set your key in Settings (gear icon, top-right).', 'NO_API_KEY');
  }
  return new Anthropic({ apiKey: key });
}

export type ApiErrorCode = 'NO_API_KEY' | 'INVALID_API_KEY' | 'RATE_LIMITED' | 'OVERLOADED' | 'INSUFFICIENT_FUNDS' | 'NETWORK_ERROR' | 'UNKNOWN';

export class ApiError extends Error {
  code: ApiErrorCode;
  httpStatus: number;
  constructor(message: string, code: ApiErrorCode = 'UNKNOWN') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatusForCode(code);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function httpStatusForCode(code: ApiErrorCode): number {
  switch (code) {
    case 'NO_API_KEY':
    case 'INVALID_API_KEY': return 401;
    case 'INSUFFICIENT_FUNDS': return 402;
    case 'RATE_LIMITED': return 429;
    case 'OVERLOADED': return 503;
    default: return 500;
  }
}

/** Wraps Anthropic SDK errors into user-friendly ApiError instances */
export function classifyAnthropicError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const msg = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number }).status;

  if (status === 401 || msg.toLowerCase().includes('invalid x-api-key') || msg.toLowerCase().includes('authentication')) {
    return new ApiError('Invalid API key. Please check your Anthropic API key in Settings and make sure it is correct.', 'INVALID_API_KEY');
  }
  if (status === 429 || msg.toLowerCase().includes('rate limit')) {
    return new ApiError('Rate limited by Anthropic. Please wait a minute and try again.', 'RATE_LIMITED');
  }
  if (status === 529 || msg.toLowerCase().includes('overloaded')) {
    return new ApiError('Anthropic servers are currently overloaded. Please try again in a few minutes.', 'OVERLOADED');
  }
  if (status === 400 && (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing'))) {
    return new ApiError('Your Anthropic account has insufficient funds. Please add credits at console.anthropic.com.', 'INSUFFICIENT_FUNDS');
  }
  if (msg.toLowerCase().includes('fetch failed') || msg.toLowerCase().includes('econnrefused') || msg.toLowerCase().includes('network')) {
    return new ApiError('Network error — could not reach Anthropic. Check your internet connection.', 'NETWORK_ERROR');
  }

  return new ApiError(msg || 'An unexpected error occurred', 'UNKNOWN');
}
