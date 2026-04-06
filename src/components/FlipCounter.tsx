import { useEffect, useState, useRef } from 'react';

interface FlipCounterProps {
  value: number;
  label?: string;
  /** If set, the counter will animate counting up from this number to `value` on mount */
  countUpFrom?: number;
}

function FlipDigit({ digit, delay }: { digit: string; delay: number }) {
  const [displayed, setDisplayed] = useState('0');
  const [flipping, setFlipping] = useState(false);
  const prevRef = useRef('0');

  useEffect(() => {
    if (digit === prevRef.current) return;
    const timer = setTimeout(() => {
      setFlipping(true);
      setTimeout(() => {
        prevRef.current = digit;
        setDisplayed(digit);
        setFlipping(false);
      }, 300);
    }, delay);
    return () => clearTimeout(timer);
  }, [digit, delay]);

  return (
    <div className="relative w-9 sm:w-11 h-12 sm:h-14">
      <div
        className={`absolute inset-0 flex items-center justify-center rounded-md bg-secondary border border-border/50 text-2xl sm:text-3xl font-mono font-bold text-foreground transition-transform duration-300 ${
          flipping ? 'scale-y-0' : 'scale-y-100'
        }`}
        style={{ transformOrigin: 'center bottom' }}
      >
        {displayed}
      </div>
    </div>
  );
}

export function FlipCounter({ value, label, countUpFrom }: FlipCounterProps) {
  const [displayValue, setDisplayValue] = useState(countUpFrom ?? value);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (countUpFrom === undefined || countUpFrom >= value || hasAnimated.current) {
      setDisplayValue(value);
      return;
    }

    hasAnimated.current = true;
    let current = countUpFrom;
    const step = () => {
      current += 1;
      setDisplayValue(current);
      if (current < value) {
        setTimeout(step, 350);
      }
    };
    // Start after a short delay so the initial render is visible
    const timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, [value, countUpFrom]);

  // Determine padding: at least 3 digits, but grow for larger numbers
  const str = String(displayValue);
  const padded = str.length < 3 ? str.padStart(3, '0') : str;
  const digits = padded.split('');

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      )}
      <div className="flex items-center gap-1">
        {digits.map((d, i) => (
          <FlipDigit key={`${i}-${digits.length}`} digit={d} delay={i * 120} />
        ))}
      </div>
    </div>
  );
}
