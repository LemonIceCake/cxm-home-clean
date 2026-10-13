-- 於 Supabase SQL Editor 執行。資料庫拒絕非成員，瀏覽器不能新增成員。
create table public.households(id uuid primary key default gen_random_uuid(), document jsonb not null, version bigint not null default 0, updated_at timestamptz not null default now());
create table public.household_members(household_id uuid not null references public.households(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,primary key(household_id,user_id),unique(user_id));
alter table public.households enable row level security;
alter table public.household_members enable row level security;
create policy member_self on public.household_members for select to authenticated using(user_id=auth.uid());
create policy household_read on public.households for select to authenticated using(exists(select 1 from public.household_members m where m.household_id=id and m.user_id=auth.uid()));
revoke all on public.households, public.household_members from anon,authenticated;
grant select on public.households,public.household_members to authenticated;
create function public.limit_household_members() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.households where id=new.household_id for update;
 if (select count(*) from public.household_members where household_id=new.household_id)>=2 then raise exception 'Only two members allowed'; end if;
 return new;
end $$;
create trigger two_members before insert on public.household_members for each row execute function public.limit_household_members();
create function public.save_household(target uuid, expected_version bigint, new_document jsonb) returns bigint language plpgsql security definer set search_path=public as $$
declare next_version bigint;
begin
 if not exists(select 1 from public.household_members where household_id=target and user_id=auth.uid()) then raise exception 'ACCESS_DENIED'; end if;
 if new_document->>'schema' is distinct from '1' or jsonb_typeof(new_document->'items') is distinct from 'array' or jsonb_typeof(new_document->'budgets') is distinct from 'object' or jsonb_typeof(new_document->'house') is distinct from 'object' or jsonb_array_length(new_document->'mortgages')<>2 or octet_length(new_document::text)>2000000 then raise exception 'INVALID_DOCUMENT'; end if;
 update public.households set document=new_document,version=version+1,updated_at=now() where id=target and version=expected_version returning version into next_version;
 if next_version is null then raise exception 'VERSION_CONFLICT'; end if;
 return next_version;
end $$;
revoke all on function public.save_household(uuid,bigint,jsonb) from public,anon;
grant execute on function public.save_household(uuid,bigint,jsonb) to authenticated;
revoke all on function public.limit_household_members() from public,anon,authenticated;
