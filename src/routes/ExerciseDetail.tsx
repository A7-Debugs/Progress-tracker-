import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Pencil, Trophy, Weight, TrendingUp, Repeat, Info } from 'lucide-react';
import { db } from '@/lib/db';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ProgressChart, type ChartPoint } from '@/components/charts/ProgressChart';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { estimate1RM, totalVolume, groupBySession, maxWeight, maxReps, best1RM } from '@/lib/calculations';
import { MUSCLE_GROUPS } from '@/lib/types';

export default function ExerciseDetail() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<'weight' | '1rm' | 'volume' | 'reps'>('1rm');

  const def = useLiveQuery(() => db.exerciseDefs.get(exerciseId!), [exerciseId]);
  const sets = useLiveQuery(() => db.setLogs.where('exerciseDefId').equals(exerciseId!).toArray(), [exerciseId]);
  const sessionDatesById = useLiveQuery(async () => {
    if (!sets) return new Map<string, string>();
    const ids = Array.from(new Set(sets.map((s) => s.sessionId)));
    const sessions = await db.sessions.bulkGet(ids);
    const map = new Map<string, string>();
    sessions.forEach((s, i) => s && map.set(ids[i], s.date));
    return map;
  }, [sets]);

  const groups = useMemo(() => (sets ? groupBySession(sets) : []), [sets]);

  const chartData: ChartPoint[] = useMemo(() => {
    return groups.map((g) => {
      const label = sessionDatesById?.get(g.sessionId)
        ? format(new Date(sessionDatesById.get(g.sessionId)! + 'T00:00:00'), 'MMM d')
        : '';
      const working = g.sets.filter((s) => !s.isWarmup);
      let value = 0;
      if (chartMetric === 'weight') value = working.length ? Math.max(...working.map((s) => s.weight)) : 0;
      else if (chartMetric === '1rm') value = working.length ? Math.max(...working.map((s) => estimate1RM(s.weight, s.reps))) : 0;
      else if (chartMetric === 'volume') value = totalVolume(working);
      else if (chartMetric === 'reps') value = working.reduce((sum, s) => sum + s.reps, 0);
      return { label, value: Math.round(value * 10) / 10 };
    });
  }, [groups, chartMetric, sessionDatesById]);

  if (!def || !sets) return null;

  const prWeight = maxWeight(sets);
  const prReps = maxReps(sets);
  const pr1RM = Math.round(best1RM(sets));
  const prVolume = groups.length ? Math.max(...groups.map((g) => totalVolume(g.sets))) : 0;

  return (
    <div className="animate-fade-in">
      <TopBar
        title={def.name}
        back
        right={
          <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} aria-label="Edit">
            <Pencil size={17} />
          </Button>
        }
      />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="accent">{def.muscleGroup}</Badge>
          {def.equipment && <Badge variant="neutral">{def.equipment}</Badge>}
          {def.restTimeSec > 0 && <Badge variant="neutral">{def.restTimeSec}s rest</Badge>}
        </div>

        {sets.length === 0 ? (
          <Card className="p-4 flex items-center gap-2 text-sm text-base-400">
            <Info size={15} /> No sets logged for this exercise yet.
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Weight} label="Heaviest weight" value={`${prWeight}kg`} />
              <StatCard icon={TrendingUp} label="Best est. 1RM" value={`${pr1RM}kg`} />
              <StatCard icon={Repeat} label="Most reps (set)" value={`${prReps}`} />
              <StatCard icon={Trophy} label="Best session volume" value={`${Math.round(prVolume).toLocaleString()}kg`} />
            </div>

            <Card className="p-4">
              <Tabs value={chartMetric} onValueChange={(v) => setChartMetric(v as typeof chartMetric)}>
                <TabsList className="mb-3">
                  <TabsTrigger value="1rm">Est. 1RM</TabsTrigger>
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="volume">Volume</TabsTrigger>
                  <TabsTrigger value="reps">Reps</TabsTrigger>
                </TabsList>
                <TabsContent value={chartMetric}>
                  <ProgressChart data={chartData} unit={chartMetric === 'reps' ? '' : 'kg'} />
                </TabsContent>
              </Tabs>
            </Card>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mb-2">History</p>
              <div className="flex flex-col gap-2">
                {[...groups].reverse().map((g) => (
                  <Card key={g.sessionId} className="p-3.5">
                    <p className="text-xs text-base-400 mb-1.5">
                      {sessionDatesById?.get(g.sessionId)
                        ? format(new Date(sessionDatesById.get(g.sessionId)! + 'T00:00:00'), 'EEEE, MMM d yyyy')
                        : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.sets.map((s) => (
                        <span key={s.id} className="text-sm font-medium text-base-100 bg-base-850 rounded-lg px-2 py-1">
                          {s.weight}kg × {s.reps}
                        </span>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        {def.notes && (
          <Card className="p-4">
            <p className="text-xs font-semibold text-base-400 mb-1">Notes</p>
            <p className="text-sm text-base-100 whitespace-pre-wrap">{def.notes}</p>
          </Card>
        )}

        {def.videoUrl && (
          <a href={def.videoUrl} target="_blank" rel="noreferrer">
            <Card className="p-4 text-sm font-medium text-accent">Watch technique video ↗</Card>
          </a>
        )}
      </div>

      <EditExerciseDialog open={editOpen} onOpenChange={setEditOpen} exerciseId={exerciseId!} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Weight; label: string; value: string }) {
  return (
    <Card className="p-3.5">
      <Icon size={16} className="text-accent mb-1.5" />
      <p className="text-lg font-bold text-base-50">{value}</p>
      <p className="text-xs text-base-400">{label}</p>
    </Card>
  );
}

function EditExerciseDialog({
  open,
  onOpenChange,
  exerciseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  exerciseId: string;
}) {
  const def = useLiveQuery(() => db.exerciseDefs.get(exerciseId), [exerciseId]);
  const [form, setForm] = useState<null | {
    name: string;
    muscleGroup: string;
    equipment: string;
    notes: string;
    restTimeSec: string;
    tempo: string;
    videoUrl: string;
  }>(null);

  const active = form ?? (def
    ? {
        name: def.name,
        muscleGroup: def.muscleGroup,
        equipment: def.equipment,
        notes: def.notes,
        restTimeSec: String(def.restTimeSec || ''),
        tempo: def.tempo,
        videoUrl: def.videoUrl,
      }
    : null);

  if (!active) return null;

  async function save() {
    if (!active) return;
    await db.exerciseDefs.update(exerciseId, {
      name: active.name.trim(),
      muscleGroup: active.muscleGroup as import('@/lib/types').MuscleGroup,
      equipment: active.equipment.trim(),
      notes: active.notes.trim(),
      restTimeSec: Number(active.restTimeSec) || 0,
      tempo: active.tempo.trim(),
      videoUrl: active.videoUrl.trim(),
    });
    onOpenChange(false);
    setForm(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit exercise">
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input value={active.name} onChange={(e) => setForm({ ...active, name: e.target.value })} />
        </Field>
        <Field label="Muscle group">
          <Select
            value={active.muscleGroup}
            onValueChange={(v) => setForm({ ...active, muscleGroup: v })}
            options={MUSCLE_GROUPS.map((m) => ({ value: m, label: m }))}
          />
        </Field>
        <Field label="Equipment">
          <Input value={active.equipment} onChange={(e) => setForm({ ...active, equipment: e.target.value })} />
        </Field>
        <Field label="Tempo">
          <Input placeholder="e.g. 3-1-1" value={active.tempo} onChange={(e) => setForm({ ...active, tempo: e.target.value })} />
        </Field>
        <Field label="Default rest (sec)">
          <Input type="number" value={active.restTimeSec} onChange={(e) => setForm({ ...active, restTimeSec: e.target.value })} />
        </Field>
        <Field label="Video URL">
          <Input placeholder="https://…" value={active.videoUrl} onChange={(e) => setForm({ ...active, videoUrl: e.target.value })} />
        </Field>
        <Field label="Technique notes">
          <Textarea rows={3} value={active.notes} onChange={(e) => setForm({ ...active, notes: e.target.value })} />
        </Field>
        <Button onClick={save} disabled={!active.name.trim()}>
          Save changes
        </Button>
      </div>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-base-400">{label}</label>
      {children}
    </div>
  );
}
