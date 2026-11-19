import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { SectionTitle, StatTile } from '@/components/game';
import { Bars, ChartCard, Lines } from '@/components/charts';
import { countsAsSession, effectiveRevisionTarget, METHOD_BY_ID, sessionsInWeek, TOPIC_STATUSES } from '@/lib/academy/academy';
import { addDays, fmtDuration, fmtShort, weekStart } from '@/lib/dates';
import type { Snapshot } from '@/lib/snapshot';

function build(s: Snapshot) {
  const ws = weekStart(s.today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i))).filter((w) => addDays(w, 6) >= s.profile.startDate);
  const target = effectiveRevisionTarget(s).perWeek;
  const sessions = s.revisionSessions.filter(countsAsSession);
  const weekly = weeks.map((w) => {
    const ss = sessionsInWeek(s, w);
    const end = addDays(w, 6);
    const practice = s.revisionSessions.filter((r) => r.date >= w && r.date <= end && r.practiceTotal);
    const pc = practice.reduce((a, r) => a + (r.practiceCorrect ?? 0), 0);
    const pt = practice.reduce((a, r) => a + (r.practiceTotal ?? 0), 0);
    return {
      label: fmtShort(w),
      sessions: ss.length,
      minutes: ss.reduce((a, r) => a + Math.floor(r.focusedSeconds / 60), 0),
      practice: pt ? Math.round((pc / pt) * 100) : null,
      topics: new Set(ss.map((r) => r.topicId).filter(Boolean)).size,
      reviews: s.topicReviews.filter((r) => r.date >= w && r.date <= end).length,
    };
  });
  const completedWeeks = weeks.filter((w) => w < ws);
  const hitWeeks = completedWeeks.filter((w) => target > 0 && sessionsInWeek(s, w).length >= target).length;
  const bySubject = s.subjects
    .filter((x) => !x.archived)
    .map((sub) => {
      const ss = sessions.filter((r) => r.subjectId === sub.id);
      const ts = s.topics.filter((t) => t.subjectId === sub.id);
      const pr = ts.flatMap((t) => t.practice);
      const pt = pr.reduce((a, p) => a + p.total, 0);
      return {
        sub,
        label: sub.name.length > 10 ? sub.name.slice(0, 9) + '…' : sub.name,
        sessions: ss.length,
        minutes: ss.reduce((a, r) => a + Math.floor(r.focusedSeconds / 60), 0),
        topics: ts.length,
        studied: ts.filter((t) => t.firstStudied).length,
        understood: ts.filter((t) => t.status >= 3).length,
        practicePct: pt ? Math.round((pr.reduce((a, p) => a + p.correct, 0) / pt) * 100) : null,
      };
    });
  const statusDist = TOPIC_STATUSES.map((st) => ({ ...st, count: s.topics.filter((t) => t.status === st.value).length }));
  const improved = s.topics.filter((t) => t.confidenceHistory.length >= 2 && t.confidenceHistory.at(-1)!.value > t.confidenceHistory[0].value);
  const difficult = s.topics
    .filter((t) => t.difficultCount >= 2 || s.topicReviews.filter((r) => r.topicId === t.id && r.rating === 'hard').length >= 2)
    .sort((a, b) => b.difficultCount - a.difficultCount);
  const methods = Object.values(METHOD_BY_ID)
    .map((m) => ({ label: m.label.split(' ')[0], count: sessions.filter((r) => r.method === m.id).length }))
    .filter((m) => m.count > 0);
  const allPractice = s.revisionSessions.filter((r) => r.practiceTotal);
  const pTotal = allPractice.reduce((a, r) => a + (r.practiceTotal ?? 0), 0);
  return {
    weekly,
    hitWeeks,
    completedWeeks: completedWeeks.length,
    target,
    bySubject,
    statusDist,
    improved,
    difficult,
    methods,
    totalMinutes: sessions.reduce((a, r) => a + Math.floor(r.focusedSeconds / 60), 0),
    sessions: sessions.length,
    topicsStudied: s.topics.filter((t) => t.firstStudied).length,
    topicsReviewed: new Set(s.topicReviews.map((r) => r.topicId)).size,
    practicePct: pTotal ? Math.round((allPractice.reduce((a, r) => a + (r.practiceCorrect ?? 0), 0) / pTotal) * 100) : null,
    pTotal,
  };
}

export default function AcademyStats() {
  const s = useSnapshot();
  const d = useMemo(() => (s ? build(s) : null), [s]);
  if (!s || !d) return <Loading />;
  const totalTopics = s.topics.length;
  return (
    <>
      <PageHeader title="Academy analytics" subtitle="Time, coverage, understanding and proof" back />
      <Page className="pb-8">
        <p className="text-xs text-base-400 rounded-xl bg-base-900 border border-base-800 p-3">
          Time spent isn't the same as learning. These four sections are kept separate on purpose: <b className="text-base-200">time invested</b>, <b className="text-base-200">topics covered</b>, <b className="text-base-200">how well you understand them</b>, and <b className="text-base-200">what practice questions prove</b>.
        </p>

        <SectionTitle>1 · Time invested</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Focus time" value={fmtDuration(d.totalMinutes)} color="#a47bff" />
          <StatTile label="Sessions" value={d.sessions} />
          <StatTile label="Target hit" value={d.completedWeeks ? `${d.hitWeeks}/${d.completedWeeks}` : '–'} sub="weeks" color="#3ee8a4" />
        </div>
        <div className="space-y-2 mt-2">
          <ChartCard title="Sessions per week" subtitle={d.target ? `Dashed line = your target (${d.target})` : undefined} empty={d.sessions === 0 ? 'Complete a focus session to start your chart.' : null}>
            <Bars data={d.weekly} series={[{ key: 'sessions', name: 'Sessions', color: '#a47bff' }]} refLine={d.target ? { y: d.target, label: 'target' } : undefined} />
          </ChartCard>
          <ChartCard title="Sessions per subject" empty={d.sessions === 0 ? 'No sessions yet.' : null}>
            <Bars data={d.bySubject} series={[{ key: 'sessions', name: 'Sessions', color: '#3fe3ff' }]} />
          </ChartCard>
          {d.methods.length > 0 && (
            <ChartCard title="Methods used" subtitle="Active recall and practice build the strongest memory">
              <Bars data={d.methods} series={[{ key: 'count', name: 'Sessions', color: '#ff5fa2' }]} />
            </ChartCard>
          )}
        </div>

        <SectionTitle>2 · Topics covered</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Studied" value={`${d.topicsStudied}/${totalTopics}`} />
          <StatTile label="Reviewed" value={d.topicsReviewed} sub="spaced reps" />
          <StatTile label="This week" value={d.weekly.at(-1)?.topics ?? 0} sub="topics" />
        </div>

        <SectionTitle>3 · Understanding (your ratings)</SectionTitle>
        <div className="rounded-2xl bg-base-900 border border-base-800 p-3">
          {totalTopics === 0 ? (
            <p className="text-sm text-base-400">Add topics to your subjects to track understanding.</p>
          ) : (
            <>
              <div className="flex h-4 rounded-full overflow-hidden">
                {d.statusDist.filter((x) => x.count).map((x) => (
                  <div key={x.value} style={{ width: `${(x.count / totalTopics) * 100}%`, background: x.color }} title={`${x.label}: ${x.count}`} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
                {d.statusDist.map((x) => (
                  <div key={x.value} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
                    <span className="flex-1 text-base-300">{x.label}</span>
                    <span className="font-bold tabular-nums text-base-100">{x.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <p className="text-xs text-base-400 mt-2">
          {d.improved.length ? `Confidence has gone up on ${d.improved.length} topic${d.improved.length === 1 ? '' : 's'}: ${d.improved.slice(0, 3).map((t) => t.name).join(', ')}.` : 'Rate your confidence after each session to see it improve over time.'}
        </p>

        <SectionTitle>4 · Demonstrated knowledge (practice)</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Practice score" value={d.practicePct === null ? '–' : `${d.practicePct}%`} sub={`${d.pTotal} questions`} color="#3ee8a4" />
          <StatTile label="Best subject" value={[...d.bySubject].filter((x) => x.practicePct !== null).sort((a, b) => b.practicePct! - a.practicePct!)[0]?.sub.name ?? '–'} sub="by practice %" />
        </div>
        <div className="mt-2">
          <ChartCard title="Practice question score" subtitle="Weekly % correct" empty={d.pTotal === 0 ? 'Use the Practice or Exam-style method and record your score.' : null}>
            <Lines data={d.weekly} series={[{ key: 'practice', name: 'Score', color: '#3ee8a4' }]} unit="%" yMax={100} />
          </ChartCard>
        </div>

        {d.difficult.length > 0 && (
          <>
            <SectionTitle>Topics repeatedly difficult</SectionTitle>
            <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
              {d.difficult.slice(0, 8).map((t) => (
                <Link key={t.id} to={`/academy/topic/${t.id}`} className="flex justify-between px-3 py-2.5 text-sm">
                  <span className="text-base-100 truncate">{t.name}</span>
                  <span className="text-xs text-warn shrink-0">flagged {t.difficultCount}×</span>
                </Link>
              ))}
            </div>
            <p className="text-xs text-base-400 mt-1.5">Try "Reviewing mistakes" or ask your teacher about these. Struggling is how learning works.</p>
          </>
        )}

        <SectionTitle>By subject</SectionTitle>
        <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
          {d.bySubject.map((x) => (
            <Link key={x.sub.id} to={`/academy/subject/${x.sub.id}`} className="block px-3 py-2.5">
              <div className="flex justify-between text-sm">
                <span className="font-bold" style={{ color: x.sub.color }}>{x.sub.name}</span>
                <span className="text-base-300 text-xs">{fmtDuration(x.minutes)}</span>
              </div>
              <p className="text-xs text-base-400 mt-0.5">
                {x.sessions} sessions · {x.studied}/{x.topics} topics studied · {x.understood} understood{x.practicePct !== null ? ` · practice ${x.practicePct}%` : ''}
              </p>
            </Link>
          ))}
        </div>
      </Page>
    </>
  );
}
