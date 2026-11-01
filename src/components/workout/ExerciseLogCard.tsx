import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Copy, Plus, Trash2, Trophy, TrendingUp, TrendingDown, ArrowUpRight, RotateCcw, Target } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { NumberField } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { compareToHistory, groupBySession, formatDelta } from '@/lib/calculations';
import { formatSet, suggestNext } from '@/lib/workoutRules';
import { cn } from '@/lib/cn';
import type { ExerciseDef, SetLog, WorkoutExercise } from '@/lib/types';

interface Row {
  key: string;
  dbId: string | null;
  weight: string;
  reps: string;
  isWarmup: boolean;
}

export function ExerciseLogCard({
  sessionId,
  workoutExercise,
  def,
  onOverload,
}: {
  sessionId: string;
  workoutExercise: WorkoutExercise;
  def: ExerciseDef;
  onOverload?: (message: string) => void;
}) {
  const allSets = useLiveQuery(
    () => db.setLogs.where('exerciseDefId').equals(def.id).toArray(),
    [def.id],
  );

  const priorSets = useMemo(
    () => (allSets ?? []).filter((s) => s.sessionId !== sessionId),
    [allSets, sessionId],
  );
  const lastGroup = useMemo(() => {
    const groups = groupBySession(priorSets);
    return groups[groups.length - 1] ?? null;
  }, [priorSets]);

  const initialFromDb = useMemo(
    () => (allSets ?? []).filter((s) => s.sessionId === sessionId).sort((a, b) => a.setNumber - b.setNumber),
    [allSets, sessionId],
  );

  const timed = def.kind === 'timed';
  const [rows, setRows] = useState<Row[]>([]);
  const [seeded, setSeeded] = useState(false);
  const suggestion = useMemo(
    () => suggestNext(def, workoutExercise.targetRepLow, workoutExercise.targetRepHigh, priorSets),
    [def, workoutExercise.targetRepLow, workoutExercise.targetRepHigh, priorSets],
  );

  useEffect(() => {
    if (seeded || allSets === undefined) return;
    const targetCount = Math.max(workoutExercise.targetSets, initialFromDb.length);
    const nextRows: Row[] = [];
    for (let i = 0; i < targetCount; i++) {
      const existing = initialFromDb[i];
      nextRows.push({
        key: existing?.id ?? `new-${i}`,
        dbId: existing?.id ?? null,
        weight: existing ? String(existing.weight) : '',
        reps: existing ? (existing.durationSec != null ? String(existing.durationSec / 60) : String(existing.reps)) : '',
        isWarmup: existing?.isWarmup ?? false,
      });
    }
    setRows(nextRows);
    setSeeded(true);
  }, [allSets, seeded, initialFromDb, workoutExercise.targetSets]);

  const currentWorkingSets: SetLog[] = useMemo(
    () =>
      rows
        .map((r, i) => ({
          id: r.dbId ?? r.key,
          sessionId,
          exerciseDefId: def.id,
          exerciseName: def.name,
          setNumber: i + 1,
          weight: Number(r.weight) || 0,
          reps: Number(r.reps) || 0,
          rpe: null,
          isWarmup: r.isWarmup,
          createdAt: Date.now(),
        }))
        .filter((s) => s.weight > 0 && s.reps > 0),
    [rows, sessionId, def.id, def.name],
  );

  const comparison = useMemo(
    () => (currentWorkingSets.length ? compareToHistory(currentWorkingSets, priorSets) : null),
    [currentWorkingSets, priorSets],
  );

  useEffect(() => {
    if (!comparison || !onOverload) return;
    if (comparison.isNewPR1RM || comparison.isNewPRWeight || comparison.isNewPRVolume) {
      onOverload(`New PR on ${def.name}!`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison?.isNewPR1RM, comparison?.isNewPRWeight, comparison?.isNewPRVolume]);

  function persist(idx: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  /** Write a single row's weight/reps to IndexedDB and reconcile its dbId. */
  async function commitRowData(idx: number, row: Row) {
    if (timed) {
      const minutes = Number(row.reps) || 0;
      if (minutes <= 0) {
        if (row.dbId) await db.setLogs.delete(row.dbId);
        return null;
      }
      const durationSec = Math.round(minutes * 60);
      if (row.dbId) {
        await db.setLogs.update(row.dbId, { weight: 0, reps: 1, durationSec, setNumber: idx + 1 });
        return row.dbId;
      }
      const id = newId();
      await db.setLogs.add({ id, sessionId, exerciseDefId: def.id, exerciseName: def.name, setNumber: idx + 1, weight: 0, reps: 1, durationSec, rpe: null, isWarmup: false, createdAt: Date.now() });
      return id;
    }
    const weight = Number(row.weight) || 0;
    const reps = Number(row.reps) || 0;
    if (weight <= 0 || reps <= 0) {
      if (row.dbId) await db.setLogs.delete(row.dbId);
      return null;
    }
    if (row.dbId) {
      await db.setLogs.update(row.dbId, { weight, reps, isWarmup: row.isWarmup, setNumber: idx + 1 });
      return row.dbId;
    }
    const id = newId();
    await db.setLogs.add({
      id,
      sessionId,
      exerciseDefId: def.id,
      exerciseName: def.name,
      setNumber: idx + 1,
      weight,
      reps,
      rpe: null,
      isWarmup: row.isWarmup,
      createdAt: Date.now(),
    });
    return id;
  }

  async function commitRow(idx: number, row: Row) {
    const dbId = await commitRowData(idx, row);
    setRows((prev) => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], dbId };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { key: `new-${Date.now()}`, dbId: null, weight: '', reps: '', isWarmup: false }]);
  }

  async function removeRow(idx: number) {
    const row = rows[idx];
    if (row.dbId) await db.setLogs.delete(row.dbId);
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function copyLast() {
    if (!lastGroup) return;
    const working = lastGroup.sets.filter((s) => !s.isWarmup);
    const next = [...rows];
    working.forEach((s, i) => {
      const reps = s.durationSec != null ? String(s.durationSec / 60) : String(s.reps);
      if (i < next.length) {
        if (!next[i].weight && !next[i].reps) {
          next[i] = { ...next[i], weight: String(s.weight), reps };
        }
      } else {
        next.push({ key: `copy-${i}-${Date.now()}`, dbId: null, weight: String(s.weight), reps, isWarmup: false });
      }
    });
    setRows(next);
    const resolved = await Promise.all(next.map((row, idx) => commitRowData(idx, row)));
    setRows(next.map((row, idx) => ({ ...row, dbId: resolved[idx] })));
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <Link to={`/exercises/${def.id}`} className="font-semibold text-base-50 text-[15px] truncate hover:text-accent">
            {def.name}
          </Link>
          <p className="text-xs text-base-400 mt-0.5">
            {timed
              ? `Target: ${workoutExercise.targetSets} rounds × ${workoutExercise.targetRepLow === workoutExercise.targetRepHigh ? workoutExercise.targetRepLow : `${workoutExercise.targetRepLow}-${workoutExercise.targetRepHigh}`} min`
              : `Target: ${workoutExercise.targetSets} × ${workoutExercise.targetRepLow}-${workoutExercise.targetRepHigh}${workoutExercise.rpeTarget ? ` @ RPE ${workoutExercise.rpeTarget}` : ''}`}
          </p>
        </div>
        {comparison && (comparison.isNewPRWeight || comparison.isNewPR1RM || comparison.isNewPRVolume) && (
          <Badge variant="warn">
            <Trophy size={11} /> PR
          </Badge>
        )}
        {comparison && !comparison.isNewPRWeight && !comparison.isNewPR1RM && !comparison.isNewPRVolume && comparison.improved && (
          <Badge variant="accent">
            <TrendingUp size={11} /> Improved
          </Badge>
        )}
      </div>

      {lastGroup ? (
        <button
          onClick={copyLast}
          className="w-full flex items-center justify-between rounded-xl bg-base-850 border border-base-800 px-3 py-2 mb-2 text-left"
        >
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-base-400">
            <span className="text-base-500 font-medium">Last:</span>
            {lastGroup.sets.filter((s) => !s.isWarmup).map((s) => (
              <span key={s.id}>{formatSet(s)}</span>
            ))}
          </div>
          <Copy size={14} className="text-accent shrink-0 ml-2" />
        </button>
      ) : (
        <p className="text-xs text-base-500 mb-2">No previous data — first time logging this exercise.</p>
      )}

      {suggestion && (
        <div
          className={cn(
            'flex items-start gap-1.5 rounded-xl px-3 py-2 mb-2 text-xs',
            suggestion.kind === 'deload' ? 'bg-warn/10 text-warn' : suggestion.kind === 'add' ? 'bg-accent-bg text-accent' : 'bg-base-850 text-base-300',
          )}
        >
          {suggestion.kind === 'deload' ? <RotateCcw size={13} className="mt-px shrink-0" /> : suggestion.kind === 'add' ? <ArrowUpRight size={13} className="mt-px shrink-0" /> : <Target size={13} className="mt-px shrink-0" />}
          <span>
            <span className="font-semibold">Next: </span>
            {suggestion.message}
          </span>
        </div>
      )}

      {comparison && comparison.weightDelta !== 0 && (
        <div className={`flex items-center gap-1 text-xs font-medium mb-2 ${comparison.weightDelta > 0 ? 'text-accent' : 'text-base-400'}`}>
          {comparison.weightDelta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {formatDelta(comparison.weightDelta, { suffix: 'kg' })} top set vs last time
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className={cn('grid gap-2 px-1 text-[11px] font-medium text-base-500', timed ? 'grid-cols-[1.5rem_1fr_1.75rem]' : 'grid-cols-[1.5rem_1fr_1fr_1.75rem]')}>
          <span>{timed ? 'Rd' : 'Set'}</span>
          {!timed && <span>Weight (kg)</span>}
          <span>{timed ? 'Minutes' : 'Reps'}</span>
          <span />
        </div>
        {rows.map((row, idx) => (
          <div key={row.key} className={cn('grid gap-2 items-center', timed ? 'grid-cols-[1.5rem_1fr_1.75rem]' : 'grid-cols-[1.5rem_1fr_1fr_1.75rem]')}>
            <span className="text-sm font-semibold text-base-400 text-center">{idx + 1}</span>
            {!timed && (
              <NumberField
                placeholder={suggestion && !row.weight ? String(suggestion.weight) : '0'}
                value={row.weight}
                onChange={(e) => persist(idx, { weight: e.target.value })}
                onBlur={() => commitRow(idx, rows[idx])}
              />
            )}
            <NumberField
              placeholder="0"
              value={row.reps}
              onChange={(e) => persist(idx, { reps: e.target.value })}
              onBlur={() => commitRow(idx, rows[idx])}
            />
            <button
              onClick={() => removeRow(idx)}
              className="h-8 w-7 flex items-center justify-center text-base-500 hover:text-danger"
              aria-label="Remove set"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={addRow}>
        <Plus size={14} /> {timed ? 'Add round' : 'Add set'}
      </Button>
      {!timed && workoutExercise.rpeTarget && <LastSetRpe rows={rows} sets={allSets ?? []} target={workoutExercise.rpeTarget} />}
    </div>
  );
}

/** One question per exercise instead of RPE on every set: how hard was the last working set? */
function LastSetRpe({ rows, sets, target }: { rows: Row[]; sets: SetLog[]; target: number }) {
  const last = [...rows].reverse().find((r) => r.dbId && !r.isWarmup);
  if (!last?.dbId) return null;
  const current = sets.find((s) => s.id === last.dbId)?.rpe ?? null;
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="text-[11px] text-base-500 shrink-0">Last set RPE (target {target})</span>
      {[6, 7, 8, 9, 10].map((v) => (
        <button
          key={v}
          onClick={() => db.setLogs.update(last.dbId!, { rpe: current === v ? null : v })}
          className={cn(
            'h-7 w-7 rounded-lg text-xs font-semibold border',
            current === v ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-400 border-base-700',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
