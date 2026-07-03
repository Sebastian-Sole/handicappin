alter table public.course
  add column if not exists "source" text not null default 'user';
