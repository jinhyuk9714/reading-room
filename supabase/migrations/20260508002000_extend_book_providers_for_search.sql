drop policy if exists "books authenticated insert valid metadata" on public.books;

create policy "books authenticated insert valid metadata"
  on public.books for insert
  to authenticated
  with check (
    provider in ('google', 'open-library', 'manual', 'kakao', 'naver')
    and length(trim(provider_id)) > 0
    and length(trim(title)) between 1 and 300
  );
