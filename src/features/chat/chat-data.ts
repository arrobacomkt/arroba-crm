import { initialCommercialLeads } from '@/features/opportunities/commercial-data';
import { loadLocalProjectWorkspace } from '@/features/projects/projects-data';
import type { Account, ChatChannel, ChatMessage, Profile, Project } from '@/types/database';

import { buildLinkPreview, type ChatAttachment, type ChatLinkPreview } from './chat-workspace';

export type ChatAccountOption = Pick<Account, 'id' | 'display_name'>;
export type ChatProjectOption = Pick<Project, 'account_id' | 'id' | 'status' | 'title'>;
export type ChatMemberOption = Pick<Profile, 'email' | 'full_name' | 'id'>;

type LocalChatStore = {
  attachments_by_message: Record<string, ChatAttachment[]>;
  channels: ChatChannel[];
  links_by_message: Record<string, ChatLinkPreview | null>;
  messages: ChatMessage[];
  last_opened_channel_id: string | null;
};

export type LocalChatWorkspace = {
  accounts: ChatAccountOption[];
  attachmentsByMessage: Record<string, ChatAttachment[]>;
  channels: ChatChannel[];
  lastOpenedChannelId: string | null;
  linksByMessage: Record<string, ChatLinkPreview | null>;
  members: ChatMemberOption[];
  messages: ChatMessage[];
  projects: ChatProjectOption[];
};

const LOCAL_STORAGE_KEY = 'arrobaco.chat.workspace.v2';
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
      title: 'geral',
      description: 'Alinhamentos rapidos do dia a dia da Arroba Co.',
      scope: 'general',
      account_id: null,
      project_id: null,
      position: 0,
      last_message_at: timestamp,
      icon: '#',
      created_by: richardsId,
      is_archived: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'channel-comercial',
      organization_id: organizationId,
      title: 'comercial',
      description: 'Pipeline, follow-ups e negociacoes em andamento.',
      scope: 'commercial',
      account_id: null,
      project_id: null,
      position: 1,
      last_message_at: timestamp,
      icon: '#',
      created_by: daviId,
      is_archived: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'channel-operacao-kianda',
      organization_id: organizationId,
      title: 'kianda-onboarding',
      description: 'Canal operacional para o onboarding da Kianda.',
      scope: 'client',
      account_id: 'account-kianda',
      project_id: 'project-kianda-onboarding',
      position: 0,
      last_message_at: timestamp,
      icon: '#',
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
      body: '@Richards a BioForma pediu retorno amanha depois da reuniao de diagnostico. https://arrobaco.local/proposta-bioforma',
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'message-kianda-1',
      organization_id: organizationId,
      channel_id: 'channel-operacao-kianda',
      author_id: richardsId,
      body: 'Checklist de onboarding quase fechado. Falta confirmar acessos e a rotina de aprovacao com a Marina.',
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];

  return {
    attachments_by_message: {},
    channels,
    links_by_message: {
      'message-comercial-1': buildLinkPreview(
        '@Richards a BioForma pediu retorno amanha depois da reuniao de diagnostico. https://arrobaco.local/proposta-bioforma',
      ),
    },
    messages,
    last_opened_channel_id: 'channel-geral',
  };
}

function persistStore(store: LocalChatStore) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
}

function buildWorkspaceFromStore(store: LocalChatStore): LocalChatWorkspace {
  return {
    accounts: seedAccounts(),
    attachmentsByMessage: store.attachments_by_message,
    channels: store.channels,
    lastOpenedChannelId: store.last_opened_channel_id,
    linksByMessage: store.links_by_message,
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
    const seed = buildSeedStore();
    const store = {
      attachments_by_message:
        parsed.attachments_by_message && typeof parsed.attachments_by_message === 'object'
          ? parsed.attachments_by_message
          : seed.attachments_by_message,
      channels: Array.isArray(parsed.channels) ? parsed.channels : seed.channels,
      links_by_message:
        parsed.links_by_message && typeof parsed.links_by_message === 'object'
          ? parsed.links_by_message
          : seed.links_by_message,
      messages: Array.isArray(parsed.messages) ? parsed.messages : seed.messages,
      last_opened_channel_id:
        typeof parsed.last_opened_channel_id === 'string' ? parsed.last_opened_channel_id : null,
    };
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

export type CreateLocalMessageInput = {
  attachments?: ChatAttachment[];
  authorId: string | null;
  body: string;
  channelId: string;
};

export type UpdateLocalChannelInput = {
  accountId: string | null;
  channelId: string;
  description: string | null;
  icon?: string | null;
  position?: number;
  projectId: string | null;
  scope: ChatChannel['scope'];
  title: string;
};

function saveWorkspace(
  workspace: LocalChatWorkspace,
  overrides: Partial<LocalChatStore>,
): LocalChatWorkspace {
  const store: LocalChatStore = {
    attachments_by_message: overrides.attachments_by_message ?? workspace.attachmentsByMessage,
    channels: overrides.channels ?? workspace.channels,
    links_by_message: overrides.links_by_message ?? workspace.linksByMessage,
    messages: overrides.messages ?? workspace.messages,
    last_opened_channel_id:
      overrides.last_opened_channel_id ?? workspace.lastOpenedChannelId ?? null,
  };
  persistStore(store);
  return buildWorkspaceFromStore(store);
}

export function createLocalChannel(
  workspace: LocalChatWorkspace,
  values: CreateLocalChannelInput,
  authorId: string | null,
): LocalChatWorkspace {
  const timestamp = nowIso();
  const nextChannel: ChatChannel = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    title: values.title.toLowerCase().replace(/\s+/g, '-'),
    description: values.description,
    scope: values.scope,
    account_id: values.accountId,
    project_id: values.projectId,
    position: workspace.channels.filter((channel) => channel.scope === values.scope).length,
    last_message_at: null,
    icon: '#',
    created_by: authorId,
    is_archived: false,
    created_at: timestamp,
    updated_at: timestamp,
  };

  return saveWorkspace(workspace, {
    channels: [nextChannel, ...workspace.channels],
    last_opened_channel_id: nextChannel.id,
  });
}

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

  return saveWorkspace(workspace, {
    attachments_by_message: values.attachments?.length
      ? {
          ...workspace.attachmentsByMessage,
          [nextMessage.id]: values.attachments,
        }
      : workspace.attachmentsByMessage,
    channels: workspace.channels.map((channel) =>
      channel.id === values.channelId
        ? { ...channel, updated_at: timestamp, last_message_at: timestamp }
        : channel,
    ),
    links_by_message: {
      ...workspace.linksByMessage,
      [nextMessage.id]: buildLinkPreview(values.body),
    },
    messages: [...workspace.messages, nextMessage],
    last_opened_channel_id: values.channelId,
  });
}

export function updateLocalChannel(
  workspace: LocalChatWorkspace,
  values: UpdateLocalChannelInput,
): LocalChatWorkspace {
  const timestamp = nowIso();
  return saveWorkspace(workspace, {
    channels: workspace.channels.map((channel) =>
      channel.id === values.channelId
        ? {
            ...channel,
            title: values.title.toLowerCase().replace(/\s+/g, '-'),
            description: values.description,
            scope: values.scope,
            account_id: values.accountId,
            icon: values.icon ?? channel.icon,
            position: values.position ?? channel.position,
            project_id: values.projectId,
            updated_at: timestamp,
          }
        : channel,
    ),
  });
}

export function archiveLocalChannel(
  workspace: LocalChatWorkspace,
  channelId: string,
): LocalChatWorkspace {
  const timestamp = nowIso();
  return saveWorkspace(workspace, {
    channels: workspace.channels.map((channel) =>
      channel.id === channelId
        ? {
            ...channel,
            is_archived: true,
            updated_at: timestamp,
          }
        : channel,
    ),
  });
}
