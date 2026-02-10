import { BadgeResult } from '@/types/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy } from 'lucide-react';

interface BadgeGridProps {
  badges: BadgeResult[];
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  const earned = badges.filter(b => b.earned).length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Achievements
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            {earned}/{badges.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-5 gap-3">
            {badges.map(({ badge, earned, progress, detail }) => (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <button
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                      earned
                        ? 'bg-yellow-500/10 border border-yellow-500/30 shadow-sm shadow-yellow-500/10'
                        : 'bg-muted/40 border border-border/30 opacity-50 grayscale'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl">{badge.emoji}</span>
                    <span className="text-[10px] sm:text-xs font-medium text-foreground leading-tight text-center line-clamp-2">
                      {badge.name}
                    </span>
                    {!earned && (
                      <div className="absolute bottom-1 left-2 right-2 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                    {earned && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-[8px]">✓</span>
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="font-semibold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  <p className="text-xs font-medium mt-1">{badge.metric}</p>
                  {detail && (
                    <p className="text-xs text-primary mt-0.5">{detail}</p>
                  )}
                  {!earned && (
                    <p className="text-xs text-muted-foreground mt-0.5">Progress: {Math.round(progress)}%</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
