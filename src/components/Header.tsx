import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, BarChart3, Calendar, CalendarDays } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import hawksLogo from '@/assets/hawks-logo.png';

interface HeaderProps {
  viewMode: 'cards' | 'combined';
  onViewModeChange: (mode: 'cards' | 'combined') => void;
  onAddOuting: () => void;
  timeView: '7day' | 'alltime';
  onTimeViewChange: (view: '7day' | 'alltime') => void;
}

export function Header({
  viewMode,
  onViewModeChange,
  onAddOuting,
  timeView,
  onTimeViewChange
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img 
              src={hawksLogo} 
              alt="Newmarket Hawks Logo" 
              className="h-9 w-auto sm:h-11 object-contain" 
            />
            <h1 className="font-display font-bold text-base sm:text-lg text-foreground hidden sm:block">
              Arm Stats
            </h1>
          </div>

          {/* Actions - responsive layout */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Theme Toggle - hidden on mobile to save space */}
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {/* Time View Toggle */}
            <div className="flex items-center bg-secondary rounded-lg p-0.5 sm:p-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 px-2 sm:px-3 ${timeView === '7day' ? 'bg-card shadow-sm' : ''}`} 
                onClick={() => onTimeViewChange('7day')} 
                title="7-Day View"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline ml-1 text-xs">7-Day</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 px-2 sm:px-3 ${timeView === 'alltime' ? 'bg-card shadow-sm' : ''}`} 
                onClick={() => onTimeViewChange('alltime')} 
                title="Season Stats"
              >
                <CalendarDays className="w-4 h-4" />
                <span className="hidden sm:inline ml-1 text-xs">Season</span>
              </Button>
            </div>

            {/* View Toggle - Now visible on all screen sizes in 7day view */}
            {timeView === '7day' && (
              <div className="flex items-center bg-secondary rounded-lg p-0.5 sm:p-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-8 px-2 sm:px-3 ${viewMode === 'cards' ? 'bg-card shadow-sm' : ''}`} 
                  onClick={() => onViewModeChange('cards')} 
                  title="Roster Cards"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-8 px-2 sm:px-3 ${viewMode === 'combined' ? 'bg-card shadow-sm' : ''}`} 
                  onClick={() => onViewModeChange('combined')} 
                  title="Combined Dashboard"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Add Outing Button */}
            <Button 
              onClick={onAddOuting} 
              size="sm"
              className="h-8 px-2 sm:px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Log</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
