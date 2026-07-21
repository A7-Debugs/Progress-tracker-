import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, Dumbbell, Clock, TrendingUp, Trophy, Target, Scale, Activity } from 'lucide-react';
import { computeAnalytics } from '@/lib/analytics';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { ProgressChart } from '@/components/charts/ProgressChart';

export default function Analytics() {
  const data = useLiveQuery(computeAnalytics, []);

  if (!data) return null;

  return (
    <div className="animate-fade-in">
      <TopBar title="Progress" showSearch />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Flame} label="Current streak" value={`${data.currentStreak}d`} sub={`Best: ${data.longestStreak}d`} />
          <StatCard icon={Dumbbell} label="Total workouts" value={`${data.totalWorkouts}`} />
          <StatCard icon={Clock} label="Hours trained" value={data.hoursTrained.toFixed(1)} />
          <StatCard icon={Activity} label="Lifetime volume" value={`${Math.round(data.lifetimeVolume).toLocaleString()}kg`} />
          <StatCard icon={Target} label="Exercises tracked" value={`${data.exercisesCompleted}`} />
          <StatCard icon={TrendingUp} label="Frequency" value={`${data.trainingFrequencyPerWeek.toFixed(1)}/wk`} />
        </div>

        {data.mostImprovedLift && (
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-warn/15 flex items-center justify-center shrink-0">
              <Trophy size={18} className="text-warn" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-base-400">Most improved lift</p>
              <p className="font-semibold text-base-50">
                {data.mostImprovedLift.name}{' '}
                <span className="text-accent">
                  {data.mostImprovedLift.pct > 0 ? '+' : ''}
                  {data.mostImprovedLift.pct.toFixed(1)}%
                </span>
              </p>
            </div>
          </Card>
        )}

        {data.currentBodyweight !== null && (
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-info/15 flex items-center justify-center shrink-0">
              <Scale size={18} className="text-info" />
            </div>
            <div>
              <p className="text-xs text-base-400">Current bodyweight</p>
              <p className="font-semibold text-base-50">{data.currentBodyweight}kg</p>
            </div>
          </Card>
        )}

        {data.topMuscleGroup && (
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent-bg flex items-center justify-center shrink-0">
              <Dumbbell size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-base-400">Top trained muscle group</p>
              <p className="font-semibold text-base-50">{data.topMuscleGroup}</p>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <p className="text-sm font-semibold text-base-50 mb-1">Weekly volume trend</p>
          <p className="text-xs text-base-400 mb-2">Avg {Math.round(data.averageWeeklyVolume).toLocaleString()}kg / week</p>
          <ProgressChart data={data.weeklyVolumeTrend} unit="kg" />
        </Card>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mb-2">
            Sets this week by muscle group
          </p>
          <Card className="p-4">
            {data.weeklyVolumeByMuscle.length === 0 ? (
              <p className="text-sm text-base-400">No sets logged this week yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.weeklyVolumeByMuscle.map((m) => {
                  const max = Math.max(...data.weeklyVolumeByMuscle.map((x) => x.sets));
                  return (
                    <div key={m.muscleGroup}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-base-100">{m.muscleGroup}</span>
                        <span className="text-base-400">{m.sets} sets · {Math.round(m.volume).toLocaleString()}kg</span>
                      </div>
                      <div className="h-2 rounded-full bg-base-800 overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${(m.sets / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mb-2">This month</p>
          <Card className="p-4">
            <p className="text-2xl font-bold text-base-50">{Math.round(data.monthlyTotalVolume).toLocaleString()}kg</p>
            <p className="text-xs text-base-400">total volume lifted, last 30 days</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Flame; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3.5">
      <Icon size={16} className="text-accent mb-1.5" />
      <p className="text-xl font-bold text-base-50">{value}</p>
      <p className="text-xs text-base-400">{label}</p>
      {sub && <p className="text-[11px] text-base-500 mt-0.5">{sub}</p>}
    </Card>
  );
}
