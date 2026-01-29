import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, BarChart3 } from 'lucide-react';
import hawksLogo from '@/assets/hawks-logo.png';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeaderProps {
  onAddOuting: () => void;
  activeTab?: 'players' | 'team';
  onTabChange?: (tab: 'players' | 'team') => void;
}

export function Header({ onAddOuting, activeTab = 'players', onTabChange }: HeaderProps) {
  const scrollDirection = useScrollDirection();
  const isMobile = useIsMobile();
  
  const isHidden = isMobile && scrollDirection === 'down';
  
  return (
    <header 
      className={`sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 transition-transform duration-300 ${
        isHidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="container mx-auto px-4 py-2 sm:py-3">
        {/* Mobile: Centered logo, shorter height */}
        <div className="flex sm:hidden items-center justify-center">
          <img 
            src={hawksLogo} 
            alt="Newmarket Hawks Logo" 
            className="h-8 w-auto object-contain" 
          />
        </div>

        {/* Desktop/Tablet: Full header with nav */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img 
              src={hawksLogo} 
              alt="Newmarket Hawks Logo" 
              className="h-10 w-auto object-contain" 
            />
            <h1 className="font-display font-bold text-lg text-foreground">
              Arm Stats
            </h1>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-secondary rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-4 gap-2 ${activeTab === 'players' ? 'bg-card shadow-sm' : ''}`}
                onClick={() => onTabChange?.('players')}
              >
                <LayoutGrid className="w-4 h-4" />
                Players
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 px-4 gap-2 ${activeTab === 'team' ? 'bg-card shadow-sm' : ''}`}
                onClick={() => onTabChange?.('team')}
              >
                <BarChart3 className="w-4 h-4" />
                Team
              </Button>
            </div>

            <Button 
              onClick={onAddOuting} 
              size="sm"
              className="h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <Plus className="w-4 h-4 mr-1" />
              Log Outing
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
