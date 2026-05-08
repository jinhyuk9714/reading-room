create table if not exists public.reader_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_languages text[] not null default array['ko']::text[],
  preferred_providers text[] not null default array['kakao', 'naver', 'google', 'manual']::text[],
  excluded_providers text[] not null default '{}'::text[],
  favorite_subjects text[] not null default '{}'::text[],
  blocked_subjects text[] not null default '{}'::text[],
  signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reader_preferences_has_language check (cardinality(preferred_languages) > 0),
  constraint reader_preferences_languages_not_empty check (
    array_position(preferred_languages, '') is null
  ),
  constraint reader_preferences_providers_not_empty check (
    array_position(preferred_providers, '') is null
    and array_position(excluded_providers, '') is null
  )
);

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  book_id uuid references public.books(id) on delete set null,
  provider text,
  provider_id text,
  source text,
  query text,
  recommendation jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendation_events_event_type_allowed check (
    event_type ~ '^[a-z][a-z0-9_]{1,63}$'
  ),
  constraint recommendation_events_provider_not_empty check (
    provider is null or length(trim(provider)) > 0
  ),
  constraint recommendation_events_provider_id_not_empty check (
    provider_id is null or length(trim(provider_id)) > 0
  )
);

alter table public.reader_preferences enable row level security;
alter table public.reader_preferences force row level security;

alter table public.recommendation_events enable row level security;
alter table public.recommendation_events force row level security;

drop trigger if exists reader_preferences_set_updated_at on public.reader_preferences;
create trigger reader_preferences_set_updated_at
  before update on public.reader_preferences
  for each row
  execute function public.set_updated_at();

drop trigger if exists recommendation_events_set_updated_at on public.recommendation_events;
create trigger recommendation_events_set_updated_at
  before update on public.recommendation_events
  for each row
  execute function public.set_updated_at();

create policy "reader preferences select own"
  on public.reader_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "reader preferences insert own"
  on public.reader_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "reader preferences update own"
  on public.reader_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "reader preferences delete own"
  on public.reader_preferences for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "recommendation events select own"
  on public.recommendation_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "recommendation events insert own"
  on public.recommendation_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "recommendation events update own"
  on public.recommendation_events for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "recommendation events delete own"
  on public.recommendation_events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists recommendation_events_user_created_at_idx
  on public.recommendation_events (user_id, created_at desc);

create index if not exists recommendation_events_user_type_created_at_idx
  on public.recommendation_events (user_id, event_type, created_at desc);

revoke all on public.reader_preferences from public;
revoke all on public.recommendation_events from public;
revoke all on public.reader_preferences from anon;
revoke all on public.recommendation_events from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.reader_preferences to authenticated;
grant select, insert, update, delete on public.recommendation_events to authenticated;
