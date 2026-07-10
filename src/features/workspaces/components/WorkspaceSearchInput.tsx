import { Search } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes } from 'react';

import { Input } from '@/components/ui/input';

type WorkspaceSearchInputProps = InputHTMLAttributes<HTMLInputElement>;

export const WorkspaceSearchInput = forwardRef<HTMLInputElement, WorkspaceSearchInputProps>(
  function WorkspaceSearchInput(props, ref) {
    return (
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input ref={ref} className="pl-9" placeholder="Procurar workspace" {...props} />
      </label>
    );
  },
);
