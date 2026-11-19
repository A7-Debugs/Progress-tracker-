import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Flag, Play, Trash2 } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { SectionTitle, StatTile } from '@/components/game';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { METHOD_BY_ID, TOPIC_STATUSES } from '@/lib/academy/academy';
import { hasLongEasyReview, statusAllowed } from '@/lib/academy/srs';
import { deleteTopic, markStudiedInClass, setTopicStatus, updateTopic } from '@/lib/actions';
import { fmtDay, fmtShort, relDay } from '@/lib/dates';
import { Lines, ChartCard } from '@/components/charts';
import { cn } from '@/lib/cn';
import type { TopicStatus } from '@/lib/types';

export default function TopicDetail() {
  const { topicId } = useParams();
  const s = useSnapshot();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  if (!s) return <Loading />;
  const t = s.topics.find((x) => x.id === topicId);
  if (!t) return <Loading />;
  const sub = s.subjects.find((x) => x.id === t.subjectId);
  const sessions = s.revisionSessions.filter((r) => r.topicId === t.id).sort((a, b) => b.endedAt - a.endedAt);
  const reviews = s.topicReviews.filter((r) => r.topicId === t.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const longEasy = hasLongEasyReview(s, t.id);
  const practiceTotal = t.practice.reduce((a, p) => a + p.total, 0);
  const practicePct = practiceTotal ? t.practice.reduce((a, p) => a + p.correct, 0) / practiceTotal : null;

  return (
    <>
      <PageHeader title={t.name} subtitle={sub?.name} back />
      <Page className="pb-8">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Sessions" value={sessions.length} sub={`${reviews.length} reviews`} />
          <StatTile label="Practice" value={practicePct === null ? '–' : `${Math.round(practicePct * 100)}%`} sub={practiceTotal ? `${practiceTotal} questions` : 'no questions yet'} color="#3ee8a4" />
          <StatTile label="Next review" value={t.nextReview ? relDay(t.nextReview, s.today) : '–'} sub={t.lastRevised ? `last ${fmtShort(t.lastRevised)}` : 'not studied'} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button onClick={() => navigate(`/academy/start?subject=${t.subjectId}&topic=${t.id}`)}>
            <Play size={16} /> Revise now
          </Button>
          {t.nextReview === null ? (
            <Button variant="secondary" onClick={async () => { await markStudiedInClass(t.id); toast('Added to your review schedule'); }}>
              <CalendarPlus size={16} /> Learnt in class
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => navigate('/academy/reviews')}>
              Reviews
            </Button>
          )}
        </div>

        <SectionTitle>Understanding</SectionTitle>
        <p className="text-xs text-base-400 mb-2">You decide your status. Be honest: it helps the planner put time where it's needed.</p>
        <div className="space-y-1.5">
          {TOPIC_STATUSES.map((st) => {
            const allowed = statusAllowed(t, st.value, longEasy);
            const on = t.status === st.value;
            return (
              <button
                key={st.value}
                onClick={() => (allowed.ok ? setTopicStatus(t.id, st.value as TopicStatus) : toast(allowed.reason!, 'info'))}
                className={cn('w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left', on ? 'bg-base-850' : 'bg-base-900 border-base-800', !allowed.ok && 'opacity-45')}
                style={on ? { borderColor: st.color } : undefined}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: st.color }} />
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: on ? st.color : undefined }}>
                    {st.value + 1}. {st.label}
                  </p>
                  <p className="text-[11px] text-base-400">{allowed.ok ? st.hint : allowed.reason}</p>
                </div>
              </button>
            );
          })}
        </div>

        <SectionTitle>Confidence</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => updateTopic(t.id, { confidence: n })} className={cn('h-12 rounded-xl border text-lg font-black', t.confidence === n ? 'border-accent bg-accent-bg text-accent' : 'border-base-700 bg-base-850 text-base-300')}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-base-500 mt-1 px-1">
          <span>Lost</span>
          <span>Totally got it</span>
        </div>
        {t.confidenceHistory.length >= 2 && (
          <div className="mt-2">
            <ChartCard title="Confidence over time">
              <Lines data={t.confidenceHistory.map((c) => ({ label: fmtShort(c.date), value: c.value }))} series={[{ key: 'value', name: 'Confidence', color: '#3fe3ff' }]} yMax={5} height={130} />
            </ChartCard>
          </div>
        )}
        <div className="flex items-center justify-between mt-3 rounded-2xl bg-base-900 border border-base-800 p-3">
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-warn" />
            <div>
              <p className="text-sm font-semibold text-base-100">Revisit this topic</p>
              <p className="text-xs text-base-400">Flagged {t.difficultCount}× as difficult</p>
            </div>
          </div>
          <Switch checked={t.needsRevisit} onCheckedChange={(needsRevisit) => updateTopic(t.id, { needsRevisit })} />
        </div>

        {t.practice.length > 0 && (
          <>
            <SectionTitle>Practice results</SectionTitle>
            <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
              {[...t.practice].reverse().map((p) => (
                <div key={p.sessionId} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-base-300">{fmtDay(p.date)}</span>
                  <span className="font-bold tabular-nums text-base-50">
                    {p.correct}/{p.total} · {Math.round((p.correct / p.total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <SectionTitle>History</SectionTitle>
        {sessions.length + reviews.length === 0 ? (
          <p className="text-sm text-base-400">No sessions yet.</p>
        ) : (
          <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
            {sessions.map((r) => (
              <div key={r.id} className="px-3 py-2.5">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-base-100">{METHOD_BY_ID[r.method].label}</span>
                  <span className="text-base-400 text-xs">{fmtDay(r.date)} · {Math.floor(r.focusedSeconds / 60)} min · +{r.xp} XP</span>
                </div>
                {r.studied && <p className="text-xs text-base-300 mt-0.5">“{r.studied}”</p>}
                {r.difficult && <p className="text-xs text-warn mt-0.5">Difficult: {r.difficult}</p>}
              </div>
            ))}
            {reviews.map((r) => (
              <div key={r.id} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-base-200">Review · {r.rating === 'easy' ? 'Easy' : r.rating === 'medium' ? 'Medium' : 'Difficult'}</span>
                <span className="text-xs text-base-400">{fmtDay(r.date)}{r.xp ? ` · +${r.xp} XP` : ''}</span>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>Topic</SectionTitle>
        <Input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && updateTopic(t.id, { name: e.target.value.trim().slice(0, 60) })} aria-label="Topic name" />
        <Button variant="danger" className="w-full mt-3" onClick={() => setConfirm(true)}>
          <Trash2 size={16} /> Delete topic
        </Button>
        <Dialog open={confirm} onOpenChange={setConfirm} title={`Delete "${t.name}"?`} description="Its reviews are removed. Sessions stay in your subject history. XP you earned stays.">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={async () => { await deleteTopic(t.id); navigate(-1); }}>Delete</Button>
          </div>
        </Dialog>
      </Page>
    </>
  );
}
