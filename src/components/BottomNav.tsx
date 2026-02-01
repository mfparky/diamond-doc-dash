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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border sm:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-4">
        {/* Players Tab */}
        <button
          onClick={handlePlayersClick}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-2 px-6 rounded-xl transition-colors min-w-[72px]",
            activeTab === 'players' && !isOnPlayerDetail
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-6 h-6" />
          <span className="text-xs font-medium">Players</span>
        </button>

        {/* Log Outing - Center Action Button */}
        <button
          onClick={onAddOuting}
          className="flex flex-col items-center justify-center gap-1 py-2 px-6 min-w-[72px]"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg -mt-4">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Log</span>
        </button>

        {/* Team Tab */}
        <button
          onClick={() => onTabChange('team')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-2 px-6 rounded-xl transition-colors min-w-[72px]",
            activeTab === 'team' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-xs font-medium">Team</span>
        </button>
      </div>
    </nav>
  );
}
