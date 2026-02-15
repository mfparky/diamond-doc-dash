import { Pitcher } from '@/types/pitcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ShareSummaryCardProps {
  pitcher: Pitcher;
  outingsCount: number;
}

export function ShareSummaryCard({ pitcher, outingsCount }: ShareSummaryCardProps) {
  const [copied, setCopied] = useState<'link' | 'summary' | null>(null);
  const { toast } = useToast();

  const dashboardUrl = `${window.location.origin}/player/${pitcher.id}`;

  const generateSummaryText = () => {
    const lines: string[] = [];
    lines.push(`${pitcher.name} - Pitching Summary`);
    lines.push('');
    lines.push(`7-Day Pulse: ${pitcher.sevenDayPulse} pitches`);
    if (pitcher.strikePercentage > 0) {
      lines.push(`Strike %: ${pitcher.strikePercentage.toFixed(1)}%`);
    }
    if (pitcher.maxVelo > 0) {
      lines.push(`Max Velocity: ${pitcher.maxVelo} mph`);
    }
    lines.push(`Total Outings: ${outingsCount}`);
    lines.push('');

    // Rest status
    if (pitcher.restStatus.type === 'active') {
      lines.push('Status: Active - Ready to pitch');
    } else if (pitcher.restStatus.type === 'resting') {
      lines.push(
        `Status: Resting - Day ${pitcher.restStatus.daysCurrent} of ${pitcher.restStatus.daysNeeded}`
      );
    } else if (pitcher.restStatus.type === 'threw-today') {
      lines.push('Status: Threw today');
    }

    lines.push('');
    lines.push(`Full dashboard: ${dashboardUrl}`);
    lines.push('');
    lines.push('Powered by Diamond Doc Dash');
    return lines.join('\n');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(dashboardUrl);
      setCopied('link');
      toast({
        title: 'Link copied!',
        description: `Share this link with ${pitcher.name.split(' ')[0]}'s family.`,
      });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(generateSummaryText());
      setCopied('summary');
      toast({
        title: 'Summary copied!',
        description: 'Paste into any messaging app to share.',
      });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }

    try {
      await navigator.share({
        title: `${pitcher.name} - Pitching Dashboard`,
        text: generateSummaryText(),
        url: dashboardUrl,
      });
    } catch (err: any) {
      // User cancelled share - that's fine
      if (err?.name !== 'AbortError') {
        handleCopyLink();
      }
    }
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Share2 className="w-4 h-4 text-primary" />
          Share with Parents
        </div>

        {/* Link preview */}
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
          <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
            {dashboardUrl}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-10"
            onClick={handleCopyLink}
          >
            {copied === 'link' ? (
              <Check className="w-4 h-4 mr-2 text-[hsl(142,70%,45%)]" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            Copy Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-10"
            onClick={handleCopySummary}
          >
            {copied === 'summary' ? (
              <Check className="w-4 h-4 mr-2 text-[hsl(142,70%,45%)]" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            Copy Summary
          </Button>
          {'share' in navigator && (
            <Button
              size="sm"
              className="h-10"
              onClick={handleNativeShare}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Parents can view live stats, arm care status, and videos — no login needed.
        </p>
      </CardContent>
    </Card>
  );
}
