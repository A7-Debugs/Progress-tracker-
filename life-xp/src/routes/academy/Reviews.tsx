import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Check, Eye } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Bar } from '@/components/game';
import { dueTopics, INTERVALS } from '@/lib/academy/srs';
import { REVIEW_XP } from '@/lib/academy/academy';
import { rateReview } from '@/lib/actions';
import { relDay } from '@/lib/dates';
import type { ReviewRating } from '@/lib/types';

/** Work through several due reviews in one sitting. */
export default function Reviews() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ name: string; rating: ReviewRating; next: string }[]>([]);
  const [busy, setBusy] = useState(false);
  if (!s) return <Loading />;
  const ids = queue ?? dueTopics(s).map((t) => t.id);
  if (queue === null && ids.length) setQueue(ids);
  const topic = s.topics.find((t) => t.id === ids[index]);
  const subject = topic ? s.subjects.find((x) => x.id === topic.subjectId) : undefined;
  const last = topic ? s.revisionSessions.filter((r) => r.topicId === topic.id && r.studied).sort((a, b) => b.endedAt - a.endedAt)[0] : undefined;

  if (!ids.length || index >= ids.length) {
    return (
      <>
        <PageHeader title="Reviews" back />
        <Page className="text-center pt-10">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-violet/20 text-violet flex items-center justify-center">{results.length ? <Check size={40} /> : <Brain size={40} />}</div>
          <h2 className="text-2xl font-black mt-4">{results.length ? 'Reviews complete!' : 'Nothing due'}</h2>
          <p className="text-sm text-base-400 mt-1">{results.length ? `${results.length} topic${results.length === 1 ? '' : 's'} reviewed. Each one is now stickier in your memory.` : 'Study a topic and it will come back here tomorrow.'}</p>
          {results.length > 0 && (
            <div className="mt-5 rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800 text-left">
              {results.map((r, i) => (
                <div key={i} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-base-100 truncate">{r.name}</span>
                  <span className="text-xs text-base-400">next {r.next.toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}
          <Button className="mt-6" onClick={() => navigate('/academy')}>Back to Academy</Button>
        </Page>
      </>
    );
  }

  const rate = async (rating: ReviewRating) => {
    if (!topic || busy) return;
    setBusy(true);
    const out = await rateReview(topic.id, rating);
    setResults((r) => [...r, { name: topic.name, rating, next: out ? relDay(out.nextReview, s.today) : '' }]);
    setRevealed(false);
    setIndex((i) => i + 1);
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Memory check" subtitle={`${index + 1} of ${ids.length} · +${REVIEW_XP} XP each`} back />
      <Page className="pb-8">
        <Bar value={index / ids.length} color="#a47bff" />
        {topic && (
          <div className="mt-5 rounded-3xl border border-violet/30 bg-gradient-to-br from-violet/10 to-base-900 p-5 text-center animate-slide-up" key={topic.id}>
            <p className="text-xs font-bold" style={{ color: subject?.color }}>{subject?.name}</p>
            <h2 className="text-2xl font-black text-base-50 mt-1">{topic.name}</h2>
            <p className="text-xs text-base-400 mt-1">Review step {Math.min(topic.reviewStage + 1, INTERVALS.length)} · last studied {topic.lastRevised ? relDay(topic.lastRevised, s.today).toLowerCase() : '–'}</p>
            <div className="mt-5 rounded-2xl bg-base-950/50 border border-base-800 p-4 text-sm text-base-200 text-left">
              <p className="font-bold text-base-50 mb-1">Before you rate it:</p>
              <p>Close your notes. Say out loud or write down everything you remember about this topic. Key facts, steps, examples.</p>
            </div>
            {!revealed ? (
              <Button variant="secondary" className="w-full mt-4" onClick={() => setRevealed(true)}>
                <Eye size={16} /> I've tried. Show my last notes
              </Button>
            ) : (
              <div className="mt-4 text-left text-sm rounded-2xl bg-base-900 border border-base-800 p-3">
                {last ? (
                  <>
                    <p className="text-base-200">“{last.studied}”</p>
                    {last.difficult && <p className="text-warn text-xs mt-1">Found difficult: {last.difficult}</p>}
                  </>
                ) : (
                  <p className="text-base-400">No notes saved yet. Check your exercise book or revision guide.</p>
                )}
              </div>
            )}
          </div>
        )}
        <p className="text-sm font-bold text-base-200 mt-5 mb-2 text-center">How much did you remember?</p>
        <div className="grid gap-2">
          <Button size="lg" disabled={busy} className="bg-mint hover:bg-mint/90 justify-between" onClick={() => rate('easy')}>
            Easy <span className="text-xs font-semibold opacity-80">I remembered it</span>
          </Button>
          <Button size="lg" disabled={busy} className="bg-warn hover:bg-warn/90 justify-between" onClick={() => rate('medium')}>
            Medium <span className="text-xs font-semibold opacity-80">I remembered some of it</span>
          </Button>
          <Button size="lg" disabled={busy} className="bg-pink hover:bg-pink/90 justify-between" onClick={() => rate('hard')}>
            Difficult <span className="text-xs font-semibold opacity-80">I struggled</span>
          </Button>
        </div>
        <p className="text-xs text-center text-base-500 mt-3">Difficult topics come back tomorrow. Easy ones wait longer each time.</p>
      </Page>
    </>
  );
}
