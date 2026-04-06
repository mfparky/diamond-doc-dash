import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDesignSystem } from '@/contexts/DesignSystemContext';

export function ThemeToggle() {
  const { mode, toggleMode } = useDesignSystem();
  const isDark = mode === 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleMode}
      className="w-9 h-9 p-0"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-foreground" />
      ) : (
        <Moon className="h-4 w-4 text-foreground" />
      )}
    </Button>
  );
}
