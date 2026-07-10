import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  ArrowDownToLine,
  Copy,
  FolderArchive,
  History,
  Link2,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { WorkspaceDocument } from '@/types/database';

import { documentStatusLabels, documentStatusOptions, documentTypeLabels, documentTypeOptions } from './documents-constants';
import { EditorToolbar } from './editor-toolbar';
import { resolveDocumentIcon } from './document-icon';
import type { SlashCommandItem } from './slash-command-menu';
import { SlashCommandMenu } from './slash-command-menu';
import type { DocumentAttachment, WorkspacePageWithContext } from './documents-workspace';

const slashCommands: SlashCommandItem[] = [
  { id: 'text', label: 'Texto', description: 'Volta para um paragrafo simples.' },
  { id: 'heading-1', label: 'Titulo 1', description: 'Estrutura principal da pagina.' },
  { id: 'heading-2', label: 'Titulo 2', description: 'Secoes importantes do documento.' },
  { id: 'heading-3', label: 'Titulo 3', description: 'Subsecoes e detalhes.' },
  { id: 'bullet-list', label: 'Lista', description: 'Lista com marcadores.' },
  { id: 'ordered-list', label: 'Lista numerada', description: 'Passos e sequencias.' },
  { id: 'checklist', label: 'Checklist', description: 'Itens para acompanhar execucao.' },
  { id: 'quote', label: 'Citacao', description: 'Destaca contexto ou observacao.' },
  { id: 'divider', label: 'Divisor', description: 'Cria uma quebra visual entre blocos.' },
  { id: 'table', label: 'Tabela', description: 'Tabela simples para organizacao.' },
  { id: 'image', label: 'Imagem', description: 'Insere imagem no corpo da pagina.' },
  { id: 'file', label: 'Arquivo', description: 'Anexa material de apoio.' },
  { id: 'link', label: 'Link', description: 'Cria link interno ou externo.' },
  { id: 'subpage', label: 'Subpagina', description: 'Cria pagina filha no workspace.' },
  { id: 'page-link', label: 'Pagina vinculada', description: 'Cria link para outra pagina interna.' },
  { id: 'code-block', label: 'Bloco de codigo', description: 'Formato monoespacado.' },
];

type SavePayload = {
  accountId: string | null;
  attachments: DocumentAttachment[];
  body: string;
  docType: WorkspaceDocument['doc_type'];
  icon: string | null;
  isPinned: boolean;
  parentDocumentId: string | null;
  projectId: string | null;
  status: WorkspaceDocument['status'];
  title: string;
};

type DocumentEditorProps = {
  accounts: Array<{ display_name: string; id: string }>;
  allPages: WorkspacePageWithContext[];
  canManageAttachments: boolean;
  document: WorkspacePageWithContext;
  isSaving: boolean;
  onAddSubpage: () => void;
  onDuplicate: () => void;
  onExportMarkdown: () => void;
  projects: Array<{ account_id: string; id: string; title: string }>;
  onSave: (payload: SavePayload) => void;
  onToggleArchive: () => void;
  onToggleFavorite: () => void;
};

export function DocumentEditor({
  accounts,
  allPages,
  canManageAttachments,
  document,
  isSaving,
  onAddSubpage,
  onDuplicate,
  onExportMarkdown,
  projects,
  onSave,
  onToggleArchive,
  onToggleFavorite,
}: DocumentEditorProps) {
  const Icon = resolveDocumentIcon(document.icon);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(document.title);
  const [docType, setDocType] = useState(document.doc_type);
  const [status, setStatus] = useState(document.status);
  const [accountId, setAccountId] = useState<string | null>(document.account_id);
  const [projectId, setProjectId] = useState<string | null>(document.project_id);
  const [parentDocumentId, setParentDocumentId] = useState<string | null>(document.parent_document_id);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>(document.attachments);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashRange, setSlashRange] = useState<{ from: number; to: number } | null>(null);
  const [slashPosition, setSlashPosition] = useState<{ left: number; top: number } | null>(null);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [bodyHtml, setBodyHtml] = useState(document.body);

  const availableParentPages = useMemo(
    () => allPages.filter((page) => page.id !== document.id && page.status !== 'archived'),
    [allPages, document.id],
  );
  const availableProjects = useMemo(
    () => projects.filter((project) => !accountId || project.account_id === accountId),
    [accountId, projects],
  );

  const filteredSlashCommands = useMemo(() => {
    const normalized = slashQuery.trim().toLowerCase();
    if (!normalized) return slashCommands;
    return slashCommands.filter((command) =>
      `${command.label} ${command.description}`.toLowerCase().includes(normalized),
    );
  }, [slashQuery]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: document.body,
    editorProps: {
      attributes: {
        class:
          'document-prosemirror min-h-[420px] rounded-xl border border-border bg-card px-6 py-5 text-[15px] leading-7 outline-none',
      },
      handleKeyDown: (_, event) => {
        if (!slashRange || filteredSlashCommands.length === 0) return false;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveSlashIndex((current) => (current + 1) % filteredSlashCommands.length);
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveSlashIndex((current) =>
            current === 0 ? filteredSlashCommands.length - 1 : current - 1,
          );
          return true;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          const item = filteredSlashCommands[activeSlashIndex];
          if (item) handleSlashCommand(item);
          return true;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          closeSlashMenu();
          return true;
        }

        return false;
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      updateSlashState(currentEditor);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      updateSlashState(currentEditor);
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      setBodyHtml(html);
      updateSlashState(currentEditor);
    },
  });

  useEffect(() => {
    setTitle(document.title);
    setDocType(document.doc_type);
    setStatus(document.status);
    setAccountId(document.account_id);
    setProjectId(document.project_id);
    setParentDocumentId(document.parent_document_id);
    setAttachments(document.attachments);
    setBodyHtml(document.body);
    editor?.commands.setContent(document.body);
  }, [document, editor]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSave({
        accountId,
        attachments,
        body: bodyHtml,
        docType,
        icon: document.icon,
        isPinned: document.is_pinned,
        parentDocumentId,
        projectId,
        status,
        title: title.trim() || 'Sem titulo',
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    accountId,
    attachments,
    bodyHtml,
    docType,
    document.icon,
    document.is_pinned,
    onSave,
    parentDocumentId,
    projectId,
    status,
    title,
  ]);

  function closeSlashMenu() {
    setSlashQuery('');
    setSlashRange(null);
    setSlashPosition(null);
    setActiveSlashIndex(0);
  }

  function updateSlashState(currentEditor: NonNullable<typeof editor>) {
    const { selection } = currentEditor.state;
    const textBefore = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n', '\0');
    const match = textBefore.match(/\/([A-Za-z0-9-]*)$/);

    if (!match) {
      closeSlashMenu();
      return;
    }

    const coords = currentEditor.view.coordsAtPos(selection.from);
    const container = editorWrapperRef.current?.getBoundingClientRect();
    setSlashQuery(match[1] ?? '');
    setSlashRange({ from: selection.from - match[0].length, to: selection.from });
    setSlashPosition(
      container
        ? { left: coords.left - container.left, top: coords.bottom - container.top + 10 }
        : { left: 24, top: 24 },
    );
  }

  function handleSlashCommand(item: SlashCommandItem) {
    if (!editor) return;

    const chain = editor.chain().focus();
    if (slashRange) chain.deleteRange(slashRange);

    switch (item.id) {
      case 'text':
        chain.setParagraph().run();
        break;
      case 'heading-1':
        chain.toggleHeading({ level: 1 }).run();
        break;
      case 'heading-2':
        chain.toggleHeading({ level: 2 }).run();
        break;
      case 'heading-3':
        chain.toggleHeading({ level: 3 }).run();
        break;
      case 'bullet-list':
        chain.toggleBulletList().run();
        break;
      case 'ordered-list':
        chain.toggleOrderedList().run();
        break;
      case 'checklist':
        chain.toggleTaskList().run();
        break;
      case 'quote':
        chain.toggleBlockquote().run();
        break;
      case 'divider':
        chain.setHorizontalRule().run();
        break;
      case 'table':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'image':
        openImagePicker();
        break;
      case 'file':
        openFilePicker();
        break;
      case 'link':
        insertLink();
        break;
      case 'subpage':
        onAddSubpage();
        break;
      case 'page-link':
        insertInternalPageLink();
        break;
      case 'code-block':
        chain.toggleCodeBlock().run();
        break;
      default:
        break;
    }

    closeSlashMenu();
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function openImagePicker() {
    imageInputRef.current?.click();
  }

  function insertLink() {
    if (!editor) return;
    const url = window.prompt('Cole a URL externa ou interna');
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function insertInternalPageLink() {
    if (!editor) return;
    const answer = window.prompt('Digite o titulo exato da pagina para vincular');
    if (!answer) return;

    const match = allPages.find((page) => page.title.toLowerCase() === answer.toLowerCase());
    if (!match) return;

    editor
      .chain()
      .focus()
      .insertContent(
        `<a href="/app/documentos/pagina/${match.id}" data-internal-page="${match.id}">${match.title}</a>`,
      )
      .run();
  }

  async function handleImageFiles(files: FileList | null) {
    if (!editor || !files?.length) return;
    const file = files[0];
    const url = await readFileAsDataUrl(file);
    editor.chain().focus().setImage({ src: url, alt: file.name }).run();
  }

  function handleAttachmentFiles(files: FileList | null) {
    if (!files?.length) return;

    const nextAttachments = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      kind: file.type.startsWith('image/') ? ('image' as const) : ('file' as const),
      mime_type: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
      caption: null,
      created_at: new Date().toISOString(),
      uploaded_by: document.updated_by,
      url: URL.createObjectURL(file),
    }));

    setAttachments((current) => [...nextAttachments, ...current]);
  }

  async function copyDocumentLink() {
    const link = `${window.location.origin}/app/documentos/pagina/${document.id}`;
    await navigator.clipboard.writeText(link);
  }

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/12 text-brand">
              <Icon size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={document.is_pinned ? 'brand' : 'neutral'}>
                  {document.is_pinned ? 'Favorita' : 'Pagina'}
                </Badge>
                <Badge tone={status === 'approved' ? 'success' : status === 'in_review' ? 'warning' : 'neutral'}>
                  {documentStatusLabels[status]}
                </Badge>
                <Badge tone="neutral">{documentTypeLabels[docType]}</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold">{document.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Edicao em estilo wiki com autosave, blocos e historico visual.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onAddSubpage}>
              <Plus size={16} />
              Subpagina
            </Button>
            <Button type="button" variant="secondary" onClick={onDuplicate}>
              <Copy size={16} />
              Duplicar
            </Button>
            <Button type="button" variant="ghost" onClick={copyDocumentLink}>
              <Link2 size={16} />
              Copiar link
            </Button>
            <Button type="button" variant="ghost" onClick={onExportMarkdown}>
              <ArrowDownToLine size={16} />
              Exportar
            </Button>
            <Button type="button" variant="ghost" onClick={onToggleFavorite}>
              <Star className={cn(document.is_pinned && 'fill-brand text-brand')} size={16} />
              Favoritar
            </Button>
            <Button type="button" variant="ghost" onClick={onToggleArchive}>
              <FolderArchive size={16} />
              {status === 'archived' ? 'Reabrir' : 'Arquivar'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Titulo</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <SelectField
            label="Tipo"
            value={docType}
            onChange={(value) => setDocType(value as WorkspaceDocument['doc_type'])}
            options={documentTypeOptions.map((option) => ({ value: option.value, label: option.label }))}
          />

          <SelectField
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as WorkspaceDocument['status'])}
            options={documentStatusOptions.map((option) => ({ value: option.value, label: option.label }))}
          />

          <SelectField
            label="Pagina pai"
            value={parentDocumentId ?? ''}
            onChange={(value) => setParentDocumentId(value || null)}
            options={[
              { value: '', label: 'Pagina raiz' },
              ...availableParentPages.map((page) => ({ value: page.id, label: page.title })),
            ]}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SelectField
            label="Cliente"
            value={accountId ?? ''}
            onChange={(value) => {
              setAccountId(value || null);
              if (value && !availableProjects.some((project) => project.id === projectId)) {
                setProjectId(projects.find((project) => project.account_id === value)?.id ?? null);
              }
            }}
            options={[
              { value: '', label: 'Sem cliente' },
              ...accounts.map((account) => ({ value: account.id, label: account.display_name })),
            ]}
          />

          <SelectField
            label="Projeto"
            value={projectId ?? ''}
            onChange={(value) => setProjectId(value || null)}
            options={[
              { value: '', label: 'Sem projeto' },
              ...availableProjects.map((project) => ({ value: project.id, label: project.title })),
            ]}
          />
        </div>
      </div>

      <EditorToolbar editor={editor} onAddFile={openFilePicker} onAddImage={openImagePicker} onAddLink={insertLink} />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <ContextCard
              label="Cliente vinculado"
              value={document.accountName ?? 'Sem cliente'}
              secondary={accountId ?? 'Livre'}
            />
            <ContextCard
              label="Projeto vinculado"
              value={document.projectTitle ?? 'Sem projeto'}
              secondary={projectId ?? 'Livre'}
            />
          </div>

          <div ref={editorWrapperRef} className="relative">
            <EditorContent editor={editor} />
            <SlashCommandMenu
              activeIndex={activeSlashIndex}
              items={filteredSlashCommands}
              onSelect={handleSlashCommand}
              position={slashPosition}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Anexos</h2>
                <p className="text-sm text-muted-foreground">
                  Arquivos de apoio da pagina, com visualizacao e download.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={openFilePicker}>
                <Plus size={16} />
                Anexar arquivo
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {attachments.length > 0 ? (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{attachment.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatBytes(attachment.size)} • {new Date(attachment.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold transition hover:bg-muted"
                        href={attachment.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Visualizar
                      </a>
                      <a
                        className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold transition hover:bg-muted"
                        download={attachment.name}
                        href={attachment.url}
                      >
                        Baixar
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Nenhum arquivo anexado ainda. Use a barra superior ou o botao acima para adicionar.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <History size={16} className="text-brand" />
              <h2 className="font-semibold">Versoes recentes</h2>
            </div>
            <div className="mt-4 space-y-3">
              {document.versions.length > 0 ? (
                document.versions.slice(0, 6).map((version) => (
                  <div key={version.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{version.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(version.saved_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  As versoes vao aparecendo conforme o autosave registra mudancas de titulo e conteudo.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brand" />
              <h2 className="font-semibold">Comandos rapidos</h2>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>`#` cria Titulo 1</li>
              <li>`##` cria Titulo 2</li>
              <li>`-` cria lista</li>
              <li>`1.` cria lista numerada</li>
              <li>`/` abre o menu de blocos</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Status do salvamento</span>
              <Badge tone={isSaving ? 'warning' : 'success'}>{isSaving ? 'Salvando...' : 'Salvo'}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {canManageAttachments
                ? 'O editor salva sozinho e ja deixa a pagina pronta para reabrir no mesmo ponto.'
                : 'A pagina esta em modo simplificado de anexos, mas a escrita e a navegacao seguem completas.'}
            </p>
          </div>
        </aside>
      </div>

      <input
        ref={fileInputRef}
        className="hidden"
        multiple
        type="file"
        onChange={(event) => handleAttachmentFiles(event.target.files)}
      />
      <input
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        type="file"
        onChange={(event) => void handleImageFiles(event.target.files)}
      />
    </div>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <select
        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ContextCard({
  label,
  secondary,
  value,
}: {
  label: string;
  secondary: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{secondary}</p>
    </div>
  );
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
