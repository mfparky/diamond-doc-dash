import { useState } from 'react';
import { Pitcher, Outing, getDaysRestNeeded } from '@/types/pitcher';
import { StatusBadge } from './StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Target, Gauge, Calendar, Video, ExternalLink, Shield, Pencil, Trash2 } from 'lucide-react';
import { EditOutingDialog } from './EditOutingDialog';
import { DeleteOutingDialog } from './DeleteOutingDialog';

interface PitcherDetailProps {
  pitcher: Pitcher;
  onBack: () => void;
  onUpdateOuting: (id: string, data: Partial<Omit<Outing, 'id' | 'timestamp'>>) => Promise<boolean>;
  onDeleteOuting: (id: string) => Promise<boolean>;
}

export function PitcherDetail({ pitcher, onBack, onUpdateOuting, onDeleteOuting }: PitcherDetailProps) {
  const [editingOuting, setEditingOuting] = useState<Outing | null>(null);
  const [deletingOuting, setDeletingOuting] = useState<Outing | null>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const daysRestNeeded = pitcher.lastPitchCount > 0 ? getDaysRestNeeded(pitcher.lastPitchCount) : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold text-foreground">{pitcher.name}</h2>
          <StatusBadge status={pitcher.restStatus} className="mt-1" />
        </div>
      </div>

      {/* Arm Care Status Card */}
      {pitcher.lastPitchCount > 0 && (
        <Card className="glass-card border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-foreground">Arm Care Status</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Last outing: <span className="text-foreground font-medium">{pitcher.lastPitchCount} pitches</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Rest required: <span className="text-foreground font-medium">{daysRestNeeded} day{daysRestNeeded !== 1 ? 's' : ''}</span>
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Pitch Count Rules:</p>
                  <div className="grid grid-cols-2 gap-1">
                    <span>76+ pitches → 4 days</span>
                    <span>61-75 pitches → 3 days</span>
                    <span>46-60 pitches → 2 days</span>
                    <span>31-45 pitches → 1 day</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">7-Day Pulse</p>
              <p className="text-2xl font-bold text-foreground">{pitcher.sevenDayPulse}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Strike %</p>
              <p className="text-2xl font-bold text-foreground">{pitcher.strikePercentage.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-danger/10">
              <Gauge className="w-5 h-5 text-status-danger" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Velo</p>
              <p className="text-2xl font-bold text-foreground">{pitcher.maxVelo || '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Outing</p>
              <p className="text-sm font-bold text-foreground">{formatDate(pitcher.lastOuting)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Notes */}
      {pitcher.notes && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Latest Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{pitcher.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Outing History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Outing History</CardTitle>
        </CardHeader>
        <CardContent>
          {pitcher.outings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No outings recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {pitcher.outings
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((outing) => (
                  <div 
                    key={outing.id} 
                    className="p-4 rounded-lg bg-secondary/50 border border-border/30"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{formatDate(outing.date)}</p>
                        <p className="text-sm text-accent">{outing.eventType}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {outing.videoUrl && (
                          <a 
                            href={outing.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                          >
                            <Video className="w-4 h-4" />
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingOuting(outing)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingOuting(outing)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Pitches: </span>
                        <span className="font-medium text-foreground">{outing.pitchCount}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({getDaysRestNeeded(outing.pitchCount)}d rest)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Strikes: </span>
                        <span className="font-medium text-foreground">{outing.strikes}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({outing.pitchCount > 0 ? ((outing.strikes / outing.pitchCount) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Velo: </span>
                        <span className="font-medium text-foreground">{outing.maxVelo}</span>
                      </div>
                    </div>
                    {outing.focus && (
                      <p className="mt-2 text-sm text-primary border-t border-border/30 pt-2">
                        <span className="font-medium">Focus:</span> {outing.focus}
                      </p>
                    )}
                    {outing.notes && (
                      <p className="mt-2 text-sm text-muted-foreground border-t border-border/30 pt-2">
                        {outing.notes}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditOutingDialog
        outing={editingOuting}
        open={!!editingOuting}
        onOpenChange={(open) => !open && setEditingOuting(null)}
        onSave={onUpdateOuting}
      />

      {/* Delete Dialog */}
      <DeleteOutingDialog
        open={!!deletingOuting}
        onOpenChange={(open) => !open && setDeletingOuting(null)}
        onConfirm={() => deletingOuting ? onDeleteOuting(deletingOuting.id) : Promise.resolve(false)}
        outingDate={deletingOuting ? formatDate(deletingOuting.date) : undefined}
      />
    </div>
  );
}
