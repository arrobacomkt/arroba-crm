import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type InviteWorkspaceMemberInput = {
  workspaceId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const input = (await request.json()) as InviteWorkspaceMemberInput;
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !anonKey || !serviceRole) {
      throw new Error('Ambiente do Supabase incompleto.');
    }

    const authHeader = request.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const adminClient = createClient(url, serviceRole);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Nao autenticado.');
    }

    const { data: memberships, error: membershipError } = await adminClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', input.workspaceId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);
    if (membershipError) throw membershipError;

    const actorRole = memberships?.[0]?.role;
    if (!actorRole || !['owner', 'admin'].includes(actorRole)) {
      throw new Error('Sem permissao para convidar usuarios.');
    }

    const email = input.email.trim().toLowerCase();
    const { data: existingInvite } = await adminClient
      .from('workspace_invitations')
      .select('id')
      .eq('organization_id', input.workspaceId)
      .eq('invited_email', email)
      .eq('status', 'pending')
      .limit(1);
    if (existingInvite?.length) {
      throw new Error('Ja existe convite pendente para este e-mail.');
    }

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      const { data: activeMembership } = await adminClient
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', input.workspaceId)
        .eq('user_id', existingProfile.id)
        .eq('is_active', true)
        .limit(1);
      if (activeMembership?.length) {
        throw new Error('Esse usuario ja participa do workspace.');
      }
    }

    const token = crypto.randomUUID();
    const tokenBytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', tokenBytes);
    const tokenHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    const { data: invitation, error: invitationError } = await adminClient
      .from('workspace_invitations')
      .insert({
        organization_id: input.workspaceId,
        invited_email: email,
        invited_user_id: existingProfile?.id ?? null,
        invited_by: user.id,
        role: input.role,
        status: 'pending',
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    if (invitationError) throw invitationError;

    let notificationCreated = false;
    if (existingProfile) {
      const { error: notificationError } = await adminClient.from('notifications').insert({
        user_id: existingProfile.id,
        organization_id: input.workspaceId,
        type: 'workspace_invitation_received',
        title: 'Novo convite de workspace',
        body: 'Voce recebeu um convite para participar de um workspace.',
        action_url: '/workspaces',
      });
      if (notificationError) throw notificationError;
      notificationCreated = true;
    }

    return Response.json(
      {
        invitationId: invitation.id,
        invitedEmail: email,
        invitedUserExists: Boolean(existingProfile),
        notificationCreated,
        emailSent: false,
        status: 'pending',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro inesperado.' },
      { status: 400, headers: corsHeaders },
    );
  }
});
