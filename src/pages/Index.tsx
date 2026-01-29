import { useState, useMemo, useCallback } from 'react';
import { Pitcher, Outing } from '@/types/pitcher';
import { calculatePitcherStats } from '@/lib/pitcher-data';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { PitcherCard } from '@/components/PitcherCard';
import { CombinedDashboard } from '@/components/CombinedDashboard';
import { PitcherDetail } from '@/components/PitcherDetail';
import { OutingForm } from '@/components/OutingForm';
import { AllTimeStats } from '@/components/AllTimeStats';
import { RosterManagementDialog } from '@/components/RosterManagementDialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDaysRestNeeded } from '@/types/pitcher';
import { useOutings } from '@/hooks/use-outings';
import { usePitchers } from '@/hooks/use-pitchers';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { DEFAULT_MAX_WEEKLY_PITCHES } from '@/lib/pulse-status';

import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';

type View = 'dashboard' | 'detail';
type TimeView = '7day' | 'alltime';

const Index = () => {
  const { outings, isLoading: outingsLoading, addOuting, updateOuting, deleteOuting } = useOutings();
  const { pitchers: rosterPitchers, isLoading: pitchersLoading, addPitcher, updatePitcher, deletePitcher } = usePitchers();
  const { addPitchLocations } = usePitchLocations();
  const [activeTab, setActiveTab] = useState<'players' | 'team'>('players');
  const [timeView, setTimeView] = useState<TimeView>('7day');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedPitcher, setSelectedPitcher] = useState<Pitcher | null>(null);
  const [showOutingForm, setShowOutingForm] = useState(false);
  const [showRosterManagement, setShowRosterManagement] = useState(false);
  const { toast } = useToast();

  // Create a map of pitcher name to max weekly pitches
  const pitcherMaxPitches = useMemo(() => {
    const map: Record<string, number> = {};
    rosterPitchers.forEach(p => {
      map[p.name] = p.maxWeeklyPitches;
    });
    return map;
  }, [rosterPitchers]);

  // Create a map of pitcher ID to pitch types config
  const pitcherPitchTypesMap = useMemo(() => {
    const map: Record<string, PitchTypeConfig> = {};
    rosterPitchers.forEach(p => {
      map[p.id] = (p.pitchTypes as PitchTypeConfig) || DEFAULT_PITCH_TYPES;
    });
    return map;
  }, [rosterPitchers]);

  // Calculate updated pitcher stats based on all outings, sorted alphabetically
  const pitchers = useMemo(() => {
    // Create pitcher objects from database roster
    const basePitchers: Pitcher[] = rosterPitchers.map((p) => ({
      id: p.id,
      name: p.name,
      sevenDayPulse: 0,
      strikePercentage: 0,
      maxVelo: 0,
      lastOuting: '',
      lastPitchCount: 0,
      restStatus: { type: 'no-data' as const },
      notes: '',
      outings: [],
    }));
    
    return basePitchers
      .map((pitcher) => calculatePitcherStats(pitcher, outings))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rosterPitchers, outings]);

  const handleAddOuting = async (outingData: Omit<Outing, 'id' | 'timestamp'>, pitchLocations?: Array<{pitchNumber: number; pitchType: number; xLocation: number; yLocation: number; isStrike: boolean}>) => {
    const newOuting = await addOuting(outingData);
    if (newOuting) {
      // Save pitch locations if provided
      if (pitchLocations && pitchLocations.length > 0) {
        const selectedPitcher = rosterPitchers.find(p => p.name === outingData.pitcherName);
        if (selectedPitcher) {
          await addPitchLocations(newOuting.id, selectedPitcher.id, pitchLocations);
        }
      }
      
      setShowOutingForm(false);
      const daysRest = getDaysRestNeeded(outingData.pitchCount);
      toast({
        title: 'Outing Logged',
        description: `${outingData.pitcherName}: ${outingData.pitchCount} pitches → ${daysRest} day${daysRest !== 1 ? 's' : ''} rest required.`,
      });
    }
  };

  const handlePitcherClick = (pitcher: Pitcher) => {
    const updatedPitcher = pitchers.find((p) => p.id === pitcher.id);
    setSelectedPitcher(updatedPitcher || pitcher);
    setCurrentView('detail');
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToDashboard = useCallback(() => {
    setCurrentView('dashboard');
    setSelectedPitcher(null);
  }, []);


  // Time toggle pills component
  const TimeTogglePills = () => (
    <div className="flex items-center bg-secondary rounded-lg p-1 w-fit">
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-4 text-sm font-medium ${timeView === '7day' ? 'bg-card shadow-sm' : ''}`}
        onClick={() => setTimeView('7day')}
      >
        7-Day
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-4 text-sm font-medium ${timeView === 'alltime' ? 'bg-card shadow-sm' : ''}`}
        onClick={() => setTimeView('alltime')}
      >
        Season
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onAddOuting={() => setShowOutingForm(true)} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
        {currentView === 'dashboard' && activeTab === 'players' && (
          <div className="animate-slide-up">
            {/* Header with Time Toggle */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Roster
                  </h2>
                  <button
                    onClick={() => setShowRosterManagement(true)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Manage roster"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-muted-foreground">
                  {pitchers.length} pitchers •{' '}
                  {pitchers.filter((p) => p.restStatus.type === 'active').length} active •{' '}
                  {pitchers.filter((p) => p.restStatus.type === 'resting').length} resting
                </p>
              </div>
              <TimeTogglePills />
            </div>

            {/* Cards View - 7 Day */}
            {timeView === '7day' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pitchers.map((pitcher) => (
                  <PitcherCard
                    key={pitcher.id}
                    pitcher={pitcher}
                    onClick={() => handlePitcherClick(pitcher)}
                    maxWeeklyPitches={pitcherMaxPitches[pitcher.name] || DEFAULT_MAX_WEEKLY_PITCHES}
                  />
                ))}
              </div>
            )}

            {/* Season Stats */}
            {timeView === 'alltime' && (
              <AllTimeStats outings={outings} />
            )}
          </div>
        )}

        {currentView === 'dashboard' && activeTab === 'team' && (
          <CombinedDashboard 
            outings={outings} 
            pitcherPitchTypes={pitcherPitchTypesMap}
          />
        )}

        {currentView === 'detail' && selectedPitcher && (
          <PitcherDetail 
            pitcher={selectedPitcher} 
            onBack={handleBackToDashboard}
            onUpdateOuting={updateOuting}
            onDeleteOuting={deleteOuting}
          />
        )}
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddOuting={() => setShowOutingForm(true)}
      />

      {/* Outing Form Sheet - Mobile Friendly */}
      <Sheet open={showOutingForm} onOpenChange={setShowOutingForm}>
        <SheetContent
          side="bottom"
          className="h-[90vh] overflow-y-auto bg-background border-border"
        >
          <OutingForm
            pitchers={pitchers}
            onSubmit={handleAddOuting}
            onCancel={() => setShowOutingForm(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Roster Management Dialog */}
      <RosterManagementDialog
        open={showRosterManagement}
        onOpenChange={setShowRosterManagement}
        pitchers={rosterPitchers}
        onAddPitcher={addPitcher}
        onUpdatePitcher={updatePitcher}
        onDeletePitcher={deletePitcher}
      />
    </div>
  );
};

export default Index;