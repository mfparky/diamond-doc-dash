import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List } from 'lucide-react';
interface HeaderProps {
  viewMode: 'cards' | 'table';
  onViewModeChange: (mode: 'cards' | 'table') => void;
  onAddOuting: () => void;
}
export function Header({
  viewMode,
  onViewModeChange,
  onAddOuting
}: HeaderProps) {
  return <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-xl">⚾</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-foreground">Newmarket Hawks Pitching Dashboard</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Team Dashboard</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* View Toggle - Hidden on mobile */}
            <div className="hidden md:flex items-center bg-secondary rounded-lg p-1">
              <Button variant="ghost" size="sm" className={viewMode === 'cards' ? 'bg-card shadow-sm' : ''} onClick={() => onViewModeChange('cards')}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className={viewMode === 'table' ? 'bg-card shadow-sm' : ''} onClick={() => onViewModeChange('table')}>
                <List className="w-4 h-4" />
              </Button>
            </div>

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