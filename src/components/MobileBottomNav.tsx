import { Plus, LayoutGrid, BarChart3, Calendar, CalendarDays, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface MobileBottomNavProps {
  viewMode: 'cards' | 'combined';
  onViewModeChange: (mode: 'cards' | 'combined') => void;
  onAddOuting: () => void;
  timeView: '7day' | 'alltime';
  onTimeViewChange: (view: '7day' | 'alltime') => void;
}

export function MobileBottomNav({
  viewMode,
  onViewModeChange,
  onAddOuting,
  timeView,
  onTimeViewChange,
}: MobileBottomNavProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light');
    setIsDark(!isLight);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border sm:hidden">
      <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {/* Time View Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-3"
          onClick={() => onTimeViewChange(timeView === '7day' ? 'alltime' : '7day')}
        >
          {timeView === '7day' ? (
            <Calendar className="w-5 h-5" />
          ) : (
            <CalendarDays className="w-5 h-5" />
          )}
          <span className="text-[10px] text-muted-foreground">
            {timeView === '7day' ? '7-Day' : 'Season'}
          </span>
        </Button>

        {/* View Toggle (only in 7day mode) */}
        {timeView === '7day' ? (
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-3"
            onClick={() => onViewModeChange(viewMode === 'cards' ? 'combined' : 'cards')}
          >
            {viewMode === 'cards' ? (
              <BarChart3 className="w-5 h-5" />
            ) : (
              <LayoutGrid className="w-5 h-5" />
            )}
            <span className="text-[10px] text-muted-foreground">
              {viewMode === 'cards' ? 'Stats' : 'Roster'}
            </span>
          </Button>
        ) : (
          <div className="w-14" /> // Spacer when not in 7day mode
        )}

        {/* Add Outing - Primary action */}
        <Button
          onClick={onAddOuting}
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px]">Log</span>
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-3"
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
          <span className="text-[10px] text-muted-foreground">Theme</span>
        </Button>
      </div>
    </nav>
  );
}
