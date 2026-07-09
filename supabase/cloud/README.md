# Supabase Cloud Setup

Use this folder for the development project in Supabase Cloud.

## Apply Schema

1. Open the Supabase project dashboard.
2. Go to SQL Editor.
3. Open `apply-001-005.sql` locally.
4. Paste the full SQL into the editor.
5. Run it once.
6. Open `apply-006-services-billing.sql` locally.
7. Paste the full SQL into the editor.
8. Run it once.
9. Open `apply-007-projects-tasks.sql` locally.
10. Paste the full SQL into the editor.
11. Run it once.
12. Open `apply-008-documents.sql` locally.
13. Paste the full SQL into the editor.
14. Run it once.
15. Open `apply-009-chat.sql` locally.
16. Paste the full SQL into the editor.
17. Run it once.

The scripts contain migrations:

```text
001_extensions.sql
002_organizations_profiles.sql
003_security_helpers.sql
004_accounts_contacts_units.sql
005_pipeline_opportunities.sql
006_services_billing.sql
007_projects_tasks.sql
008_documents.sql
009_chat.sql
```

If migrations 001-005 were already applied in this project, run only
`apply-006-services-billing.sql`, `apply-007-projects-tasks.sql`, `apply-008-documents.sql` and `apply-009-chat.sql`.

## Auth Redirect URL

To use password recovery in local development, add this URL in
Authentication > URL Configuration > Redirect URLs:

```text
http://127.0.0.1:5173/reset-password
```

## Create MVP Users

In Authentication > Users:

1. Create Davi.
2. Create Richards.
3. Confirm both users have a row in `public.profiles`.
4. Insert both into `public.organization_members` as `owner`.

Example after replacing IDs:

```sql
insert into public.organization_members (organization_id, user_id, role)
select organizations.id, 'USER_ID_HERE'::uuid, 'owner'
from public.organizations
where slug = 'arroba-co';
```

Do not place the `service_role` key in the front-end or `.env.local`.

## Link Davi And Richards As Owners

After both users exist, run `link-mvp-owners.sql` in the SQL Editor.

Before running, replace:

```text
DAVI_EMAIL_AQUI
RICHARDS_EMAIL_AQUI
```

with the exact emails used when creating the users in Supabase Auth.
