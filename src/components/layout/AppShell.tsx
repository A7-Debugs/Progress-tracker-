import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="flex flex-col min-h-dvh bg-base-950">
      <div className="mx-auto w-full max-w-lg flex-1 flex flex-col">
        <main className="flex-1 pb-2">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
