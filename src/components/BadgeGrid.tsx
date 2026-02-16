import { useState } from 'react';
import { BadgeResult } from '@/types/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trophy } from 'lucide-react';

interface BadgeGridProps {
  badges: BadgeResult[];
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  const earned = badges.filter(b => b.earned).length;
  const [selected, setSelected] = useState<BadgeResult | null>(null);

  return (
    <>
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
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {badges.map(({ badge, earned, progress, detail }) => (
              <button
                key={badge.id}
                onClick={() => setSelected({ badge, earned, progress, detail })}
                className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  earned
                    ? 'bg-transparent border-transparent md:bg-yellow-500/10 md:border md:border-yellow-500/30 md:shadow-sm md:shadow-yellow-500/10'
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
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-xs">
          {selected && (
            <>
              <DialogHeader className="items-center text-center">
                <span className="text-5xl mb-2">{selected.badge.emoji}</span>
                <DialogTitle>{selected.badge.name}</DialogTitle>
                <DialogDescription>{selected.badge.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm text-center">
                <p className="font-medium text-foreground">{selected.badge.metric}</p>
                {selected.detail && (
                  <p className="text-primary">{selected.detail}</p>
                )}
                {!selected.earned && (
                  <>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${selected.progress}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">Progress: {Math.round(selected.progress)}%</p>
                  </>
                )}
                {selected.earned && (
                  <p className="text-yellow-500 font-semibold">✓ Earned!</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
