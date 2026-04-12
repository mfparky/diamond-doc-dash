import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PrintableLiveAbsForm } from '@/components/PrintableLiveAbsForm';

export default function PrintLiveAbsPage() {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Config UI — hidden when printing */}
      <div className="print:hidden bg-background min-h-screen">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <h1 className="text-lg font-semibold">Print Live ABs Chart</h1>
          </div>

          <p className="text-sm text-muted-foreground">
            12 at-bat rows on a single landscape page. Fill in the pitcher,
            date, and opponent at the top, then track each batter's pitch zone,
            pitch count, and outcome as the inning unfolds. Circle the outcome
            label; mark pitch locations directly in the mini zone grid.
          </p>

          <Button onClick={handlePrint} className="w-full gap-2" size="lg">
            <Printer className="w-5 h-5" />
            Print Form
          </Button>

          {/* Print preview label */}
          <p className="text-xs text-muted-foreground text-center">Form preview ↓</p>
        </div>

        {/* Preview (screen only) */}
        <div className="border-t bg-white overflow-x-auto">
          <div className="max-w-5xl mx-auto py-4">
            <PrintableLiveAbsForm />
          </div>
        </div>
      </div>

      {/* Print-only output */}
      <div className="hidden print:block">
        <PrintableLiveAbsForm />
      </div>
    </div>
  );
}
