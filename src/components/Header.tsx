import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import hawksLogo from '@/assets/hawks-logo.png';

interface HeaderProps {
  onAddOuting: () => void;
}

export function Header({ onAddOuting }: HeaderProps) {
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

          {/* Add Outing Button - Desktop only, mobile uses bottom nav */}
          <div className="hidden sm:flex items-center gap-2">
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
