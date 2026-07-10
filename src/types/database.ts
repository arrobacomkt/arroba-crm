export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tables<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: never[];
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  icon_file_id: string | null;
  favicon_file_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  avatar_path: string | null;
  last_workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = {
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  is_active: boolean;
  created_at: string;
};

export type WorkspaceInvitation = {
  id: string;
  organization_id: string;
  invited_email: string;
  invited_user_id: string | null;
  invited_by: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  organization_id: string | null;
  type:
    | 'workspace_invitation_received'
    | 'workspace_invitation_accepted'
    | 'workspace_invitation_declined'
    | 'workspace_invitation_revoked'
    | 'workspace_role_changed'
    | 'workspace_icon_changed';
  title: string;
  body: string | null;
  action_url: string | null;
  metadata: Json;
  read_at: string | null;
  created_at: string;
};

export type WorkspaceUserPreference = {
  user_id: string;
  organization_id: string;
  last_accessed_at: string;
  sidebar_collapsed: boolean;
};

export type Account = {
  id: string;
  organization_id: string;
  lifecycle_status: 'lead' | 'client';
  status: 'active' | 'paused' | 'closed';
  display_name: string;
  legal_name: string | null;
  cnpj: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  instagram_url: string | null;
  website_url: string | null;
  lead_temperature: 'hot' | 'warm' | 'cold' | null;
  lead_source: string | null;
  owner_id: string | null;
  strategic_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Contact = {
  id: string;
  organization_id: string;
  account_id: string;
  full_name: string;
  role_title: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountUnit = {
  id: string;
  organization_id: string;
  account_id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  instagram_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type PipelineStage = {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  position: number;
  stage_group: 'open' | 'won' | 'lost';
  color_token: string | null;
  is_active: boolean;
  created_at: string;
};

export type Opportunity = {
  id: string;
  organization_id: string;
  account_id: string;
  primary_contact_id: string | null;
  pipeline_stage_id: string;
  title: string;
  estimated_value: number | null;
  expected_close_date: string | null;
  proposal_valid_until: string | null;
  owner_id: string;
  next_follow_up_at: string | null;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityLineItem = {
  id: string;
  opportunity_id: string;
  service_catalog_id: string | null;
  description: string;
  quantity: number;
  unit_value: number;
  total_value: number;
  recurrence: 'one_off' | 'monthly';
  created_at: string;
};

export type ServiceCatalog = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  default_price: number;
  recurrence: 'one_off' | 'monthly';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientService = {
  id: string;
  organization_id: string;
  account_id: string;
  service_catalog_id: string;
  status: 'active' | 'paused' | 'closed';
  contracted_price: number;
  recurrence: 'one_off' | 'monthly';
  billing_day: number | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type ClientServiceUnit = {
  id: string;
  organization_id: string;
  client_service_id: string;
  account_unit_id: string;
  created_at: string;
};

export type BillingCycle = {
  id: string;
  organization_id: string;
  account_id: string;
  client_service_id: string;
  reference_month: string;
  amount: number;
  status: 'pending' | 'paid' | 'late' | 'exempt';
  due_date: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  organization_id: string;
  account_id: string;
  title: string;
  description: string | null;
  project_type: 'onboarding' | 'one_off' | 'monthly';
  status: 'planned' | 'active' | 'blocked' | 'completed' | 'archived';
  owner_id: string;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectTask = {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee_id: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceDocument = {
  id: string;
  organization_id: string;
  account_id: string | null;
  project_id: string | null;
  parent_document_id: string | null;
  title: string;
  doc_type: 'briefing' | 'script' | 'report' | 'note';
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  body: string;
  icon: string | null;
  cover_file_id: string | null;
  position: number;
  is_pinned: boolean;
  last_opened_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentFavorite = {
  document_id: string;
  user_id: string;
  created_at: string;
};

export type DocumentRecentView = {
  document_id: string;
  user_id: string;
  viewed_at: string;
};

export type ChatChannel = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  scope: 'general' | 'commercial' | 'operations' | 'client';
  account_id: string | null;
  project_id: string | null;
  position: number;
  last_message_at: string | null;
  icon: string | null;
  created_by: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  organization_id: string;
  channel_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type MessageLink = {
  id: string;
  organization_id: string;
  message_id: string;
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      organizations: Tables<Organization>;
      profiles: Tables<Profile>;
      organization_members: Tables<OrganizationMember>;
      workspace_invitations: Tables<WorkspaceInvitation>;
      notifications: Tables<Notification>;
      workspace_user_preferences: Tables<WorkspaceUserPreference>;
      accounts: Tables<Account>;
      contacts: Tables<Contact>;
      account_units: Tables<AccountUnit>;
      pipeline_stages: Tables<PipelineStage>;
      opportunities: Tables<Opportunity>;
      opportunity_line_items: Tables<OpportunityLineItem>;
      service_catalog: Tables<ServiceCatalog>;
      client_services: Tables<ClientService>;
      client_service_units: Tables<ClientServiceUnit>;
      billing_cycles: Tables<BillingCycle>;
      projects: Tables<Project>;
      project_tasks: Tables<ProjectTask>;
      documents: Tables<WorkspaceDocument>;
      document_favorites: Tables<DocumentFavorite>;
      document_recent_views: Tables<DocumentRecentView>;
      chat_channels: Tables<ChatChannel>;
      chat_messages: Tables<ChatMessage>;
      message_links: Tables<MessageLink>;
    };
    Views: Record<string, never>;
    Functions: {
      current_org_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      is_org_member: {
        Args: { target_org_id: string };
        Returns: boolean;
      };
      is_org_owner: {
        Args: { target_org_id: string };
        Returns: boolean;
      };
      is_current_user: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
      rpc_convert_opportunity_to_client: {
        Args: { p_opportunity_id: string; p_services?: Json };
        Returns: void;
      };
      rpc_mark_billing_cycle_paid: {
        Args: { p_billing_cycle_id: string };
        Returns: void;
      };
      rpc_create_workspace: {
        Args: { p_name: string; p_slug: string; p_icon_file_id?: string | null };
        Returns: Json;
      };
      rpc_accept_workspace_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      rpc_decline_workspace_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
