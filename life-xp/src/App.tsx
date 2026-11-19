import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, requestPersistentStorage } from '@/lib/db';
import { init } from '@/lib/actions';
import { ToastProvider } from '@/components/ui/Toaster';
import { Celebrations } from '@/components/Celebrations';
import { Loading, Shell } from '@/components/layout';
import Home from '@/routes/Home';
import Habits from '@/routes/Habits';
import HabitEdit from '@/routes/HabitEdit';
import HabitLibrary from '@/routes/HabitLibrary';
import Quests from '@/routes/Quests';
const Health = lazy(() => import('@/routes/Health'));
const Progress = lazy(() => import('@/routes/Progress'));
const Profile = lazy(() => import('@/routes/Profile'));
const Achievements = lazy(() => import('@/routes/Achievements'));
const Settings = lazy(() => import('@/routes/Settings'));
import Onboarding from '@/routes/Onboarding';
import Academy from '@/routes/academy/Academy';
import { SubjectDetail, Subjects } from '@/routes/academy/Subjects';
const TopicDetail = lazy(() => import('@/routes/academy/TopicDetail'));
import { Session, StartSession } from '@/routes/academy/Session';
import Reviews from '@/routes/academy/Reviews';
const Planner = lazy(() => import('@/routes/academy/Planner'));
const AcademyStats = lazy(() => import('@/routes/academy/AcademyStats'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Routed() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('reduce-motion', !!settings?.reduceMotion);
    el.dataset.haptics = settings?.haptics === false ? 'off' : 'on';
  }, [settings?.reduceMotion, settings?.haptics]);
  if (profile === undefined) return <Loading />;
  if (!profile?.onboarded) return <Onboarding />;
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/habits/library" element={<HabitLibrary />} />
          <Route path="/habits/new" element={<HabitEdit />} />
          <Route path="/habits/:habitId" element={<HabitEdit />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/health" element={<Health />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/academy/subjects" element={<Subjects />} />
          <Route path="/academy/subject/:subjectId" element={<SubjectDetail />} />
          <Route path="/academy/topic/:topicId" element={<TopicDetail />} />
          <Route path="/academy/reviews" element={<Reviews />} />
          <Route path="/academy/planner" element={<Planner />} />
          <Route path="/academy/stats" element={<AcademyStats />} />
        </Route>
        <Route path="/academy/start" element={<div className="mx-auto w-full max-w-lg"><StartSession /></div>} />
        <Route path="/academy/session" element={<Session />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    init().finally(() => setReady(true));
    requestPersistentStorage();
  }, []);
  return (
    <ToastProvider>
      {ready ? (
        <HashRouter>
          <Routed />
          <Celebrations />
        </HashRouter>
      ) : (
        <Loading />
      )}
    </ToastProvider>
  );
}
