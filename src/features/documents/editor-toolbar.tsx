import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Table2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

type EditorToolbarProps = {
  editor: Editor | null;
  onAddFile: () => void;
  onAddImage: () => void;
  onAddLink: () => void;
};

export function EditorToolbar({ editor, onAddFile, onAddImage, onAddLink }: EditorToolbarProps) {
  if (!editor) return null;

  const toolbarButtons = [
    { icon: Bold, label: 'Negrito', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: Italic, label: 'Italico', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: Strikethrough, label: 'Tachado', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
    { icon: Code2, label: 'Codigo inline', action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
    { icon: Quote, label: 'Citacao', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
    { icon: List, label: 'Lista', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { icon: ListOrdered, label: 'Lista numerada', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { icon: Table2, label: 'Tabela', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), active: editor.isActive('table') },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap gap-2">
        {toolbarButtons.map((button) => (
          <Button
            key={button.label}
            className={cn('h-9 w-9 px-0', button.active && 'bg-brand/15 text-brand hover:bg-brand/20')}
            title={button.label}
            type="button"
            variant="ghost"
            onClick={button.action}
          >
            <button.icon size={16} />
          </Button>
        ))}
        <Button className="h-9 w-9 px-0" title="Link" type="button" variant="ghost" onClick={onAddLink}>
          <Link2 size={16} />
        </Button>
        <Button className="h-9 w-9 px-0" title="Imagem" type="button" variant="ghost" onClick={onAddImage}>
          <ImagePlus size={16} />
        </Button>
        <Button className="h-9 px-3" title="Arquivo" type="button" variant="secondary" onClick={onAddFile}>
          Arquivo
        </Button>
      </div>
    </div>
  );
}
