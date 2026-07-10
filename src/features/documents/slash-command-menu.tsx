import { Hash } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export type SlashCommandItem = {
  description: string;
  id: string;
  label: string;
};

type SlashCommandMenuProps = {
  activeIndex: number;
  items: SlashCommandItem[];
  onSelect: (item: SlashCommandItem) => void;
  position: { left: number; top: number } | null;
};

export function SlashCommandMenu({
  activeIndex,
  items,
  onSelect,
  position,
}: SlashCommandMenuProps) {
  if (!position || items.length === 0) return null;

  return (
    <div
      className="absolute z-30 w-[280px] rounded-xl border border-border bg-card p-2 shadow-xl"
      style={{ left: position.left, top: position.top }}
    >
      <div className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Inserir bloco
      </div>
      <div className="space-y-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition',
              index === activeIndex ? 'bg-brand/12' : 'hover:bg-muted',
            )}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
          >
            <div className="mt-0.5 rounded-md bg-muted p-1.5 text-muted-foreground">
              <Hash size={14} />
            </div>
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
