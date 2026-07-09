import { supabase } from '@/integrations/supabase/client';
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

  const { data, error } = await supabase.rpc('current_org_ids');
  if (error) throw error;

  const orgId = data.at(0);
  if (!orgId) throw new Error('Usuario sem organizacao ativa.');
  return orgId;
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
        .eq('is_archived', false)
        .order('updated_at', { ascending: false }),
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

  const accounts = accountsResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const members = (membersResult.data ?? []) as ChatMemberOption[];
  const channels = channelsResult.data ?? [];
  const messages = messagesResult.data ?? [];

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
        lastMessageAt: null,
        lastMessagePreview: null,
        messageCount: 0,
      };

      return {
        ...channel,
        accountName: channel.account_id ? (accountById.get(channel.account_id) ?? null) : null,
        projectTitle: channel.project_id ? (projectById.get(channel.project_id) ?? null) : null,
        lastMessageAt: summary.lastMessageAt,
        lastMessagePreview: summary.lastMessagePreview,
        messageCount: summary.messageCount,
      };
    }),
    messages: messages.map((message) => {
      const member = message.author_id ? memberById.get(message.author_id) : null;
      return {
        ...message,
        authorName: member?.full_name || 'Equipe Arroba Co',
        authorEmail: member?.email || null,
      };
    }),
  };
}

export type CreateChannelInput = {
  accountId: string | null;
  description: string | null;
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
      title: values.title,
      description: values.description,
      scope: values.scope,
      account_id: values.accountId,
      project_id: values.projectId,
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
  return data;
}
