import { Users, BarChart3, Plus, ClipboardList, MoreHorizontal, type LucideIcon } from 'lucide-react';
import hawksLogo from '@/assets/hawks-logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

interface LeftRailProps {
  activeTab: 'players' | 'team';
  onTabChange: (tab: 'players' | 'team') => void;
  onAddOuting: () => void;
  onOpenRoster: () => void;
  onOpenMore: () => void;
  isOnPlayerDetail?: boolean;
  onBackToPlayers?: () => void;
}

/**
 * Persistent sidebar rail on tablet/desktop that mirrors the mobile bottom
 * nav's five destinations. Fixed on the left; the shell reserves space with
 * a matching sm:pl-56.
 *
 * Hidden below `sm` — the bottom nav takes over on phones.
 */
export function LeftRail({
  activeTab,
  onTabChange,
  onAddOuting,
  onOpenRoster,
  onOpenMore,
  isOnPlayerDetail,
  onBackToPlayers,
}: LeftRailProps) {
  const handlePlayers = () => {
    if (isOnPlayerDetail && onBackToPlayers) onBackToPlayers();
    else onTabChange('players');
  };
  const handleTeam = () => {
    if (isOnPlayerDetail && onBackToPlayers) onBackToPlayers();
    onTabChange('team');
  };

  return (
    <aside
      className="hidden sm:flex fixed left-0 top-0 h-screen w-56 bg-card/95 backdrop-blur-md border-r border-border flex-col p-4 z-40"
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <img src={hawksLogo} alt="Newmarket Hawks" className="h-9 w-auto object-contain" />
        <h1 className="font-display font-bold text-lg text-foreground">Arm Stats</h1>
      </div>

      {/* Primary destinations */}
      <nav className="space-y-1 flex-1">
        <RailButton
          icon={Users}
          label="Players"
          active={activeTab === 'players' && !isOnPlayerDetail}
          onClick={handlePlayers}
        />
        <RailButton
          icon={BarChart3}
          label="Team"
          active={activeTab === 'team'}
          onClick={handleTeam}
        />
        <RailButton icon={ClipboardList} label="Roster" onClick={onOpenRoster} />
        <RailButton icon={MoreHorizontal} label="More" onClick={onOpenMore} />
      </nav>

      {/* Big primary action — Log Outing */}
      <button
        type="button"
        onClick={onAddOuting}
        className="mt-4 flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Log Outing
      </button>

      {/* Theme toggle in the footer so it's still reachable when the mobile
          header is hidden on sm+. */}
      <div className="mt-3 flex justify-end">
        <ThemeToggle />
      </div>
    </aside>
  );
}

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn('w-5 h-5 shrink-0', active ? 'text-primary' : 'group-hover:text-foreground')} />
      <span>{label}</span>
    </button>
  );
}
