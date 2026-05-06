import { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface MoreSheetItem {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MoreSheetItem[];
  title?: string;
  description?: string;
}

export function MoreSheet({
  open,
  onOpenChange,
  items,
  title = 'More tools',
  description = 'Less-used actions live here so the dugout flow stays short.',
}: MoreSheetProps) {
  const handleSelect = (item: MoreSheetItem) => {
    if (item.disabled) return;
    item.onSelect();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto sm:max-w-md sm:mx-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">{title}</SheetTitle>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>
        <ul className="mt-4 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                className={cn(
                  'flex w-full items-center gap-4 py-4 text-left transition-colors',
                  'min-h-[56px] active:bg-secondary/60',
                  item.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-secondary/40',
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                  {item.icon}
                </span>
                <span className="flex-1">
                  <span className="block font-medium text-foreground">{item.label}</span>
                  {item.description && (
                    <span className="block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
