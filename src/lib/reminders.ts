import { useEffect } from 'react';
import { db } from './db';
import type { Settings } from './types';

export const DEFAULT_CHECKIN_TIME = '21:00';
export const DEFAULT_REVIEW_TIME = '18:00';

interface Due {
  key: string;
  title: string;
  body: string;
  url: string;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Reminders whose time is now (to the minute) and that are switched on. */
export function dueReminders(s: Settings, now = new Date()): Due[] {
  const t = hhmm(now);
  const day = now.getDay();
  const out: Due[] = [];
  if (s.reminderEnabled && s.reminderDays.includes(day) && s.reminderTime === t)
    out.push({ key: 'workout', title: 'Time to train', body: 'Even a 25-minute full-body session counts.', url: '#/train' });
  if (s.checkinReminder && (s.checkinReminderTime ?? DEFAULT_CHECKIN_TIME) === t)
    out.push({ key: 'checkin', title: 'Daily check-in', body: '60 seconds: sleep, training, food, deep work, energy.', url: '#/checkin' });
  if (s.reviewReminder && day === 0 && (s.reviewReminderTime ?? DEFAULT_REVIEW_TIME) === t)
    out.push({ key: 'review', title: 'Sunday review', body: 'Under 10 minutes — it holds the rest of the system together.', url: '#/review' });
  return out;
}

async function notify(d: Due) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const fired = `reminder-fired-${d.key}-${new Date().toDateString()}`;
  try {
    if (localStorage.getItem(fired)) return;
    localStorage.setItem(fired, '1');
  } catch {
    /* storage unavailable — notify anyway */
  }
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg) await reg.showNotification(d.title, { body: d.body, tag: d.key, data: { url: d.url } });
  else new Notification(d.title, { body: d.body, tag: d.key });
}

/**
 * Checks once a minute while the app is open (or still alive in the background) and shows due reminders.
 * Browsers can't wake a closed web app without a push server, so calendar alarms are the reliable option.
 */
export function useReminderScheduler() {
  useEffect(() => {
    const tick = async () => {
      const s = await db.settings.get('settings');
      if (s) for (const d of dueReminders(s)) await notify(d);
    };
    const id = setInterval(tick, 60000);
    tick();
    return () => clearInterval(id);
  }, []);
}

const icsDate = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;

function event(uid: string, start: Date, rrule: string, summary: string, description: string, url: string) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@life-os`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    'DURATION:PT10M',
    `RRULE:${rrule}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

/** A calendar file with recurring alarms — the reliable way to get reminders when the app is closed. */
export function reminderCalendar(s: Settings, appUrl: string): string {
  const events: string[] = [];
  const at = (time: string, dayOffset: (d: Date) => number) => {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    d.setDate(d.getDate() + dayOffset(d));
    return d;
  };
  if (s.checkinReminder ?? true)
    events.push(event('checkin', at(s.checkinReminderTime ?? DEFAULT_CHECKIN_TIME, () => 0), 'FREQ=DAILY', 'Daily check-in (60 sec)', 'Sleep, training, food, deep work, energy.', `${appUrl}#/checkin`));
  if (s.reviewReminder ?? true)
    events.push(
      event('review', at(s.reviewReminderTime ?? DEFAULT_REVIEW_TIME, (d) => (7 - d.getDay()) % 7), 'FREQ=WEEKLY;BYDAY=SU', 'Sunday review (10 min)', 'Review the week and plan the next one.', `${appUrl}#/review`),
    );
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life OS//Reminders//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadReminderCalendar(s: Settings) {
  const url = `${location.origin}${location.pathname}`;
  const blob = new Blob([reminderCalendar(s, url)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'life-os-reminders.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
