import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Save, X } from 'lucide-react';
import { LiveAbCharter, type LiveAbData } from '@/components/LiveAbCharter';
import { useChartingRoute } from '@/hooks/use-charting-route';
import { encodeLiveAbsData } from '@/types/at-bats';

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** /chart/live-abs?pitcherId=X — dedicated batter-focused UI. */
export default function LiveAbsChartPage() {
  const { pitcher, isLoading, handleComplete, handleCancel } = useChartingRoute();
  const [data, setData] = useState<LiveAbData>({ pitches: [], atBats: [] });

  const handleSave = useCallback(async () => {
    if (!pitcher) return;
    const strikes = data.pitches.filter((p) => p.isStrike).length;
    await handleComplete({
      pitches: data.pitches,
      maxVelo: 0,
      pitchCount: data.pitches.length,
      strikes,
      eventType: 'Live ABs',
      date: getTodayDateString(),
      notes: encodeLiveAbsData({ atBats: data.atBats }),
    });
  }, [pitcher, data, handleComplete]);

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
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
            {pitcher.name}
          </h2>
          <p className="text-xs text-muted-foreground">Live ABs</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="lg"
            onClick={handleSave}
            disabled={data.pitches.length === 0}
            className="px-6"
          >
            <Save className="w-4 h-4 mr-2" />
            Save ({data.pitches.length}p · {data.atBats.length} ABs)
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCancel} aria-label="Cancel">
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <LiveAbCharter onChange={setData} />
      </div>
    </div>
  );
}
