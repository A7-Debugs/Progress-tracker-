import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, Plus, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { downloadBackup, restoreBackup, saveFile, toCsv, wipeEverything } from '@/lib/backup';
import { buildIcs } from '@/lib/schedule';
import { disableLock, setPasscode, validPasscode } from '@/lib/lock';
import { CATEGORY_COLORS, DASHBOARD_CARDS, DEFAULT_XP } from '@/lib/defaults';
import { AI_MODELS } from '@/lib/ai/provider';
import { totalXpForLevel } from '@/lib/progression';
import type { DashboardCard, ThemePref, XpConfig } from '@/lib/types';
import { Page, PageHeader } from '@/components/layout';
import { Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Confirm } from '@/components/ui/Dialog';
import { Field, Segmented } from '@/components/ui/Chips';
import { Input, NumberField } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toaster';
import { Icon, ICON_NAMES } from '@/components/Icon';

export default function Settings() {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [loc.hash]);
  return (
    <>
      <PageHeader title="Settings" subtitle="Make Life OS fit how you work" />
      <Page className="max-w-3xl space-y-4">
        <Appearance />
        <Dashboard />
        <Categories />
        <Progression />
        <Security />
        <Ai />
        <Data />
        <p className="text-center text-xs text-fg-3 py-4">Life OS · data stored locally on this device in IndexedDB · works offline</p>
      </Page>
    </>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="text-xs text-fg-3">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Appearance() {
  const { s } = useStore();
  const [name, setName] = useState(s.profile.name);
  return (
    <Panel title="Profile & appearance">
      <Row label="Name">
        <Input className="h-8 w-44" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && A.updateProfile({ name: name.trim().slice(0, 40) })} aria-label="Name" />
      </Row>
      <Row label="Theme">
        <Segmented<ThemePref> size="sm" value={s.settings.theme} onChange={(theme) => A.updateSettings({ theme })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </Row>
      <Row label="New day starts at" hint="Late-night activity before this counts for the previous day">
        <Select className="h-8 w-24" value={String(s.settings.dayStartHour)} onValueChange={(v) => A.updateSettings({ dayStartHour: Number(v) })} options={[0, 1, 2, 3, 4, 5, 6].map((h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }))} />
      </Row>
      <Row label="Daily focus target" hint="Used in the productivity score">
        <NumberField className="h-8 w-24" min={0} max={720} value={s.settings.dailyFocusTargetMin} onChange={(e) => A.updateSettings({ dailyFocusTargetMin: Number(e.target.value) })} aria-label="Daily focus target minutes" />
      </Row>
      <Row label="Reduce motion">
        <Switch checked={s.settings.reduceMotion} onCheckedChange={(v) => A.updateSettings({ reduceMotion: v })} ariaLabel="Reduce motion" />
      </Row>
      <Row label="Vibration feedback" hint="Android">
        <Switch checked={s.settings.haptics} onCheckedChange={(v) => A.updateSettings({ haptics: v })} ariaLabel="Vibration" />
      </Row>
    </Panel>
  );
}

function Dashboard() {
  const { s } = useStore();
  const order = s.settings.dashboardOrder;
  const move = (c: DashboardCard, dir: -1 | 1) => {
    const i = order.indexOf(c);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    A.updateSettings({ dashboardOrder: next });
  };
  return (
    <Panel title="Dashboard" subtitle="Choose and order the cards on your command centre">
      <Row label="Show advanced cards straight away" hint="Otherwise schedule, weekly overview and insights appear after your first few days">
        <Switch checked={s.settings.showAdvanced} onCheckedChange={(v) => A.updateSettings({ showAdvanced: v })} ariaLabel="Show advanced cards" />
      </Row>
      {order.map((c, i) => (
        <div key={c} className="flex items-center gap-2 py-2 border-b border-line last:border-0">
          <Switch checked={s.settings.dashboard[c]} onCheckedChange={(v) => A.updateSettings({ dashboard: { ...s.settings.dashboard, [c]: v } })} ariaLabel={`Show ${c}`} />
          <span className="flex-1 text-[13px]">{DASHBOARD_CARDS.find((d) => d.id === c)?.label}</span>
          <Button size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => move(c, -1)} aria-label="Move up">
            <ArrowUp size={14} />
          </Button>
          <Button size="icon-sm" variant="ghost" disabled={i === order.length - 1} onClick={() => move(c, 1)} aria-label="Move down">
            <ArrowDown size={14} />
          </Button>
        </div>
      ))}
    </Panel>
  );
}

function Categories() {
  const { s } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  return (
    <Panel title="Life categories" subtitle="Rename, recolour, hide or add your own">
      <ul>
        {s.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2 border-b border-line last:border-0">
            <label className="relative h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer shrink-0" style={{ background: `${c.color}22`, color: c.color }} title="Change colour">
              <Icon name={c.icon} size={14} />
              <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={c.color} onChange={(e) => A.updateCategory(c.id, { color: e.target.value })} aria-label={`Colour for ${c.name}`} />
            </label>
            <Input className="h-8 flex-1" defaultValue={c.name} onBlur={(e) => e.target.value.trim() !== c.name && A.updateCategory(c.id, { name: e.target.value }).catch((er) => toast(er.message, 'error'))} aria-label="Category name" />
            <Select className="h-8 w-28" value={c.icon} onValueChange={(icon) => A.updateCategory(c.id, { icon })} options={ICON_NAMES.map((n) => ({ value: n, label: n }))} ariaLabel="Icon" />
            <Switch checked={!c.archived} onCheckedChange={(v) => A.updateCategory(c.id, { archived: !v })} ariaLabel={`Show ${c.name}`} />
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2 mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await A.addCategory(name, CATEGORY_COLORS[s.categories.length % CATEGORY_COLORS.length]);
            setName('');
            toast('Category added');
          } catch (er) {
            toast((er as Error).message, 'error');
          }
        }}
      >
        <Input className="h-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Spirituality" />
        <Button type="submit" size="sm" variant="secondary" className="h-9" disabled={!name.trim()}>
          <Plus size={14} /> Add
        </Button>
      </form>
    </Panel>
  );
}

const XP_FIELDS: { k: keyof XpConfig; label: string }[] = [
  { k: 'taskEasy', label: 'Easy task' },
  { k: 'taskMedium', label: 'Medium task' },
  { k: 'taskHard', label: 'Hard task' },
  { k: 'habitEasy', label: 'Easy habit' },
  { k: 'habitMedium', label: 'Medium habit' },
  { k: 'habitHard', label: 'Hard habit' },
  { k: 'milestone', label: 'Milestone' },
  { k: 'majorMilestone', label: 'Major milestone' },
  { k: 'goal', label: 'Annual goal achieved' },
  { k: 'weeklyReview', label: 'Weekly review' },
  { k: 'consistencyWeek', label: 'Consistent week (80%+)' },
  { k: 'focusPer25', label: 'Per 25 focused minutes' },
  { k: 'dailyTaskCap', label: 'Daily task XP cap' },
  { k: 'dailyFocusCap', label: 'Daily focus XP cap' },
];

function Progression() {
  const { s } = useStore();
  const [xp, setXp] = useState(s.settings.xp);
  useEffect(() => {
    setXp(s.settings.xp);
  }, [s.settings.xp]);
  return (
    <Panel title="XP & progression" subtitle="XP is recalculated from your history, so changes apply retroactively">
      <Row label="Level pace" hint={`Level 5 needs ${totalXpForLevel(5, s.settings.levelPace).toLocaleString()} XP · level 10 needs ${totalXpForLevel(10, s.settings.levelPace).toLocaleString()} XP`}>
        <Segmented size="sm" value={s.settings.levelPace} onChange={(v) => A.updateSettings({ levelPace: v })} options={[{ value: 0.75, label: 'Faster' }, { value: 1, label: 'Standard' }, { value: 1.5, label: 'Slower' }, { value: 2, label: 'Hardcore' }]} />
      </Row>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {XP_FIELDS.map((f) => (
          <Field key={f.k} label={f.label}>
            <NumberField className="h-9" min={0} value={xp[f.k]} onChange={(e) => setXp({ ...xp, [f.k]: Number(e.target.value) })} />
          </Field>
        ))}
      </div>
      <p className="text-xs text-fg-3 mt-3">Caps stop low-value repetition from inflating your level. Milestones ticked on the day they're added, and goals completed very soon after being set, don't earn XP.</p>
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={() => A.updateSettings({ xp })} disabled={JSON.stringify(xp) === JSON.stringify(s.settings.xp)}>
          Save XP values
        </Button>
        <Button size="sm" variant="ghost" onClick={() => A.updateSettings({ xp: { ...DEFAULT_XP } })}>
          Reset to defaults
        </Button>
      </div>
    </Panel>
  );
}

function Security() {
  const { s } = useStore();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [timeout, setTimeoutMin] = useState(s.settings.lock.timeoutMin);
  return (
    <Panel title="Passcode lock" subtitle="Protects the app on this device. Your data never leaves the device unless you export it.">
      {s.settings.lock.enabled ? (
        <>
          <Row label="Lock is on" hint={`Locks on start and after ${s.settings.lock.timeoutMin} minutes in the background`}>
            <Button size="sm" variant="danger" onClick={() => disableLock().then(() => toast('Passcode removed'))}>
              Turn off
            </Button>
          </Row>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="New passcode (4–8 digits)">
            <Input className="h-9 w-40" inputMode="numeric" type="password" autoComplete="new-password" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          </Field>
          <Field label="Re-lock after">
            <Select className="h-9 w-32" value={String(timeout)} onValueChange={(v) => setTimeoutMin(Number(v))} options={[1, 5, 15, 60].map((m) => ({ value: String(m), label: `${m} min` }))} />
          </Field>
          <Button size="sm" className="h-9" disabled={!validPasscode(code)} onClick={() => setPasscode(code, timeout).then(() => { sessionStorage.setItem('life-os:unlocked-at', String(Date.now())); setCode(''); toast('Passcode set'); })}>
            Set passcode
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Ai() {
  const { s } = useStore();
  const toast = useToast();
  const [key, setKey] = useState(s.settings.ai.apiKey);
  const connected = s.settings.ai.provider === 'anthropic' && s.settings.ai.apiKey.length > 20;
  return (
    <div id="ai" className="scroll-mt-20">
      <Panel title="AI assistant" subtitle="Optional. Uses your own Anthropic API key; requests go directly from this device to Anthropic.">
        <div className="space-y-3">
          <Field label="Anthropic API key" hint="Stored only on this device and never included in backups. Usage is billed to your Anthropic account.">
            <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
          </Field>
          <Field label="Model">
            <Select value={s.settings.ai.model} onValueChange={(model) => A.updateSettings({ ai: { ...s.settings.ai, model } })} options={AI_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" disabled={key.trim().length < 20} onClick={() => A.updateSettings({ ai: { ...s.settings.ai, provider: 'anthropic', apiKey: key.trim() } }).then(() => toast('Assistant connected'))}>
              {connected ? 'Update key' : 'Connect'}
            </Button>
            {connected && (
              <Button size="sm" variant="ghost" onClick={() => A.updateSettings({ ai: { ...s.settings.ai, provider: 'none', apiKey: '' } }).then(() => (setKey(''), toast('Disconnected')))}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Data() {
  const { s } = useStore();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [wipe, setWipe] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const exportCsv = async () => {
    const rows = s.tasks.map((t) => ({ title: t.title, done: t.done, priority: t.priority, difficulty: t.difficulty, planned: t.plannedDate, due: t.dueDate, completed: t.completedDate, estimate_min: t.estimateMin, goal: t.goalId ? s.goalById.get(t.goalId)?.title : '', category: s.categoryById.get(t.categoryId ?? '')?.name ?? '', postponed: t.postponed }));
    await saveFile('life-os-tasks.csv', toCsv(rows, Object.keys(rows[0] ?? { title: '' })), 'text/csv');
    const logs = [...s.habitLogs.values()].map((l) => ({ date: l.date, habit: s.habits.find((h) => h.id === l.habitId)?.name ?? '', status: l.status, count: l.count }));
    await saveFile('life-os-habit-log.csv', toCsv(logs, ['date', 'habit', 'status', 'count']), 'text/csv');
  };
  return (
    <Panel title="Your data" subtitle={s.settings.lastBackupAt ? `Last backup ${new Date(s.settings.lastBackupAt).toLocaleDateString('en-GB')}` : 'No backup yet: export one regularly'}>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => downloadBackup().then(() => toast('Backup exported'))}>
          <Download size={14} /> Full backup (JSON)
        </Button>
        <Button size="sm" variant="secondary" onClick={exportCsv}>
          <Download size={14} /> Tasks & habits (CSV)
        </Button>
        <Button size="sm" variant="secondary" onClick={() => saveFile('life-os-schedule.ics', buildIcs(s), 'text/calendar')}>
          <Download size={14} /> Calendar (.ics)
        </Button>
        <Button size="sm" variant="secondary" onClick={() => file.current?.click()}>
          <Upload size={14} /> Restore backup
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setPending(await f.text());
          }}
        />
      </div>
      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3">
        <p className="text-xs text-fg-3">Data syncs between devices by exporting a backup and restoring it on the other device. Automatic cloud sync is prepared in the architecture but not enabled.</p>
        <Button size="sm" variant="danger" onClick={() => setWipe(true)}>
          Erase all data
        </Button>
      </div>
      <Confirm
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Restore this backup?"
        body="Everything currently in Life OS on this device will be replaced by the backup."
        confirmLabel="Restore"
        onConfirm={async () => {
          try {
            await restoreBackup(pending!);
            toast('Backup restored');
          } catch (er) {
            toast((er as Error).message, 'error');
          }
          setPending(null);
        }}
      />
      <Confirm
        open={wipe}
        onOpenChange={setWipe}
        title="Erase everything?"
        body="All goals, habits, tasks, history and settings on this device will be permanently deleted. Export a backup first if you might want it."
        confirmLabel="Erase"
        onConfirm={async () => {
          await wipeEverything();
          await A.init();
          location.reload();
        }}
      />
    </Panel>
  );
}
