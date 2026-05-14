alter table public.reading_logs
  add column if not exists quote text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists mood text;

do $$
begin
  alter table public.reading_logs
    add constraint reading_logs_quote_length check (
      quote is null or length(quote) <= 1000
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.reading_logs
    add constraint reading_logs_mood_not_empty check (
      mood is null or length(trim(mood)) > 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.reading_logs
    add constraint reading_logs_tags_not_empty check (
      array_position(tags, '') is null
    );
exception
  when duplicate_object then null;
end $$;

alter table public.reader_preferences
  add column if not exists daily_page_goal integer not null default 20,
  add column if not exists weekly_session_goal integer not null default 4,
  add column if not exists default_log_mode text not null default 'page';

do $$
begin
  alter table public.reader_preferences
    add constraint reader_preferences_daily_page_goal_positive check (
      daily_page_goal > 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.reader_preferences
    add constraint reader_preferences_weekly_session_goal_positive check (
      weekly_session_goal > 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.reader_preferences
    add constraint reader_preferences_default_log_mode_allowed check (
      default_log_mode in ('page', 'percent')
    );
exception
  when duplicate_object then null;
end $$;

revoke all on public.reading_logs from public;
revoke all on public.reader_preferences from public;
revoke all on public.reading_logs from anon;
revoke all on public.reader_preferences from anon;

grant select, insert, update, delete on public.reading_logs to authenticated;
grant select, insert, update, delete on public.reader_preferences to authenticated;
