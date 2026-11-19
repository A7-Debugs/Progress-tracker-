import { Link } from 'react-router-dom';
import { ChevronRight, Lock, Settings as Cog } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Avatar, Medal, SectionTitle, StatTile, XpBar } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/ui/Input';
import { AVATAR_ICONS, FRAMES, PALETTES, availableTitles, isUnlocked, unlockHint } from '@/lib/avatar';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '@/lib/achievements';
import { currentLevel, streakInfo, xpBetween } from '@/lib/performance';
import { updateProfile } from '@/lib/actions';
import { rankFor } from '@/lib/levels';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/Toaster';

export default function Profile() {
  const s = useSnapshot();
  const toast = useToast();
  if (!s) return <Loading />;
  const level = currentLevel(s);
  const achieved = new Set(s.achievements.keys());
  const titles = availableTitles(level.level, achieved);
  const streak = streakInfo(s);
  const a = s.profile.avatar;
  const setAvatar = (patch: Partial<typeof a>) => updateProfile({ avatar: { ...a, ...patch } });
  const locked = (u: Parameters<typeof isUnlocked>[0]) => !isUnlocked(u, level.level, achieved);
  const tryPick = (u: Parameters<typeof isUnlocked>[0], fn: () => void) => (locked(u) ? toast(`Locked: ${unlockHint(u)}`, 'info') : fn());

  return (
    <>
      <PageHeader title="Profile" back right={<Link to="/settings" className="h-10 w-10 rounded-xl flex items-center justify-center text-base-300" aria-label="Settings"><Cog size={20} /></Link>} />
      <Page className="pb-8">
        <div className="flex flex-col items-center text-center pt-2">
          <Avatar config={a} size={120} level={level.level} />
          <Input
            defaultValue={s.profile.nickname}
            onBlur={(e) => updateProfile({ nickname: e.target.value.trim().slice(0, 20) })}
            placeholder="Gamer tag (optional)"
            maxLength={20}
            className="mt-4 text-center text-lg font-black bg-transparent border-transparent focus:bg-base-850 max-w-xs"
            aria-label="Gamer tag"
          />
          <p className="text-sm font-bold text-accent">{s.profile.title}</p>
          <p className="text-xs text-base-400">Rank: {rankFor(level.level)} · Level {level.level}</p>
          <div className="w-full max-w-xs mt-3">
            <XpBar value={level.progress} />
            <p className="text-[11px] text-base-400 mt-1 tabular-nums">{level.remaining} XP to level {level.level + 1}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <StatTile label="Total XP" value={level.total.toLocaleString()} color="#ffc845" />
          <StatTile label="Academic" value={xpBetween(s, '0000-01-01', s.today, 'academic').toLocaleString()} sub="XP" color="#a47bff" />
          <StatTile label="Best streak" value={`${streak.longest}d`} color="#ff8a3d" />
        </div>

        <SectionTitle>Title</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {titles.map((t) => (
            <button key={t} onClick={() => updateProfile({ title: t })} className={cn('h-9 px-3 rounded-xl text-sm font-bold border', s.profile.title === t ? 'border-accent bg-accent-bg text-accent' : 'border-base-700 bg-base-850 text-base-200')}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-base-500 mt-1.5">Earn more titles from levels and badges.</p>

        <SectionTitle>Emblem</SectionTitle>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_ICONS.map((u) => (
            <button key={u.id} onClick={() => tryPick(u, () => setAvatar({ icon: u.id }))} className={cn('relative aspect-square rounded-xl flex items-center justify-center border', a.icon === u.id ? 'border-accent bg-accent-bg text-accent' : 'border-base-700 bg-base-850 text-base-200', locked(u) && 'opacity-35')} aria-label={u.label}>
              <Icon name={u.id} size={20} />
              {locked(u) && <Lock size={10} className="absolute bottom-1 right-1 text-base-300" />}
            </button>
          ))}
        </div>

        <SectionTitle>Colours</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {PALETTES.map((p) => (
            <button key={p.id} onClick={() => tryPick(p, () => setAvatar({ palette: p.id }))} className={cn('relative rounded-xl p-1 border', a.palette === p.id ? 'border-base-50' : 'border-base-800', locked(p) && 'opacity-35')} aria-label={p.label}>
              <div className="h-9 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }} />
              <p className="text-[10px] text-base-300 mt-1 truncate">{p.label}</p>
              {locked(p) && <Lock size={10} className="absolute top-2 right-2 text-base-50" />}
            </button>
          ))}
        </div>

        <SectionTitle>Frame</SectionTitle>
        <div className="grid grid-cols-6 gap-2">
          {FRAMES.map((f) => (
            <button key={f.id} onClick={() => tryPick(f, () => setAvatar({ frame: f.id }))} className={cn('relative rounded-xl p-1 border flex flex-col items-center', a.frame === f.id ? 'border-accent' : 'border-base-800', locked(f) && 'opacity-35')} aria-label={f.label}>
              <Avatar config={{ ...a, frame: f.id }} size={40} />
              <p className="text-[10px] text-base-300 truncate">{f.label}</p>
            </button>
          ))}
        </div>

        <SectionTitle right={<Link to="/achievements" className="text-xs font-semibold text-accent">See all</Link>}>Badges · {s.achievements.size}/{ACHIEVEMENTS.length}</SectionTitle>
        <Link to="/achievements" className="flex flex-wrap gap-1 rounded-2xl bg-base-900 border border-base-800 p-3 items-center">
          {s.achievements.size === 0 && <span className="text-sm text-base-400">Your first badge is one good day away.</span>}
          {[...s.achievements.values()].sort((x, y) => y.unlockedAt - x.unlockedAt).slice(0, 10).map((r) => ACHIEVEMENT_BY_ID[r.id] && <Medal key={r.id} def={ACHIEVEMENT_BY_ID[r.id]} unlocked size={40} />)}
          <ChevronRight size={18} className="ml-auto text-base-500" />
        </Link>
        <p className="text-xs text-base-500 mt-6 text-center">Your profile is private. It lives only on this phone. No leaderboards, no public profiles.</p>
      </Page>
    </>
  );
}
