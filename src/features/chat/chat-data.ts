import { initialCommercialLeads } from '@/features/opportunities/commercial-data';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import type { Account, ChatChannel, ChatMessage, Profile, Project } from '@/types/database';

export type ChatAccountOption = Pick<Account, 'id' | 'display_name'>;
export type ChatProjectOption = Pick<Project, 'account_id' | 'id' | 'status' | 'title'>;
export type ChatMemberOption = Pick<Profile, 'email' | 'full_name' | 'id'>;

type LocalChatStore = {
  channels: ChatChannel[];
  messages: ChatMessage[];
};

export type LocalChatWorkspace = {
  accounts: ChatAccountOption[];
  channels: ChatChannel[];
  members: ChatMemberOption[];
  messages: ChatMessage[];
  projects: ChatProjectOption[];
};

const LOCAL_STORAGE_KEY = 'arrobaco.localChatWorkspace';
const organizationId = 'org-arroba-local';
const daviId = 'user-davi-local';
const richardsId = 'local-richards';

function nowIso() {
  return new Date().toISOString();
}

function seedMembers(): ChatMemberOption[] {
  return [
    { id: daviId, full_name: 'Davi', email: 'davi@arrobaco.local' },
    { id: richardsId, full_name: 'Richards', email: 'richards@arrobaco.local' },
  ];
}

function seedAccounts(): ChatAccountOption[] {
  return initialCommercialLeads
    .filter((lead) => lead.account.lifecycle_status === 'client')
    .map((lead) => ({
      id: lead.account.id,
      display_name: lead.account.display_name,
    }));
}

function seedProjects(): ChatProjectOption[] {
  return loadLocalProjectWorkspace().projects.map((project) => ({
    id: project.id,
    account_id: project.account_id,
    title: project.title,
    status: project.status,
  }));
}

function buildSeedStore(): LocalChatStore {
  const timestamp = nowIso();

  const channels: ChatChannel[] = [
    {
      id: 'channel-geral',
      organization_id: organizationId,
      title: 'Geral',
      description: 'Alinhamentos rapidos do dia a dia da Arroba Co.',
      scope: 'general',
      account_id: null,
      project_id: null,
      created_by: richardsId,
      is_archived: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'channel-comercial',
      organization_id: organizationId,
      title: 'Comercial',
      description: 'Pipeline, follow-ups e negociacoes em andamento.',
      scope: 'commercial',
      account_id: null,
      project_id: null,
      created_by: daviId,
      is_archived: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'channel-kianda',
      organization_id: organizationId,
      title: 'Kianda onboarding',
      description: 'Canal operacional para o onboarding da Kianda.',
      scope: 'client',
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      created_by: richardsId,
      is_archived: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];

  const messages: ChatMessage[] = [
    {
      id: 'message-geral-1',
      organization_id: organizationId,
      channel_id: 'channel-geral',
      author_id: daviId,
      body: 'Bom dia. Hoje preciso fechar os follow-ups da Studio BioForma e revisar o calendario da Kianda.',
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'message-geral-2',
      organization_id: organizationId,
      channel_id: 'channel-geral',
      author_id: richardsId,
      body: 'Perfeito. Eu sigo com os documentos e te marco aqui se precisar de aprovacao em algum roteiro.',
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'message-comercial-1',
      organization_id: organizationId,
      channel_id: 'channel-comercial',
      author_id: daviId,
      body: '@Richards a BioForma pediu retorno amanha depois da reuniao de diagnostico.',
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'message-kianda-1',
      organization_id: organizationId,
      channel_id: 'channel-kianda',
      author_id: richardsId,
      body: 'Checklist de onboarding quase fechado. Falta confirmar acessos e a rotina de aprovacao com a Marina.',
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];

  return { channels, messages };
}

function persistStore(store: LocalChatStore) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
}

function buildWorkspaceFromStore(store: LocalChatStore): LocalChatWorkspace {
  return {
    accounts: seedAccounts(),
    channels: store.channels,
    members: seedMembers(),
    messages: store.messages,
    projects: seedProjects(),
  };
}

export function loadLocalChatWorkspace(): LocalChatWorkspace {
  if (typeof window === 'undefined') {
    return buildWorkspaceFromStore(buildSeedStore());
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    const seedStore = buildSeedStore();
    persistStore(seedStore);
    return buildWorkspaceFromStore(seedStore);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalChatStore>;
    const channels = Array.isArray(parsed.channels) ? parsed.channels : buildSeedStore().channels;
    const messages = Array.isArray(parsed.messages) ? parsed.messages : buildSeedStore().messages;
    const store = { channels, messages };
    persistStore(store);
    return buildWorkspaceFromStore(store);
  } catch {
    const seedStore = buildSeedStore();
    persistStore(seedStore);
    return buildWorkspaceFromStore(seedStore);
  }
}

export type CreateLocalChannelInput = {
  accountId: string | null;
  description: string | null;
  projectId: string | null;
  scope: ChatChannel['scope'];
  title: string;
};

export function createLocalChannel(
  workspace: LocalChatWorkspace,
  values: CreateLocalChannelInput,
  authorId: string | null,
): LocalChatWorkspace {
  const timestamp = nowIso();
  const nextChannel: ChatChannel = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    title: values.title,
    description: values.description,
    scope: values.scope,
    account_id: values.accountId,
    project_id: values.projectId,
    created_by: authorId,
    is_archived: false,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const nextStore = {
    channels: [nextChannel, ...workspace.channels],
    messages: workspace.messages,
  };
  persistStore(nextStore);
  return buildWorkspaceFromStore(nextStore);
}

export type CreateLocalMessageInput = {
  authorId: string | null;
  body: string;
  channelId: string;
};

export function createLocalMessage(
  workspace: LocalChatWorkspace,
  values: CreateLocalMessageInput,
): LocalChatWorkspace {
  const timestamp = nowIso();
  const nextMessage: ChatMessage = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    channel_id: values.channelId,
    author_id: values.authorId,
    body: values.body,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const nextStore = {
    channels: workspace.channels.map((channel) =>
      channel.id === values.channelId ? { ...channel, updated_at: timestamp } : channel,
    ),
    messages: [...workspace.messages, nextMessage],
  };
  persistStore(nextStore);
  return buildWorkspaceFromStore(nextStore);
}

export type UpdateLocalChannelInput = {
  accountId: string | null;
  channelId: string;
  description: string | null;
  projectId: string | null;
  scope: ChatChannel['scope'];
  title: string;
};

export function updateLocalChannel(
  workspace: LocalChatWorkspace,
  values: UpdateLocalChannelInput,
): LocalChatWorkspace {
  const timestamp = nowIso();
  const nextStore = {
    channels: workspace.channels.map((channel) =>
      channel.id === values.channelId
        ? {
            ...channel,
            title: values.title,
            description: values.description,
            scope: values.scope,
            account_id: values.accountId,
            project_id: values.projectId,
            updated_at: timestamp,
          }
        : channel,
    ),
    messages: workspace.messages,
  };

  persistStore(nextStore);
  return buildWorkspaceFromStore(nextStore);
}

export function archiveLocalChannel(
  workspace: LocalChatWorkspace,
  channelId: string,
): LocalChatWorkspace {
  const timestamp = nowIso();
  const nextStore = {
    channels: workspace.channels.map((channel) =>
      channel.id === channelId
        ? {
            ...channel,
            is_archived: true,
            updated_at: timestamp,
          }
        : channel,
    ),
    messages: workspace.messages,
  };

  persistStore(nextStore);
  return buildWorkspaceFromStore(nextStore);
}
