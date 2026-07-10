-- Dev/testing convenience only: creates a login directly via SQL instead of
-- the Dashboard "Add User" flow. Fine for a throwaway test admin account;
-- for real staff, prefer Authentication -> Users -> Add User instead (it's
-- the officially supported path and avoids writing to the auth schema by hand).
--
-- Creates: admin@mobilemax.test / MobileMax#2026
-- The existing on_auth_user_created trigger fires automatically and creates
-- the matching public.profiles row (default role 'manager'); the final
-- statement below promotes it to 'admin'.

do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@mobilemax.test',
    crypt('MobileMax#2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Test Admin"}',
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    new_user_id::text,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@mobilemax.test'),
    'email',
    now(), now(), now()
  );
end $$;

update public.profiles set role = 'admin' where email = 'admin@mobilemax.test';
