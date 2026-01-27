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
  return <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <img src={hawksLogo} alt="Newmarket Hawks Logo" className="h-10 w-auto sm:h-12 object-contain" />
            <div>
              <h1 className="font-display font-bold text-lg sm:text-xl text-foreground">Arm Care</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Pitching Dashboard
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Time View Toggle */}
            <div className="flex items-center bg-secondary rounded-lg p-1">
              <Button variant="ghost" size="sm" className={timeView === '7day' ? 'bg-card shadow-sm' : ''} onClick={() => onTimeViewChange('7day')} title="7-Day View">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline ml-1 text-xs">7-Day</span>
              </Button>
              <Button variant="ghost" size="sm" className={timeView === 'alltime' ? 'bg-card shadow-sm' : ''} onClick={() => onTimeViewChange('alltime')} title="2026 Season Stats">
                <CalendarDays className="w-4 h-4" />
                <span className="hidden sm:inline ml-1 text-xs">Season</span>
              </Button>
            </div>

            {/* View Toggle - Hidden on mobile, only show in 7day view */}
            {timeView === '7day' && <div className="hidden md:flex items-center bg-secondary rounded-lg p-1">
                <Button variant="ghost" size="sm" className={viewMode === 'cards' ? 'bg-card shadow-sm' : ''} onClick={() => onViewModeChange('cards')} title="Roster Cards">
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className={viewMode === 'combined' ? 'bg-card shadow-sm' : ''} onClick={() => onViewModeChange('combined')} title="Combined Dashboard">
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </div>}

            {/* Add Outing Button */}
            <Button onClick={onAddOuting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Log Outing</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </div>
    </header>;
}