import { Globe2 } from 'lucide-react';

import type { ChatLinkPreview } from './chat-workspace';

type LinkPreviewCardProps = {
  preview: ChatLinkPreview;
};

export function LinkPreviewCard({ preview }: LinkPreviewCardProps) {
  return (
    <a
      className="block rounded-xl border border-border bg-card p-3 transition hover:border-brand/30 hover:bg-muted/40"
      href={preview.url}
      rel="noreferrer"
      target="_blank"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Globe2 size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{preview.title ?? preview.domain}</p>
          <p className="mt-1 text-xs text-muted-foreground">{preview.domain}</p>
          {preview.description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{preview.description}</p>
          ) : null}
        </div>
      </div>
    </a>
  );
}
