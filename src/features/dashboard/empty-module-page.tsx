import { FolderKanban } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';

type EmptyModulePageProps = {
  title: string;
  description: string;
};

export function EmptyModulePage({ title, description }: EmptyModulePageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estrutura pronta para o próximo marco.</p>
      </div>
      <EmptyState
        icon={<FolderKanban size={22} />}
        title={`${title} em preparação`}
        description={description}
      />
    </div>
  );
}
