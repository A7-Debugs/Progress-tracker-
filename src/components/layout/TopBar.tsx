import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';

export function TopBar({
  title,
  back,
  right,
  showSearch,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
  showSearch?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-base-950/85 backdrop-blur-lg border-b border-base-800 safe-top">
      <div className="mx-auto max-w-lg flex items-center gap-2 h-14 px-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 -ml-1 flex items-center justify-center rounded-lg text-base-200 hover:bg-base-800 shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 className="flex-1 text-[17px] font-semibold text-base-50 truncate">{title}</h1>
        {showSearch && (
          <button
            onClick={() => navigate('/search')}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-base-200 hover:bg-base-800 shrink-0"
            aria-label="Search"
          >
            <Search size={19} />
          </button>
        )}
        {right}
      </div>
    </header>
  );
}
