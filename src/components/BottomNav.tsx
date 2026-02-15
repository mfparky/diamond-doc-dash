import { Users, BarChart3, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: 'players' | 'team';
  onTabChange: (tab: 'players' | 'team') => void;
  onAddOuting: () => void;
  isOnPlayerDetail?: boolean;
  onBackToPlayers?: () => void;
}

export function BottomNav({ activeTab, onTabChange, onAddOuting, isOnPlayerDetail, onBackToPlayers }: BottomNavProps) {
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border sm:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-[4.5rem] px-4">
        {/* Players Tab */}
        <button
          onClick={handlePlayersClick}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-3 px-6 rounded-xl transition-all min-w-[80px] min-h-[56px] active:scale-95",
            activeTab === 'players' && !isOnPlayerDetail
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Users className="w-6 h-6" />
          <span className="text-xs font-medium">Players</span>
        </button>

        {/* Log Outing - Center Action Button */}
        <button
          onClick={onAddOuting}
          className="flex flex-col items-center justify-center gap-1 py-2 px-6 min-w-[80px] active:scale-95"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg -mt-5 active:bg-primary/90 transition-colors">
            <Plus className="w-7 h-7" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Log</span>
        </button>

        {/* Team Tab */}
        <button
          onClick={handleTeamClick}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-3 px-6 rounded-xl transition-all min-w-[80px] min-h-[56px] active:scale-95",
            activeTab === 'team'
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-xs font-medium">Team</span>
        </button>
      </div>
    </nav>
  );
}
