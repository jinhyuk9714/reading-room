create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.ensure_reading_log_library_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
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

revoke all on function private.ensure_reading_log_library_owner() from public;
revoke all on function private.ensure_reading_log_library_owner() from anon;
revoke all on function private.ensure_reading_log_library_owner() from authenticated;

drop policy if exists "books authenticated insert valid metadata" on public.books;

create policy "books authenticated insert valid metadata"
  on public.books for insert
  to authenticated
  with check (
    provider in ('google', 'manual', 'kakao', 'naver')
    and length(trim(provider_id)) > 0
    and length(trim(title)) between 1 and 300
  );

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.books to authenticated;
grant select, insert, update, delete on public.library_items to authenticated;
grant select, insert, update, delete on public.reading_logs to authenticated;
