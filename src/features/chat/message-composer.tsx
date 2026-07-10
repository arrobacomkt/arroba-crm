import { AtSign, Paperclip, Send, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import type { ChatMemberOption } from './chat-data';
import type { ChatAttachment } from './chat-workspace';

type MessageComposerProps = {
  isSending: boolean;
  members: ChatMemberOption[];
  onSend: (payload: { attachments: ChatAttachment[]; body: string }) => Promise<void> | void;
};

export function MessageComposer({ isSending, members, onSend }: MessageComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  const mentionQuery = useMemo(() => {
    const match = body.match(/@([\w-À-ÿ]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [body]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return members.filter((member) =>
      member.full_name.toLowerCase().includes(mentionQuery),
    );
  }, [members, mentionQuery]);

  async function handleSubmit() {
    if (!body.trim() && attachments.length === 0) return;
    await onSend({ attachments, body: body.trim() });
    setBody('');
    setAttachments([]);
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      kind: file.type.startsWith('image/') ? ('image' as const) : ('file' as const),
      mime_type: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    }));
    setAttachments((current) => [...current, ...next]);
  }

  function insertMention(name: string) {
    setBody((current) => current.replace(/@([\w-À-ÿ]*)$/, `@${name} `));
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs"
            >
              <span className="truncate">{attachment.name}</span>
              <button
                className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
                type="button"
                onClick={() =>
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                }
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <textarea
          className="min-h-28 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="Escreva uma mensagem. Enter envia, Shift + Enter quebra linha."
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
        />

        {mentionSuggestions.length > 0 ? (
          <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-border bg-card p-2 shadow-xl">
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mencionar pessoa
            </div>
            <div className="space-y-1">
              {mentionSuggestions.slice(0, 5).map((member) => (
                <button
                  key={member.id}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                  type="button"
                  onClick={() => insertMention(member.full_name)}
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/12 text-xs font-semibold text-brand">
                    {member.full_name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-9 px-3" type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            <Paperclip size={14} />
            Anexar
          </Button>
          <Button
            className="h-9 px-3"
            type="button"
            variant="ghost"
            onClick={() => setBody((current) => `${current}${current ? ' ' : ''}@`)}
          >
            <AtSign size={14} />
            Mencao
          </Button>
        </div>
        <Button disabled={isSending} type="button" onClick={() => void handleSubmit()}>
          <Send size={16} />
          Enviar
        </Button>
      </div>

      <input
        ref={inputRef}
        className="hidden"
        multiple
        type="file"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
