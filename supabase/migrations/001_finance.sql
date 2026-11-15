-- Execute no SQL Editor do projeto Supabase. Não altera tabelas existentes.
begin;
create table if not exists public.fingsec_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint fingsec_state_shape check (
    jsonb_typeof(state) = 'object'
    and state ?& array['transactions','categories','budgets','bills','goals','settings']
    and jsonb_typeof(state->'transactions') = 'array'
    and jsonb_typeof(state->'categories') = 'array'
    and jsonb_typeof(state->'budgets') = 'object'
    and jsonb_typeof(state->'bills') = 'array'
    and jsonb_typeof(state->'goals') = 'array'
    and jsonb_typeof(state->'settings') = 'object'
    and octet_length(state::text) <= 2000000
  )
);
alter table public.fingsec_accounts enable row level security;
revoke all on public.fingsec_accounts from anon;
grant select, insert, update on public.fingsec_accounts to authenticated;
drop policy if exists fingsec_owner_read on public.fingsec_accounts;
drop policy if exists fingsec_owner_insert on public.fingsec_accounts;
drop policy if exists fingsec_owner_update on public.fingsec_accounts;
create policy fingsec_owner_read on public.fingsec_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy fingsec_owner_insert on public.fingsec_accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fingsec_owner_update on public.fingsec_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Escrita atômica com controle de versão. Executa com as permissões do usuário.
create or replace function public.save_fingsec_state(expected_revision bigint, next_state jsonb)
returns setof public.fingsec_accounts
language plpgsql security invoker set search_path = '' as $$
declare saved public.fingsec_accounts;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if expected_revision = 0 then
    insert into public.fingsec_accounts(user_id,state,revision)
      values(auth.uid(),next_state,1) on conflict(user_id) do nothing returning * into saved;
  else
    update public.fingsec_accounts set state = next_state, revision = revision + 1, updated_at = now()
      where user_id = auth.uid() and revision = expected_revision returning * into saved;
  end if;
  if saved.user_id is null then raise exception 'revision_conflict' using errcode = '40001'; end if;
  return next saved;
end;
$$;
revoke all on function public.save_fingsec_state(bigint,jsonb) from public, anon;
grant execute on function public.save_fingsec_state(bigint,jsonb) to authenticated;
commit;
