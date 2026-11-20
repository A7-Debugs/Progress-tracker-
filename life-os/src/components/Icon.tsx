import { Activity, BookOpen, Briefcase, CalendarCheck, CalendarRange, Compass, Flag, Flame, GraduationCap, HeartPulse, Library, ListChecks, Milestone, NotebookPen, Rocket, Sprout, Tag, Target, Timer, Trophy, Users, Wallet, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { Activity, BookOpen, Briefcase, CalendarCheck, CalendarRange, Compass, Flag, Flame, GraduationCap, HeartPulse, Library, ListChecks, Milestone, NotebookPen, Rocket, Sprout, Tag, Target, Timer, Trophy, Users, Wallet };
export const ICON_NAMES = Object.keys(ICONS);

export function Icon({ name, size = 16, className, strokeWidth = 1.8 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? Tag;
  return <C size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
}
