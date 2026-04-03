import { useEffect, useState, useRef } from 'react';

interface FlipCounterProps {
  value: number;
  label: string;
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
    <div className="relative w-8 sm:w-10 h-12 sm:h-14 overflow-hidden">
      <div
        className={`absolute inset-0 flex items-center justify-center rounded-md bg-secondary border border-border/50 text-xl sm:text-2xl font-mono font-bold text-foreground transition-transform duration-300 ${
          flipping ? 'scale-y-0' : 'scale-y-100'
        }`}
        style={{ transformOrigin: 'center bottom' }}
      >
        {displayed}
      </div>
    </div>
  );
}

export function FlipCounter({ value, label }: FlipCounterProps) {
  const digits = String(value).padStart(3, '0').split('');

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1">
        {digits.map((d, i) => (
          <FlipDigit key={i} digit={d} delay={i * 100} />
        ))}
      </div>
    </div>
  );
}
