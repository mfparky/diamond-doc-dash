import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LiveChartingSession } from '@/components/LiveChartingSession';
import { useChartingRoute } from '@/hooks/use-charting-route';

/** /chart/game?pitcherId=X — hard-locks the session type to Game. */
export default function GameChartPage() {
  const { pitcher, isLoading, handleComplete, handleCancel } = useChartingRoute();

  if (isLoading) return null;

  if (!pitcher) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="p-6 space-y-3 text-center">
            <h1 className="font-display text-lg font-semibold text-foreground">
              Pitcher not found
            </h1>
            <p className="text-sm text-muted-foreground">
              We couldn't resolve that pitcher — the id in the URL may be stale.
            </p>
            <Button asChild size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <LiveChartingSession
      pitcher={pitcher}
      onComplete={handleComplete}
      onCancel={handleCancel}
      initialSessionType="Game"
      lockSessionType
    />
  );
}
