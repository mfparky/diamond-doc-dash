import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PrintableForm } from '@/components/PrintableForm';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';

const STORAGE_KEY = 'print_form_pitch_types';

function loadSavedTypes(): PitchTypeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_PITCH_TYPES;
  } catch {
    return DEFAULT_PITCH_TYPES;
  }
}

export default function PrintFormPage() {
  const navigate = useNavigate();
  const [pitchTypes, setPitchTypes] = useState<PitchTypeConfig>(loadSavedTypes);

  const activePitchTypes = Object.fromEntries(
    Object.entries(pitchTypes).filter(([, v]) => v.trim() !== '')
  );

  const handleChange = (key: string, value: string) => {
    const updated = { ...pitchTypes, [key]: value };
    setPitchTypes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

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
            <h1 className="text-lg font-semibold">Print Pitch Chart</h1>
          </div>

          <p className="text-sm text-muted-foreground">
            Configure your pitch types, then print. The redesigned form uses pre-labeled
            regions and count fields — much more reliable for AI scanning than the
            free-draw format.
          </p>

          {/* Pitch type config */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Pitch Types (leave blank to hide)</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['1', '2', '3', '4', '5'] as const).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm font-mono w-4 text-muted-foreground">{key}</span>
                  <Input
                    className="h-8 text-sm"
                    placeholder={`e.g. ${DEFAULT_PITCH_TYPES[key] ?? '—'}`}
                    value={pitchTypes[key] ?? ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    maxLength={6}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handlePrint} className="w-full gap-2" size="lg">
            <Printer className="w-5 h-5" />
            Print Form
          </Button>

          <div className="border rounded-lg p-3 bg-muted/30 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How to use this form:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Write the <strong>count</strong> of pitches per region (not individual marks)</li>
              <li>Solid border = strike zone, dashed = ball region</li>
              <li>Sequence strip is optional but enables pitch-order tracking</li>
              <li>Scan with "Scan Paper Form" — AI reads cell counts directly</li>
            </ul>
          </div>

          {/* Print preview label */}
          <p className="text-xs text-muted-foreground text-center">Form preview ↓</p>
        </div>

        {/* Preview (screen only) */}
        <div className="border-t bg-white overflow-x-auto">
          <div className="max-w-2xl mx-auto py-4">
            <PrintableForm pitchTypes={Object.keys(activePitchTypes).length ? activePitchTypes : DEFAULT_PITCH_TYPES} />
          </div>
        </div>
      </div>

      {/* Print-only output */}
      <div className="hidden print:block">
        <PrintableForm pitchTypes={Object.keys(activePitchTypes).length ? activePitchTypes : DEFAULT_PITCH_TYPES} />
      </div>
    </div>
  );
}
