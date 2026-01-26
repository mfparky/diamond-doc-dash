import { useState, useMemo } from 'react';
import { Pitcher, Outing } from '@/types/pitcher';
import { calculatePitcherStats } from '@/lib/pitcher-data';
import { Header } from '@/components/Header';
import { PitcherDetail } from '@/components/PitcherDetail';
import { OutingForm } from '@/components/OutingForm';
import { AllTimeStats } from '@/components/AllTimeStats';
import { SevenDayDashboard } from '@/components/SevenDayDashboard';
import { RosterManagementDialog } from '@/components/RosterManagementDialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { getDaysRestNeeded } from '@/types/pitcher';
import { useOutings } from '@/hooks/use-outings';
import { usePitchers } from '@/hooks/use-pitchers';
import { usePitchLocations } from '@/hooks/use-pitch-locations';

type View = 'dashboard' | 'detail';
type TimeView = '7day' | 'alltime';

const Index = () => {
  const { outings, isLoading: outingsLoading, addOuting, updateOuting, deleteOuting } = useOutings();
  const { pitchers: rosterPitchers, isLoading: pitchersLoading, addPitcher, updatePitcher, deletePitcher } = usePitchers();
  const { addPitchLocations } = usePitchLocations();
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
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedPitcher(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        onAddOuting={() => setShowOutingForm(true)}
        timeView={timeView}
        onTimeViewChange={setTimeView}
      />

      <main className="container mx-auto px-4 py-6">
        {currentView === 'dashboard' && timeView === '7day' && (
          <SevenDayDashboard 
            pitchers={pitchers}
            outings={outings}
            pitcherMaxPitches={pitcherMaxPitches}
            onPitcherClick={handlePitcherClick}
            onEditRoster={() => setShowRosterManagement(true)}
          />
        )}

        {currentView === 'dashboard' && timeView === 'alltime' && (
          <AllTimeStats outings={outings} />
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