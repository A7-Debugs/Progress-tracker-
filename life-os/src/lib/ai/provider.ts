import Anthropic from '@anthropic-ai/sdk';
import type { AiConfig } from '../types';
import { SYSTEM_PROMPT } from './context';

/**
 * Provider abstraction so other back ends (a server-side proxy, another vendor) can be added without
 * touching the UI. Only real providers are registered: with no provider configured the assistant says so.
 */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiProvider {
  id: AiConfig['provider'];
  name: string;
  ready(cfg: AiConfig): boolean;
  /** Streams text deltas; resolves when complete. */
  send(cfg: AiConfig, brief: string, history: ChatTurn[], onText: (delta: string) => void, signal?: AbortSignal): Promise<void>;
}

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (recommended)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
];

const anthropic: AiProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  ready: (cfg) => cfg.provider === 'anthropic' && cfg.apiKey.trim().length > 20,
  async send(cfg, brief, history, onText, signal) {
    // The key is the user's own, stored only on this device and sent only to api.anthropic.com.
    const client = new Anthropic({ apiKey: cfg.apiKey.trim(), dangerouslyAllowBrowser: true });
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
    const stream = client.beta.messages.stream(
      {
        model: cfg.model || 'claude-opus-5-5',
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        // Re-run on a fallback model if a safety classifier declines the request.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: SYSTEM_PROMPT },
          { type: 'text', text: `# The user's data (computed by Life OS)\n\n${brief}`, cache_control: { type: 'ephemeral' } },
        ],
        messages,
      },
      { signal },
    );
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') onText(ev.delta.text);
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error('The model declined to answer this request.');
    if (final.stop_reason === 'max_tokens') onText('\n\n(Response cut off at the length limit.)');
  },
};

export const PROVIDERS: Record<string, AiProvider> = { anthropic };

export function activeProvider(cfg: AiConfig): AiProvider | null {
  const p = PROVIDERS[cfg.provider];
  return p && p.ready(cfg) ? p : null;
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The API key was rejected. Check it in Settings → AI assistant.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to that model.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the API. Wait a moment and try again.';
  if (e instanceof Anthropic.BadRequestError) return `The request was rejected: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the API. Check your connection.';
  if (e instanceof Anthropic.APIError) return `API error ${e.status ?? ''}: ${e.message}`;
  if (e instanceof Error && e.name === 'AbortError') return 'Stopped.';
  return e instanceof Error ? e.message : 'Something went wrong.';
}
