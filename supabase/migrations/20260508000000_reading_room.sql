create extension if not exists pgcrypto;

do $$ begin
  create type public.reading_status as enum (
    'want_to_read',
    'reading',
    'paused',
    'finished',
    'abandoned'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  locale text not null default 'ko-KR',
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_id text not null,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  isbn_10 text,
  isbn_13 text,
  cover_url text,
  page_count integer,
  published_year integer,
  language text,
  description text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status public.reading_status not null default 'reading',
  current_page integer,
  current_percent integer,
  started_on date,
  finished_on date,
  rating integer,
  reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id),
  constraint library_items_current_page_nonnegative check (
    current_page is null or current_page >= 0
  ),
  constraint library_items_current_percent_range check (
    current_percent is null or current_percent between 0 and 100
  ),
  constraint library_items_rating_range check (
    rating is null or rating between 1 and 5
  )
);

create table if not exists public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  library_item_id uuid not null references public.library_items(id) on delete cascade,
  logged_at timestamptz not null default now(),
  current_page integer,
  current_percent integer,
  pages_read integer,
  note varchar(500),
  created_at timestamptz not null default now(),
  constraint reading_logs_current_page_nonnegative check (
    current_page is null or current_page >= 0
  ),
  constraint reading_logs_current_percent_range check (
    current_percent is null or current_percent between 0 and 100
  ),
  constraint reading_logs_pages_read_nonnegative check (
    pages_read is null or pages_read >= 0
  )
);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.library_items enable row level security;
alter table public.reading_logs enable row level security;

create policy "profiles select own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles upsert own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "books authenticated read"
  on public.books for select
  to authenticated
  using (true);

create policy "books authenticated insert"
  on public.books for insert
  to authenticated
  with check (true);

create policy "books authenticated update"
  on public.books for update
  to authenticated
  using (true)
  with check (true);

create policy "library select own"
  on public.library_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "library insert own"
  on public.library_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "library update own"
  on public.library_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "library delete own"
  on public.library_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "logs select own"
  on public.reading_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "logs insert own"
  on public.reading_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "logs update own"
  on public.reading_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "logs delete own"
  on public.reading_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists library_items_user_status_idx
  on public.library_items (user_id, status);

create index if not exists reading_logs_user_logged_at_idx
  on public.reading_logs (user_id, logged_at desc);
