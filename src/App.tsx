import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/Toaster';
import { seedIfEmpty } from '@/lib/seed';
import { ensureLifeProfile } from '@/lib/life/defaults';
import { ensureStarterFoods } from '@/lib/life/nutrition';

import Today from '@/routes/Today';
import SessionLog from '@/routes/SessionLog';
import Programs from '@/routes/Programs';
import ProgramDetail from '@/routes/ProgramDetail';
import WorkoutEditor from '@/routes/WorkoutEditor';
import Exercises from '@/routes/Exercises';
import ExerciseDetail from '@/routes/ExerciseDetail';
import Analytics from '@/routes/Analytics';
import Bodyweight from '@/routes/Bodyweight';
import Photos from '@/routes/Photos';
import CalendarPage from '@/routes/CalendarPage';
import SearchPage from '@/routes/SearchPage';
import SettingsPage from '@/routes/SettingsPage';
import Me from '@/routes/Me';
import SessionHistory from '@/routes/SessionHistory';
import SessionDetail from '@/routes/SessionDetail';
import LifeDashboard from '@/routes/life/LifeDashboard';
import CheckIn from '@/routes/life/CheckIn';
import Review from '@/routes/life/Review';
import Trends from '@/routes/life/Trends';
import Finance from '@/routes/life/Finance';
import Goals from '@/routes/life/Goals';
import SystemPage from '@/routes/life/SystemPage';
import FoodLogPage from '@/routes/life/FoodLog';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([seedIfEmpty(), ensureLifeProfile().then(ensureStarterFoods)]).finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-base-950">
        <div className="h-8 w-8 rounded-full border-2 border-base-700 border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<LifeDashboard />} />
            <Route path="/train" element={<Today />} />
            <Route path="/review" element={<Review />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/system" element={<SystemPage />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/programs/:programId" element={<ProgramDetail />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/exercises/:exerciseId" element={<ExerciseDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/me" element={<Me />} />
            <Route path="/bodyweight" element={<Bodyweight />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/history" element={<SessionHistory />} />
            <Route path="/history/:sessionId" element={<SessionDetail />} />
          </Route>
          {/* Full-bleed routes without bottom nav */}
          <Route path="/session/:sessionId" element={<SessionLog />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/food" element={<FoodLogPage />} />
          <Route path="/programs/:programId/workouts/:workoutId" element={<WorkoutEditor />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
