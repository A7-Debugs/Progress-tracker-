import { useNavigate } from 'react-router-dom';
import { Scale, Camera, CalendarDays, Dumbbell, History, Settings, ChevronRight, Search } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';

const ITEMS = [
  { to: '/bodyweight', icon: Scale, label: 'Bodyweight & Health', desc: 'Weight, body fat, sleep, nutrition' },
  { to: '/photos', icon: Camera, label: 'Progress Photos', desc: 'Front, side, back comparisons' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar', desc: 'Training days & streaks' },
  { to: '/exercises', icon: Dumbbell, label: 'Exercise Library', desc: 'Browse & edit exercises' },
  { to: '/history', icon: History, label: 'Workout History', desc: 'Every completed session' },
  { to: '/search', icon: Search, label: 'Search', desc: 'Find exercises, workouts, PRs' },
  { to: '/settings', icon: Settings, label: 'Settings', desc: 'Units, reminders, backup' },
];

export default function Me() {
  const navigate = useNavigate();
  return (
    <div className="animate-fade-in">
      <TopBar title="Me" />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-2.5">
        {ITEMS.map(({ to, icon: Icon, label, desc }) => (
          <Card
            key={to}
            className="p-4 flex items-center gap-3 cursor-pointer active:bg-base-850"
            onClick={() => navigate(to)}
          >
            <div className="h-10 w-10 rounded-xl bg-base-800 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base-50">{label}</p>
              <p className="text-xs text-base-400">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-base-500 shrink-0" />
          </Card>
        ))}
      </div>
    </div>
  );
}
