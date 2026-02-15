import { Pitcher } from '@/types/pitcher';
import { StatusBadge } from './StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Target, Gauge, Calendar, Share2 } from 'lucide-react';
import { getDaysRestNeeded } from '@/types/pitcher';
import { getPulseLevel, getPulseColorClasses, DEFAULT_MAX_WEEKLY_PITCHES } from '@/lib/pulse-status';
import { useToast } from '@/hooks/use-toast';

interface PitcherCardProps {
  pitcher: Pitcher;
  onClick?: () => void;
  maxWeeklyPitches?: number;
  seasonStats?: { totalPitches: number; strikePercentage: number; maxVelocity: number };
}

export function PitcherCard({ pitcher, onClick, maxWeeklyPitches = DEFAULT_MAX_WEEKLY_PITCHES, seasonStats }: PitcherCardProps) {
  const { toast } = useToast();
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No outings';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/player/${pitcher.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copied!',
      description: `Share this link with ${pitcher.name.split(' ')[0]}'s parents.`,
    });
  };

  const pulseLevel = getPulseLevel(pitcher.sevenDayPulse, maxWeeklyPitches);
  const pulseColors = getPulseColorClasses(pulseLevel);

  return (
    <Card 
      className="stat-card cursor-pointer hover:border-primary/50 active:scale-[0.98] transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-lg text-foreground truncate">{pitcher.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={pitcher.restStatus} compact />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8 shrink-0"
            onClick={handleShare}
            title="Share player dashboard"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${seasonStats ? 'bg-primary/10' : pulseColors.bg}`}>
              <TrendingUp className={`w-3.5 h-3.5 ${seasonStats ? 'text-primary' : pulseColors.icon}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{seasonStats ? 'Total Pitches' : '7-Day Pulse'}</p>
              <p className={`font-semibold ${seasonStats ? 'text-foreground' : pulseColors.text}`}>
                {seasonStats ? seasonStats.totalPitches : pitcher.sevenDayPulse}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-accent/10">
              <Target className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Strike %</p>
              <p className="font-semibold text-foreground">
                {seasonStats ? `${seasonStats.strikePercentage}%` : `${pitcher.strikePercentage.toFixed(1)}%`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-status-danger/10">
              <Gauge className="w-3.5 h-3.5 text-status-danger" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Velo</p>
              <p className="font-semibold text-foreground">
                {seasonStats ? (seasonStats.maxVelocity > 0 ? seasonStats.maxVelocity : '-') : (pitcher.maxVelo || '-')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-muted">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Outing</p>
              <p className="font-semibold text-foreground text-xs">{formatDate(pitcher.lastOuting)}</p>
            </div>
          </div>
        </div>


        {pitcher.notes && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2 border-t border-border/50 pt-3">
            {pitcher.notes}
          </p>
        )}


        {/* Show arm care info if pitcher has data */}
        {pitcher.lastPitchCount > 0 && (
          <div className="mt-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
            Last: {pitcher.lastPitchCount} pitches → {getDaysRestNeeded(pitcher.lastPitchCount)} day{getDaysRestNeeded(pitcher.lastPitchCount) !== 1 ? 's' : ''} rest needed
          </div>
        )}
      </CardContent>
    </Card>
  );
}
