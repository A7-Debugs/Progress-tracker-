import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, FileSpreadsheet, Bell, Trash2, Info } from 'lucide-react';
import { db } from '@/lib/db';
import { exportJSON, exportCSV, importJSON, wipeAllData } from '@/lib/backup';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toaster';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const settings = useLiveQuery(() => db.settings.get('settings'), []);

  async function toggleReminder(enabled: boolean) {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    await db.settings.update('settings', { reminderEnabled: enabled });
  }

  async function toggleDay(day: number) {
    if (!settings) return;
    const days = settings.reminderDays.includes(day)
      ? settings.reminderDays.filter((d) => d !== day)
      : [...settings.reminderDays, day].sort();
    await db.settings.update('settings', { reminderDays: days });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Import will merge this backup into your current data. Continue?')) {
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      await importJSON(file);
      toast('Backup imported');
    } catch {
      toast('Import failed — invalid file', 'warn');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function handleWipe() {
    if (!confirm('This will permanently delete ALL data — programs, workouts, history, photos. This cannot be undone. Continue?')) return;
    if (!confirm('Are you absolutely sure? Consider exporting a backup first.')) return;
    setBusy(true);
    await wipeAllData();
    setBusy(false);
    toast('All data wiped');
    location.reload();
  }

  if (!settings) return null;

  return (
    <div className="animate-fade-in">
      <TopBar title="Settings" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-4">
        <Section title="Reminders">
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-base-400" />
                <span className="text-sm font-medium text-base-100">Workout reminder</span>
              </div>
              <Switch checked={settings.reminderEnabled} onCheckedChange={toggleReminder} />
            </div>
            {settings.reminderEnabled && (
              <>
                <Input
                  type="time"
                  value={settings.reminderTime}
                  onChange={(e) => db.settings.update('settings', { reminderTime: e.target.value })}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`h-8 w-10 rounded-lg text-xs font-medium border ${
                        settings.reminderDays.includes(i)
                          ? 'bg-accent text-base-950 border-accent'
                          : 'bg-base-850 text-base-400 border-base-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-base-500">
                  Reminders fire locally while the app is open. For guaranteed alerts, install the app to your home
                  screen and keep notification permissions enabled.
                </p>
              </>
            )}
          </Card>
        </Section>

        <Section title="Backup & Data">
          <Card className="p-4 flex flex-col gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => exportJSON()}>
              <Download size={16} /> Export full backup (JSON)
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => exportCSV()}>
              <FileSpreadsheet size={16} /> Export sets (CSV)
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Import / restore backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </Card>
        </Section>

        <Section title="Danger zone">
          <Card className="p-4">
            <Button variant="danger" disabled={busy} onClick={handleWipe} className="w-full">
              <Trash2 size={16} /> Erase all data
            </Button>
          </Card>
        </Section>

        <Card className="p-4 flex items-start gap-2.5 text-xs text-base-400">
          <Info size={14} className="shrink-0 mt-0.5" />
          <p>
            Overload stores everything locally on this device using IndexedDB and works fully offline. Export a
            backup regularly, especially before clearing browser data or switching devices.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mb-2">{title}</p>
      {children}
    </div>
  );
}
