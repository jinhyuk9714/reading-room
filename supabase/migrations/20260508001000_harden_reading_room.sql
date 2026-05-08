create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.library_items
  add column if not exists custom_title text,
  add column if not exists custom_authors text[],
  add column if not exists custom_page_count integer;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row
  execute function public.set_updated_at();

drop trigger if exists library_items_set_updated_at on public.library_items;
create trigger library_items_set_updated_at
  before update on public.library_items
  for each row
  execute function public.set_updated_at();

do $$
begin
  alter table public.books
    add constraint books_page_count_positive
    check (page_count is null or page_count > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.books
    add constraint books_published_year_reasonable
    check (published_year is null or published_year between 1000 and 3000);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  update public.library_items
    set finished_on = current_date
    where status = 'finished'
      and finished_on is null;

  update public.library_items
    set finished_on = null
    where status <> 'finished'
      and finished_on is not null;

  alter table public.library_items
    add constraint library_items_started_finished_order
    check (started_on is null or finished_on is null or finished_on >= started_on);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.library_items
    add constraint library_items_custom_page_count_positive
    check (custom_page_count is null or custom_page_count > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.library_items
    add constraint library_items_finished_date_matches_status
    check (
      (status = 'finished' and finished_on is not null)
      or (status <> 'finished' and finished_on is null)
    );
exception
  when duplicate_object then null;
end $$;

drop policy if exists "books authenticated update" on public.books;
drop policy if exists "books authenticated insert" on public.books;

create policy "books authenticated insert valid metadata"
  on public.books for insert
  to authenticated
  with check (
    provider in ('google', 'open-library', 'manual')
    and length(trim(provider_id)) > 0
    and length(trim(title)) between 1 and 300
  );

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.ensure_reading_log_library_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.library_items
    where id = new.library_item_id
      and user_id = new.user_id
  ) then
    raise exception 'reading log must belong to an owned library item';
  end if;

  return new;
end;
$$;

drop trigger if exists reading_logs_ensure_library_owner on public.reading_logs;
create trigger reading_logs_ensure_library_owner
  before insert or update on public.reading_logs
  for each row
  execute function private.ensure_reading_log_library_owner();

drop policy if exists "logs select own" on public.reading_logs;
drop policy if exists "logs insert own" on public.reading_logs;
drop policy if exists "logs update own" on public.reading_logs;
drop policy if exists "logs delete own" on public.reading_logs;

create policy "logs select own library item"
  on public.reading_logs for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.library_items
      where library_items.id = reading_logs.library_item_id
        and library_items.user_id = (select auth.uid())
    )
  );

create policy "logs insert own library item"
  on public.reading_logs for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.library_items
      where library_items.id = reading_logs.library_item_id
        and library_items.user_id = (select auth.uid())
    )
  );

create policy "logs update own library item"
  on public.reading_logs for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.library_items
      where library_items.id = reading_logs.library_item_id
        and library_items.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.library_items
      where library_items.id = reading_logs.library_item_id
        and library_items.user_id = (select auth.uid())
    )
  );

create policy "logs delete own library item"
  on public.reading_logs for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.library_items
      where library_items.id = reading_logs.library_item_id
        and library_items.user_id = (select auth.uid())
    )
  );

create index if not exists library_items_book_id_idx
  on public.library_items (book_id);

create index if not exists reading_logs_library_item_id_idx
  on public.reading_logs (library_item_id);
