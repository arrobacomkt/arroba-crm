import { supabase } from '@/integrations/supabase/client';
import { getCurrentWorkspaceId } from '@/features/workspaces/workspace-active';
import type { ChatChannel, ChatMessage } from '@/types/database';

import type { ChatAccountOption, ChatMemberOption, ChatProjectOption } from './chat-data';

export type ChatWorkspaceChannel = ChatChannel & {
  accountName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
  projectTitle: string | null;
};

export type ChatWorkspaceMessage = ChatMessage & {
  authorEmail: string | null;
  authorName: string;
};

export type ChatWorkspace = {
  accounts: ChatAccountOption[];
  channels: ChatWorkspaceChannel[];
  members: ChatMemberOption[];
  messages: ChatWorkspaceMessage[];
  projects: ChatProjectOption[];
};

export const chatWorkspaceQueryKey = ['chat-workspace'] as const;

async function getCurrentOrganizationId() {
  if (!supabase) throw new Error('Supabase nao configurado.');

  return getCurrentWorkspaceId();
}

async function getCurrentUser() {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sessao invalida.');
  return data.user;
}

export async function fetchChatWorkspace(): Promise<ChatWorkspace> {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const orgId = await getCurrentOrganizationId();
  const [channelsResult, messagesResult, accountsResult, projectsResult, membersResult] =
    await Promise.all([
      supabase
        .from('chat_channels')
        .select('*')
        .eq('organization_id', orgId)
        .order('is_archived', { ascending: true })
        .order('position', { ascending: true })
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('chat_messages')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('accounts')
        .select('id, display_name')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('display_name', { ascending: true }),
      supabase
        .from('projects')
        .select('id, account_id, title, status')
        .eq('organization_id', orgId)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true }),
    ]);

  if (channelsResult.error) throw channelsResult.error;
  if (messagesResult.error) throw messagesResult.error;
  if (accountsResult.error) throw accountsResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (membersResult.error) throw membersResult.error;

  const accounts = (accountsResult.data ?? []) as ChatAccountOption[];
  const projects = (projectsResult.data ?? []) as ChatProjectOption[];
  const members = (membersResult.data ?? []) as ChatMemberOption[];
  const channels = (channelsResult.data ?? []) as ChatChannel[];
  const messages = (messagesResult.data ?? []) as ChatMessage[];

  const accountById = new Map(accounts.map((account) => [account.id, account.display_name]));
  const projectById = new Map(projects.map((project) => [project.id, project.title]));
  const memberById = new Map(members.map((member) => [member.id, member] as const));
  const messageSummaryByChannelId = new Map<
    string,
    { lastMessageAt: string | null; lastMessagePreview: string | null; messageCount: number }
  >();

  for (const message of messages) {
    const current = messageSummaryByChannelId.get(message.channel_id) ?? {
      lastMessageAt: null,
      lastMessagePreview: null,
      messageCount: 0,
    };

    current.messageCount += 1;
    if (!current.lastMessageAt || message.created_at >= current.lastMessageAt) {
      current.lastMessageAt = message.created_at;
      current.lastMessagePreview = message.body;
    }
    messageSummaryByChannelId.set(message.channel_id, current);
  }

  return {
    accounts,
    projects,
    members,
    channels: channels.map((channel) => {
      const summary = messageSummaryByChannelId.get(channel.id) ?? {
        lastMessageAt: channel.last_message_at,
        lastMessagePreview: null,
        messageCount: 0,
      };

      return {
        ...channel,
        accountName: channel.account_id ? (accountById.get(channel.account_id) ?? null) : null,
        lastMessageAt: summary.lastMessageAt,
        lastMessagePreview: summary.lastMessagePreview,
        messageCount: summary.messageCount,
        projectTitle: channel.project_id ? (projectById.get(channel.project_id) ?? null) : null,
      };
    }),
    messages: messages.map((message) => {
      const member = message.author_id ? memberById.get(message.author_id) : null;
      return {
        ...message,
        authorEmail: member?.email || null,
        authorName: member?.full_name || 'Equipe Arroba Co',
      };
    }),
  };
}

export type CreateChannelInput = {
  accountId: string | null;
  description: string | null;
  icon?: string | null;
  position?: number;
  projectId: string | null;
  scope: ChatChannel['scope'];
  title: string;
};

export async function createChatChannel(values: CreateChannelInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const [organizationId, user] = await Promise.all([getCurrentOrganizationId(), getCurrentUser()]);

  const { data, error } = await supabase
    .from('chat_channels')
    .insert({
      organization_id: organizationId,
      title: values.title.toLowerCase().replace(/\s+/g, '-'),
      description: values.description,
      scope: values.scope,
      account_id: values.accountId,
      project_id: values.projectId,
      position: values.position ?? 0,
      last_message_at: null,
      icon: values.icon ?? '#',
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export type CreateMessageInput = {
  body: string;
  channelId: string;
};

export async function createChatMessage(values: CreateMessageInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const [organizationId, user] = await Promise.all([getCurrentOrganizationId(), getCurrentUser()]);
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      organization_id: organizationId,
      channel_id: values.channelId,
      author_id: user.id,
      body: values.body,
    })
    .select('*')
    .single();

  if (error) throw error;

  await supabase
    .from('chat_channels')
    .update({ last_message_at: timestamp })
    .eq('id', values.channelId);

  return data;
}

export type UpdateChannelInput = {
  accountId: string | null;
  channelId: string;
  description: string | null;
  icon?: string | null;
  position?: number;
  projectId: string | null;
  scope: ChatChannel['scope'];
  title: string;
};

export async function updateChatChannel(values: UpdateChannelInput) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase
    .from('chat_channels')
    .update({
      title: values.title.toLowerCase().replace(/\s+/g, '-'),
      description: values.description,
      scope: values.scope,
      account_id: values.accountId,
      icon: values.icon ?? '#',
      position: values.position ?? 0,
      project_id: values.projectId,
    })
    .eq('id', values.channelId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function archiveChatChannel(channelId: string) {
  if (!supabase) throw new Error('Supabase nao configurado.');

  const { data, error } = await supabase
    .from('chat_channels')
    .update({ is_archived: true })
    .eq('id', channelId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
