import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Copy, Plus, Trash2, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { NumberField } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { compareToHistory, groupBySession, formatDelta } from '@/lib/calculations';
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

  const [rows, setRows] = useState<Row[]>([]);
  const [seeded, setSeeded] = useState(false);

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
        reps: existing ? String(existing.reps) : '',
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
      if (i < next.length) {
        if (!next[i].weight && !next[i].reps) {
          next[i] = { ...next[i], weight: String(s.weight), reps: String(s.reps) };
        }
      } else {
        next.push({ key: `copy-${i}-${Date.now()}`, dbId: null, weight: String(s.weight), reps: String(s.reps), isWarmup: false });
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
            Target: {workoutExercise.targetSets} × {workoutExercise.targetRepLow}-{workoutExercise.targetRepHigh}
            {workoutExercise.rpeTarget ? ` @ RPE ${workoutExercise.rpeTarget}` : ''}
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
              <span key={s.id}>
                {s.weight}kg×{s.reps}
              </span>
            ))}
          </div>
          <Copy size={14} className="text-accent shrink-0 ml-2" />
        </button>
      ) : (
        <p className="text-xs text-base-500 mb-2">No previous data — first time logging this exercise.</p>
      )}

      {comparison && comparison.weightDelta !== 0 && (
        <div className={`flex items-center gap-1 text-xs font-medium mb-2 ${comparison.weightDelta > 0 ? 'text-accent' : 'text-base-400'}`}>
          {comparison.weightDelta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {formatDelta(comparison.weightDelta, { suffix: 'kg' })} top set vs last time
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[1.5rem_1fr_1fr_1.75rem] gap-2 px-1 text-[11px] font-medium text-base-500">
          <span>Set</span>
          <span>Weight (kg)</span>
          <span>Reps</span>
          <span />
        </div>
        {rows.map((row, idx) => (
          <div key={row.key} className="grid grid-cols-[1.5rem_1fr_1fr_1.75rem] gap-2 items-center">
            <span className="text-sm font-semibold text-base-400 text-center">{idx + 1}</span>
            <NumberField
              placeholder="0"
              value={row.weight}
              onChange={(e) => persist(idx, { weight: e.target.value })}
              onBlur={() => commitRow(idx, rows[idx])}
            />
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
        <Plus size={14} /> Add set
      </Button>
    </div>
  );
}
