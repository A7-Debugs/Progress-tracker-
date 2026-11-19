import type { LifeXpDB } from './db';
import type { DateStr, Habit, Profile, Settings } from './types';
import type { HabitTemplate } from './habits';
import { newId } from './id';

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    wakeTarget: '07:00',
    bedTarget: '21:45',
    dayStartHour: 4,
    schoolDays: [1, 2, 3, 4, 5],
    schoolStart: '08:40',
    schoolEnd: '15:20',
    healthEnabled: true,
    haptics: true,
    reduceMotion: false,
    workload: 'term',
    revisionPerWeek: 3,
    revisionMinutes: 10,
    studyDays: [0, 1, 2, 3, 4],
    homeworkMinutes: { '0': 30, '1': 30, '2': 30, '3': 30, '4': 30, '5': 0, '6': 0 },
    routineBonusXp: 25,
    lastBackupAt: null,
    coachDismissed: [],
  };
}

export function defaultProfile(today: DateStr): Profile {
  return {
    id: 'me',
    nickname: '',
    avatar: { icon: 'Gamepad2', palette: 'cyber', frame: 'ring' },
    title: 'Rookie',
    onboarded: false,
    createdAt: Date.now(),
    startDate: today,
    celebratedLevel: 1,
  };
}

export function habitFromTemplate(t: HabitTemplate, order: number, startDate: DateStr): Habit {
  return {
    id: newId(),
    templateId: t.id,
    name: t.name,
    category: t.category,
    icon: t.icon,
    xp: t.xp,
    days: [...t.days],
    target: t.target,
    unit: t.unit,
    step: t.step,
    link: t.link,
    xpKind: t.xpKind,
    active: true,
    order,
    createdAt: Date.now(),
    startDate,
    archivedAt: null,
  };
}

/** Creates the profile + settings rows on first launch. Never adds habits on its own. */
export async function ensureBase(db: LifeXpDB, today: DateStr): Promise<void> {
  await db.transaction('rw', db.profile, db.settings, async () => {
    if (!(await db.settings.get('settings'))) await db.settings.put(defaultSettings());
    if (!(await db.profile.get('me'))) await db.profile.put(defaultProfile(today));
  });
}
