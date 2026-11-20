import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUp, Eye, PlugZap, Square, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { buildContext } from '@/lib/ai/context';
import { activeProvider, describeError } from '@/lib/ai/provider';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';

const THREAD = 'main';
const PROMPTS = ['Help me plan next week', 'What am I neglecting?', 'Is my workload realistic?', 'Which one change would make the biggest difference?', 'Am I actually making progress on my goals?', 'Where do my commitments conflict?'];

/**
 * The assistant only answers through a real model the user has connected. Without one, the page explains
 * that and shows the factual brief that would be sent; there are no canned or simulated replies.
 */
export default function Assistant() {
  const { s } = useStore();
  const provider = activeProvider(s.settings.ai);
  const brief = useMemo(() => buildContext(s), [s]);
  const messages = useLiveQuery(() => db.aiMessages.where('threadId').equals(THREAD).sortBy('ts'), []) ?? [];
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!provider || !text.trim() || streaming !== null) return;
    setInput('');
    await A.addAiMessage(THREAD, 'user', text.trim());
    const history = [...messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: text.trim() }].slice(-20);
    abort.current = new AbortController();
    let acc = '';
    setStreaming('');
    try {
      await provider.send(s.settings.ai, brief, history, (d) => {
        acc += d;
        setStreaming(acc);
        endRef.current?.scrollIntoView({ block: 'end' });
      }, abort.current.signal);
      await A.addAiMessage(THREAD, 'assistant', acc);
    } catch (e) {
      await A.addAiMessage(THREAD, 'assistant', acc, describeError(e));
    } finally {
      setStreaming(null);
      abort.current = null;
    }
  }

  return (
    <>
      <PageHeader
        title="Assistant"
        subtitle={provider ? `Connected · ${s.settings.ai.model}` : 'Not connected'}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setShowBrief(true)}>
              <Eye size={14} /> What it sees
            </Button>
            {messages.length > 0 && (
              <Button size="icon-sm" variant="ghost" aria-label="Clear conversation" onClick={() => A.clearAiThread(THREAD)}>
                <Trash2 size={14} />
              </Button>
            )}
          </>
        }
      />
      <Page className="max-w-3xl pb-36">
        {!provider ? (
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="h-10 w-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <PlugZap size={18} />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold">The assistant isn't connected</h2>
                <p className="text-[13px] text-fg-2 mt-1 leading-relaxed">
                  It's designed to review your goals against what you're actually doing, spot neglected objectives and unrealistic workloads, and help plan your week. It needs a real AI model to do that, so nothing here is simulated. Connect your own Anthropic API key in Settings to switch it on. The key stays on this device and requests go directly to Anthropic.
                </p>
                <p className="text-[13px] text-fg-2 mt-2">Until then, your dashboard insights and weekly review give you the same analysis, calculated from your data without AI.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Link to="/settings#ai">
                    <Button size="sm">Connect in Settings</Button>
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => setShowBrief(true)}>
                    Preview what it would see
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {messages.length === 0 && streaming === null && (
              <div className="py-6">
                <p className="text-[15px] font-medium">How can I help?</p>
                <p className="text-[13px] text-fg-3 mt-1">I can see a summary of your goals, habits, tasks, schedule and recent reflections. Tap “What it sees” for the exact data.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {PROMPTS.map((p) => (
                    <button key={p} onClick={() => send(p)} className="text-left rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] hover:bg-surface-2">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4 pt-2">
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} text={m.content} error={m.error} />
              ))}
              {streaming !== null && <Bubble role="assistant" text={streaming || '…'} />}
              <div ref={endRef} />
            </div>
          </>
        )}
      </Page>
      {provider && (
        <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 inset-x-0 md:left-56 lg:left-60 z-20 bg-bg/90 backdrop-blur border-t border-line">
          <form
            className="mx-auto max-w-3xl px-4 py-3 flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send(input))} placeholder="Ask about your goals, week or priorities…" className="min-h-10 max-h-40" aria-label="Message" />
            {streaming !== null ? (
              <Button size="icon" variant="secondary" aria-label="Stop" onClick={() => abort.current?.abort()}>
                <Square size={14} />
              </Button>
            ) : (
              <Button size="icon" type="submit" aria-label="Send" disabled={!input.trim()}>
                <ArrowUp size={16} />
              </Button>
            )}
          </form>
        </div>
      )}
      <Dialog open={showBrief} onOpenChange={setShowBrief} title="What the assistant sees" description="Computed from your records each time you send a message. Nothing else is shared." className="sm:max-w-2xl">
        <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-fg-2 font-mono">{brief}</pre>
      </Dialog>
    </>
  );
}

function Bubble({ role, text, error }: { role: 'user' | 'assistant'; text: string; error?: string | null }) {
  return (
    <div className={cn('flex', role === 'user' && 'justify-end')}>
      <div className={cn('max-w-[88%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap', role === 'user' ? 'bg-accent text-accent-fg rounded-br-md' : 'bg-surface border border-line rounded-bl-md')}>
        {text}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
