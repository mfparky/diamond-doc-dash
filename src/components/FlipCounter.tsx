import { useEffect, useState, useRef } from 'react';

interface FlipCounterProps {
  value: number;
  label?: string;
  countUpFrom?: number;
}

function FlipDigit({ digit }: { digit: string }) {
  const [displayed, setDisplayed] = useState(digit);
  const [flipping, setFlipping] = useState(false);
  const prevRef = useRef(digit);

  useEffect(() => {
    if (digit === prevRef.current) return;
    setFlipping(true);
    const half = setTimeout(() => {
      prevRef.current = digit;
      setDisplayed(digit);
      setFlipping(false);
    }, 250);
    return () => clearTimeout(half);
  }, [digit]);

  return (
    <div className="relative w-9 sm:w-11 h-12 sm:h-14">
      <div
        className={`absolute inset-0 flex items-center justify-center rounded-md bg-secondary border border-border/50 text-2xl sm:text-3xl font-mono font-bold text-foreground transition-transform duration-250 ease-in-out ${
          flipping ? 'scale-y-0' : 'scale-y-100'
        }`}
        style={{ transformOrigin: 'center bottom', transitionDuration: '250ms' }}
      >
        {displayed}
      </div>
    </div>
  );
}

export function FlipCounter({ value, label, countUpFrom }: FlipCounterProps) {
  const startVal = countUpFrom !== undefined ? Math.max(0, countUpFrom) : value;
  const [displayValue, setDisplayValue] = useState(startVal);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (countUpFrom === undefined || hasAnimated.current) {
      setDisplayValue(value);
      return;
    }
    hasAnimated.current = true;
    let current = Math.max(0, countUpFrom);
    setDisplayValue(current);

    // ~1 second per step
    const interval = setInterval(() => {
      current += 1;
      setDisplayValue(current);
      if (current >= value) clearInterval(interval);
    }, 900);

    return () => clearInterval(interval);
  }, [value, countUpFrom]);

  const padded = String(displayValue).padStart(3, '0');
  const digits = padded.split('');

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      )}
      <div className="flex items-center gap-1">
        {digits.map((d, i) => (
          <FlipDigit key={i} digit={d} />
        ))}
      </div>
    </div>
  );
}
