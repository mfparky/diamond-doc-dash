import { useState, useMemo } from 'react';
import { Outing } from '@/types/pitcher';
import { EnhancedVideoPlayer } from './EnhancedVideoPlayer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { Columns2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoComparisonViewProps {
  outings: Outing[];
  pitchTypes?: PitchTypeConfig;
  onClose?: () => void;
}

export function VideoComparisonView({
  outings,
  pitchTypes = DEFAULT_PITCH_TYPES,
  onClose,
}: VideoComparisonViewProps) {
  const [leftOutingId, setLeftOutingId] = useState<string>('');
  const [rightOutingId, setRightOutingId] = useState<string>('');
  const [leftVideoSlot, setLeftVideoSlot] = useState<'1' | '2'>('1');
  const [rightVideoSlot, setRightVideoSlot] = useState<'1' | '2'>('1');

  // Get outings that have at least one video
  const outingsWithVideo = useMemo(
    () =>
      outings
        .filter((o) => o.videoUrl1 || o.videoUrl2 || o.videoUrl)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [outings]
  );

  const formatOutingLabel = (o: Outing) => {
    const [year, month, day] = o.date.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${o.eventType}`;
  };

  const getVideoForOuting = (outing: Outing | undefined, slot: '1' | '2') => {
    if (!outing) return null;
    if (slot === '1' && outing.videoUrl1) return { url: outing.videoUrl1, pitchType: outing.video1PitchType, velocity: outing.video1Velocity };
    if (slot === '2' && outing.videoUrl2) return { url: outing.videoUrl2, pitchType: outing.video2PitchType, velocity: outing.video2Velocity };
    if (outing.videoUrl) return { url: outing.videoUrl, pitchType: undefined, velocity: undefined };
    // Fallback: if slot 1 doesn't exist, try slot 2 and vice versa
    if (slot === '1' && outing.videoUrl2) return { url: outing.videoUrl2, pitchType: outing.video2PitchType, velocity: outing.video2Velocity };
    if (slot === '2' && outing.videoUrl1) return { url: outing.videoUrl1, pitchType: outing.video1PitchType, velocity: outing.video1Velocity };
    return null;
  };

  const leftOuting = outingsWithVideo.find((o) => o.id === leftOutingId);
  const rightOuting = outingsWithVideo.find((o) => o.id === rightOutingId);
  const leftVideo = getVideoForOuting(leftOuting, leftVideoSlot);
  const rightVideo = getVideoForOuting(rightOuting, rightVideoSlot);

  const hasMultipleVideos = (outing: Outing | undefined) =>
    outing && outing.videoUrl1 && outing.videoUrl2;

  if (outingsWithVideo.length < 2) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Columns2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Need at least 2 outings with video to compare side-by-side.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add YouTube links to outings from the outing history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Columns2 className="w-5 h-5 text-primary" />
            Side-by-Side Comparison
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Side */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={leftOutingId} onValueChange={setLeftOutingId}>
                <SelectTrigger className="flex-1 h-9 text-xs">
                  <SelectValue placeholder="Select outing..." />
                </SelectTrigger>
                <SelectContent>
                  {outingsWithVideo.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {formatOutingLabel(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasMultipleVideos(leftOuting) && (
                <Select value={leftVideoSlot} onValueChange={(v) => setLeftVideoSlot(v as '1' | '2')}>
                  <SelectTrigger className="w-20 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">Vid 1</SelectItem>
                    <SelectItem value="2" className="text-xs">Vid 2</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {leftVideo ? (
              <EnhancedVideoPlayer
                url={leftVideo.url}
                pitchType={leftVideo.pitchType}
                velocity={leftVideo.velocity}
                pitchTypes={pitchTypes}
                compact
              />
            ) : (
              <div className="aspect-video bg-secondary/50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Select an outing above</p>
              </div>
            )}
            {leftOuting && (
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground block">Pitches</span>
                  <span className="font-bold text-foreground">{leftOuting.pitchCount}</span>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground block">Strike %</span>
                  <span className="font-bold text-foreground">
                    {leftOuting.strikes !== null && leftOuting.pitchCount > 0
                      ? `${((leftOuting.strikes / leftOuting.pitchCount) * 100).toFixed(0)}%`
                      : '-'}
                  </span>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground block">Max Velo</span>
                  <span className="font-bold text-foreground">
                    {leftOuting.maxVelo > 0 ? `${leftOuting.maxVelo}` : '-'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Side */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={rightOutingId} onValueChange={setRightOutingId}>
                <SelectTrigger className="flex-1 h-9 text-xs">
                  <SelectValue placeholder="Select outing..." />
                </SelectTrigger>
                <SelectContent>
                  {outingsWithVideo.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {formatOutingLabel(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasMultipleVideos(rightOuting) && (
                <Select value={rightVideoSlot} onValueChange={(v) => setRightVideoSlot(v as '1' | '2')}>
                  <SelectTrigger className="w-20 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">Vid 1</SelectItem>
                    <SelectItem value="2" className="text-xs">Vid 2</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {rightVideo ? (
              <EnhancedVideoPlayer
                url={rightVideo.url}
                pitchType={rightVideo.pitchType}
                velocity={rightVideo.velocity}
                pitchTypes={pitchTypes}
                compact
              />
            ) : (
              <div className="aspect-video bg-secondary/50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Select an outing above</p>
              </div>
            )}
            {rightOuting && (
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground block">Pitches</span>
                  <span className="font-bold text-foreground">{rightOuting.pitchCount}</span>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground block">Strike %</span>
                  <span className="font-bold text-foreground">
                    {rightOuting.strikes !== null && rightOuting.pitchCount > 0
                      ? `${((rightOuting.strikes / rightOuting.pitchCount) * 100).toFixed(0)}%`
                      : '-'}
                  </span>
                </div>
                <div className="bg-secondary/50 rounded p-2">
                  <span className="text-muted-foreground block">Max Velo</span>
                  <span className="font-bold text-foreground">
                    {rightOuting.maxVelo > 0 ? `${rightOuting.maxVelo}` : '-'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Summary */}
        {leftOuting && rightOuting && (
          <div className="mt-4 p-3 bg-secondary/30 rounded-lg border border-border/30">
            <p className="text-xs font-semibold text-foreground mb-2">Outing Comparison</p>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="text-center">
                <span className="text-muted-foreground block">Metric</span>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground block">Left</span>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground block">Right</span>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground block">Diff</span>
              </div>

              {/* Pitch Count */}
              <div className="text-center font-medium">Pitches</div>
              <div className="text-center">{leftOuting.pitchCount}</div>
              <div className="text-center">{rightOuting.pitchCount}</div>
              <div className="text-center">
                <DiffBadge value={rightOuting.pitchCount - leftOuting.pitchCount} />
              </div>

              {/* Strike % */}
              <div className="text-center font-medium">Strike %</div>
              <div className="text-center">
                {leftOuting.strikes !== null && leftOuting.pitchCount > 0
                  ? `${((leftOuting.strikes / leftOuting.pitchCount) * 100).toFixed(0)}%`
                  : '-'}
              </div>
              <div className="text-center">
                {rightOuting.strikes !== null && rightOuting.pitchCount > 0
                  ? `${((rightOuting.strikes / rightOuting.pitchCount) * 100).toFixed(0)}%`
                  : '-'}
              </div>
              <div className="text-center">
                {leftOuting.strikes !== null && rightOuting.strikes !== null && leftOuting.pitchCount > 0 && rightOuting.pitchCount > 0 ? (
                  <DiffBadge
                    value={
                      Math.round((rightOuting.strikes / rightOuting.pitchCount) * 100) -
                      Math.round((leftOuting.strikes / leftOuting.pitchCount) * 100)
                    }
                    suffix="%"
                    higherIsBetter
                  />
                ) : (
                  '-'
                )}
              </div>

              {/* Max Velo */}
              <div className="text-center font-medium">Max Velo</div>
              <div className="text-center">{leftOuting.maxVelo > 0 ? leftOuting.maxVelo : '-'}</div>
              <div className="text-center">{rightOuting.maxVelo > 0 ? rightOuting.maxVelo : '-'}</div>
              <div className="text-center">
                {leftOuting.maxVelo > 0 && rightOuting.maxVelo > 0 ? (
                  <DiffBadge value={rightOuting.maxVelo - leftOuting.maxVelo} higherIsBetter />
                ) : (
                  '-'
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiffBadge({
  value,
  suffix = '',
  higherIsBetter = false,
}: {
  value: number;
  suffix?: string;
  higherIsBetter?: boolean;
}) {
  if (value === 0) return <span className="text-muted-foreground">-</span>;
  const isPositive = value > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
        isGood
          ? 'bg-[hsl(142,70%,45%)]/15 text-[hsl(142,70%,45%)]'
          : 'bg-[hsl(0,72%,55%)]/15 text-[hsl(0,72%,55%)]'
      }`}
    >
      {isPositive ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}
