import Anthropic from '@anthropic-ai/sdk';

// Create a client with user-provided API key (no server-side env var needed)
export function getAnthropicClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('No Anthropic API key provided. Please set your key in Settings.');
  }
  return new Anthropic({ apiKey: key });
}
