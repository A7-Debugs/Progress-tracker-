import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, requestPersistentStorage } from '@/lib/db';
import { init } from '@/lib/actions';
import { StoreProvider } from '@/lib/store';
import type { ThemePref } from '@/lib/types';
import { ToastProvider } from '@/components/ui/Toaster';
import { Celebrations } from '@/components/Celebrations';
import { Loading, Shell } from '@/components/layout';
import { LockScreen, useLock } from '@/components/LockScreen';
import Dashboard from '@/routes/Dashboard';
import Onboarding from '@/routes/Onboarding';
import Tasks from '@/routes/Tasks';
import Habits from '@/routes/Habits';
import Goals from '@/routes/Goals';
const GoalDetail = lazy(() => import('@/routes/GoalDetail'));
const HabitDetail = lazy(() => import('@/routes/HabitDetail'));
const Schedule = lazy(() => import('@/routes/Schedule'));
const Focus = lazy(() => import('@/routes/Focus'));
const Performance = lazy(() => import('@/routes/Performance'));
const WeeklyReview = lazy(() => import('@/routes/WeeklyReview'));
const Development = lazy(() => import('@/routes/Development'));
const Assistant = lazy(() => import('@/routes/Assistant'));
const Settings = lazy(() => import('@/routes/Settings'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Applies the theme preference (following the OS when set to system). */
export function useTheme(pref: ThemePref | undefined) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || ((pref ?? 'system') === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0b0e' : '#f6f6f7');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

function Routed() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  useTheme(settings?.theme);
  const lock = useLock(settings);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('reduce-motion', !!settings?.reduceMotion);
    el.dataset.haptics = settings?.haptics === false ? 'off' : 'on';
  }, [settings?.reduceMotion, settings?.haptics]);
  if (profile === undefined || settings === undefined) return <Loading />;
  if (lock.locked) return <LockScreen onUnlock={lock.unlock} />;
  if (!profile?.onboarded) return <Onboarding />;
  return (
    <StoreProvider fallback={<Loading />}>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/goals/:goalId" element={<GoalDetail />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/habits/:habitId" element={<HabitDetail />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/performance/review" element={<WeeklyReview />} />
            <Route path="/development" element={<Development />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/focus" element={<Focus />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Celebrations />
    </StoreProvider>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    init()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    requestPersistentStorage();
  }, []);
  if (error)
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div>
          <p className="font-semibold">Life OS couldn't open its database.</p>
          <p className="text-sm text-fg-3 mt-1">{error}</p>
          <p className="text-sm text-fg-3 mt-1">Private browsing modes can block storage. Try a normal window.</p>
        </div>
      </div>
    );
  return <ToastProvider>{ready ? <HashRouter><Routed /></HashRouter> : <Loading />}</ToastProvider>;
}
