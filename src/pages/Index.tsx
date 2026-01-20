import { useState, useMemo } from 'react';
import { Pitcher, Outing } from '@/types/pitcher';
import { initialPitchers, calculatePitcherStats } from '@/lib/pitcher-data';
import { Header } from '@/components/Header';
import { PitcherCard } from '@/components/PitcherCard';
import { PitcherTable } from '@/components/PitcherTable';
import { PitcherDetail } from '@/components/PitcherDetail';
import { OutingForm } from '@/components/OutingForm';
import { AllTimeStats } from '@/components/AllTimeStats';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { getDaysRestNeeded } from '@/types/pitcher';
import { useOutings } from '@/hooks/use-outings';

type View = 'dashboard' | 'detail';
type TimeView = '7day' | 'alltime';

const Index = () => {
  const { outings, isLoading, addOuting, updateOuting, deleteOuting } = useOutings();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [timeView, setTimeView] = useState<TimeView>('7day');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedPitcher, setSelectedPitcher] = useState<Pitcher | null>(null);
  const [showOutingForm, setShowOutingForm] = useState(false);
  const { toast } = useToast();

  // Calculate updated pitcher stats based on all outings, sorted alphabetically
  const pitchers = useMemo(() => {
    return initialPitchers
      .map((pitcher) => calculatePitcherStats(pitcher, outings))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [outings]);

  const handleAddOuting = async (outingData: Omit<Outing, 'id' | 'timestamp'>) => {
    const newOuting = await addOuting(outingData);
    if (newOuting) {
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
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddOuting={() => setShowOutingForm(true)}
        timeView={timeView}
        onTimeViewChange={setTimeView}
      />

      <main className="container mx-auto px-4 py-6">
        {currentView === 'dashboard' && timeView === '7day' && (
          <div className="animate-slide-up">
            {/* Stats Summary */}
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold text-foreground mb-1">
                Roster
              </h2>
              <p className="text-muted-foreground">
                {pitchers.length} pitchers •{' '}
                {pitchers.filter((p) => p.restStatus.type === 'active').length} active •{' '}
                {pitchers.filter((p) => p.restStatus.type === 'resting').length} resting
              </p>
            </div>

            {/* Desktop Table View */}
            {viewMode === 'table' && (
              <div className="hidden md:block">
                <PitcherTable pitchers={pitchers} onPitcherClick={handlePitcherClick} />
              </div>
            )}

            {/* Cards View (default on mobile, toggle on desktop) */}
            {(viewMode === 'cards' || window.innerWidth < 768) && (
              <div className={viewMode === 'table' ? 'md:hidden' : ''}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pitchers.map((pitcher) => (
                    <PitcherCard
                      key={pitcher.id}
                      pitcher={pitcher}
                      onClick={() => handlePitcherClick(pitcher)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
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
    </div>
  );
};

export default Index;