import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HomeButton() {
  const location = useLocation();
  
  // Don't show on home page or player dashboard (shared parent links)
  if (location.pathname === '/' || location.pathname.startsWith('/player/')) {
    return null;
  }

  return (
    <Link to="/">
      <Button
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
      >
        <Home className="h-5 w-5" />
        <span className="sr-only">Go to home</span>
      </Button>
    </Link>
  );
}
