import { useRef, useState } from 'react';
import { Download, Upload, Trash2, ShieldCheck, Smartphone } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { SectionTitle } from '@/components/game';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Chips, DayPicker, Field } from '@/components/ui/Chips';
import { useToast } from '@/components/ui/Toaster';
import { updateSettings } from '@/lib/actions';
import { downloadBackup, restoreBackup, wipeEverything } from '@/lib/backup';
import { sleepMinutes, fmtDuration, relDay, localDate } from '@/lib/dates';
import { WORKLOAD_MODES } from '@/lib/academy/academy';


export default function Settings() {
  const s = useSnapshot();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [wipe, setWipe] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  if (!s) return <Loading />;
  const st = s.settings;
  const sleepWindow = sleepMinutes(st.bedTarget, st.wakeTarget);
  const installed = window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <>
      <PageHeader title="Settings" back />
      <Page className="space-y-1 pb-10">
        <SectionTitle>Routine</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Wake-up target">
            <Input type="time" value={st.wakeTarget} onChange={(e) => updateSettings({ wakeTarget: e.target.value })} />
          </Field>
          <Field label="Bedtime target">
            <Input type="time" value={st.bedTarget} onChange={(e) => updateSettings({ bedTarget: e.target.value })} />
          </Field>
        </div>
        <p className={`text-xs ${sleepWindow < 8.5 * 60 ? 'text-warn' : 'text-base-400'}`}>
          Sleep window: {fmtDuration(sleepWindow)}. {sleepWindow < 8.5 * 60 ? 'Aim for at least 8½ hours in bed to get 8+ hours of sleep.' : 'Nice: room for 8–10 hours.'}
        </p>
        <div className="pt-2">
          <Field label="School days">
            <DayPicker value={st.schoolDays} onChange={(schoolDays) => updateSettings({ schoolDays })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Field label="School starts">
            <Input type="time" value={st.schoolStart} onChange={(e) => updateSettings({ schoolStart: e.target.value })} />
          </Field>
          <Field label="School ends">
            <Input type="time" value={st.schoolEnd} onChange={(e) => updateSettings({ schoolEnd: e.target.value })} />
          </Field>
        </div>
        <div className="pt-2">
          <Field label="New day starts at" hint="Ticks after midnight still count for the day before.">
            <Chips value={st.dayStartHour} onChange={(dayStartHour) => updateSettings({ dayStartHour })} options={[0, 2, 3, 4, 5].map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }))} size="sm" />
          </Field>
        </div>

        <SectionTitle>This week's workload</SectionTitle>
        <div className="space-y-2">
          {WORKLOAD_MODES.map((m) => (
            <button key={m.value} onClick={() => updateSettings({ workload: m.value })} className={`w-full text-left rounded-2xl border p-3 ${st.workload === m.value ? 'border-accent bg-accent-bg' : 'border-base-800 bg-base-900'}`}>
              <p className={`text-sm font-bold ${st.workload === m.value ? 'text-accent' : 'text-base-100'}`}>{m.label}</p>
              <p className="text-xs text-base-400">{m.hint}</p>
            </button>
          ))}
        </div>

        <SectionTitle>Rewards</SectionTitle>
        <Field label={`Full-routine bonus: ${st.routineBonusXp} XP`} hint="Earned when every habit scheduled that day is done.">
          <input type="range" min={10} max={40} step={5} value={st.routineBonusXp} onChange={(e) => updateSettings({ routineBonusXp: Number(e.target.value) })} className="w-full accent-[var(--color-accent)] h-8" aria-label="Routine bonus XP" />
        </Field>
        <p className="text-xs text-base-400">Change each habit's XP in Habits → tap a habit.</p>

        <SectionTitle>App</SectionTitle>
        <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
          <Toggle label="Health tracking" hint="Sleep, activity and food logging. Optional." checked={st.healthEnabled} onChange={(v) => updateSettings({ healthEnabled: v })} />
          <Toggle label="Vibration" hint="Buzz on rewards (Android)." checked={st.haptics} onChange={(v) => updateSettings({ haptics: v })} />
          <Toggle label="Reduce motion" hint="Tone down animations." checked={st.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
        </div>

        <SectionTitle>Backup</SectionTitle>
        <div className="rounded-2xl bg-base-900 border border-base-800 p-3 space-y-3">
          <p className="text-sm text-base-300">
            Last backup: <b className="text-base-50">{st.lastBackupAt ? relDay(localDate(new Date(st.lastBackupAt)), s.today) : 'never'}</b>. Your data lives only on this phone. Back up every couple of weeks and save it to Google Drive or Files.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={async () => {
                await downloadBackup();
                toast('Backup created');
              }}
            >
              <Download size={16} /> Export
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Restore
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                await restoreBackup(await f.text());
                toast('Backup restored');
                setTimeout(() => location.reload(), 600);
              } catch (err) {
                toast((err as Error).message, 'warn');
              }
            }}
          />
        </div>

        <SectionTitle>Privacy</SectionTitle>
        <div className="rounded-2xl bg-base-900 border border-base-800 p-3 text-xs text-base-300 space-y-1.5">
          <p className="flex gap-2"><ShieldCheck size={15} className="text-mint shrink-0" /> No account, no real name, no date of birth, no location, no ads, no tracking.</p>
          <p className="flex gap-2"><ShieldCheck size={15} className="text-mint shrink-0" /> Everything is stored on this device only. Nothing is uploaded anywhere.</p>
          <p className="flex gap-2"><ShieldCheck size={15} className="text-mint shrink-0" /> No leaderboards, no weight or calorie tracking.</p>
        </div>
        {!installed && (
          <div className="rounded-2xl bg-base-900 border border-base-800 p-3 text-xs text-base-300 mt-2">
            <p className="flex gap-2 font-bold text-base-100 text-sm"><Smartphone size={16} /> Install on your phone</p>
            <p className="mt-1">In Chrome tap ⋮ → <b>Add to Home screen</b> (or <b>Install app</b>). LIFE XP then opens full screen and works offline.</p>
          </div>
        )}

        <SectionTitle>Danger zone</SectionTitle>
        <Button variant="danger" className="w-full" onClick={() => setWipe(true)}>
          <Trash2 size={16} /> Reset everything
        </Button>
        <Dialog open={wipe} onOpenChange={setWipe} title="Reset LIFE XP?" description="This deletes all habits, XP, badges and Academy data on this phone. Export a backup first.">
          <p className="text-sm text-base-300 mb-2">
            Type <b className="text-danger">RESET</b> to confirm.
          </p>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET" />
          <Button
            variant="danger"
            className="w-full mt-3"
            disabled={confirmText !== 'RESET'}
            onClick={async () => {
              await wipeEverything();
              location.reload();
            }}
          >
            Delete everything
          </Button>
        </Dialog>
        <p className="text-center text-[11px] text-base-600 pt-6">LIFE XP v1.0</p>
      </Page>
    </>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-base-100">{label}</p>
        <p className="text-xs text-base-400">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
