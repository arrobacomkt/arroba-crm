import {
  CalendarDays,
  Clapperboard,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  NotebookPen,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  CalendarDays,
  Clapperboard,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  NotebookPen,
  Store,
};

export function resolveDocumentIcon(icon: string | null | undefined) {
  return icon ? (iconMap[icon] ?? FileText) : FileText;
}
