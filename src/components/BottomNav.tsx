import { Users, BarChart3, Plus, Dumbbell, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: 'players' | 'team';
  onTabChange: (tab: 'players' | 'team') => void;
  onAddOuting: () => void;
  onOpenWorkouts: () => void;
  onOpenMore: () => void;
  isOnPlayerDetail?: boolean;
  onBackToPlayers?: () => void;
}

export function BottomNav({
  activeTab,
  onTabChange,
  onAddOuting,
  onOpenWorkouts,
  onOpenMore,
  isOnPlayerDetail,
  onBackToPlayers,
}: BottomNavProps) {
  const handlePlayersClick = () => {
    if (isOnPlayerDetail && onBackToPlayers) {
      onBackToPlayers();
    } else {
      onTabChange('players');
    }
  };

  const handleTeamClick = () => {
    if (isOnPlayerDetail && onBackToPlayers) {
      onBackToPlayers();
    }
    onTabChange('team');
  };

  const slotClasses = (active: boolean) =>
    cn(
      'flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl transition-all min-w-[60px] min-h-[56px] active:scale-95',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
    );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border sm:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-[4.5rem] px-2">
        {/* Players */}
        <button
          type="button"
          onClick={handlePlayersClick}
          className={slotClasses(activeTab === 'players' && !isOnPlayerDetail)}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Users className="w-6 h-6" />
          <span className="text-xs font-medium">Players</span>
        </button>

        {/* Team */}
        <button
          type="button"
          onClick={handleTeamClick}
          className={slotClasses(activeTab === 'team')}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-xs font-medium">Team</span>
        </button>

        {/* Log Outing — center FAB */}
        <button
          type="button"
          onClick={onAddOuting}
          aria-label="Log outing"
          className="flex flex-col items-center justify-center gap-1 py-2 px-2 min-w-[60px] active:scale-95"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg -mt-5 active:bg-primary/90 transition-colors">
            <Plus className="w-7 h-7" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Log</span>
        </button>

        {/* Workouts */}
        <button
          type="button"
          onClick={onOpenWorkouts}
          className={slotClasses(false)}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Dumbbell className="w-6 h-6" />
          <span className="text-xs font-medium">Workouts</span>
        </button>

        {/* More */}
        <button
          type="button"
          onClick={onOpenMore}
          className={slotClasses(false)}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <MoreHorizontal className="w-6 h-6" />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
