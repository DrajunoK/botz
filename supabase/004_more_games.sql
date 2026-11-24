-- Curling, bowling and "Chasse aux boulons": allow their ids in the matches table.
-- Paste once into Supabase -> SQL Editor -> Run (before releasing the new games).
alter table public.matches drop constraint if exists matches_game_check;
alter table public.matches
  add constraint matches_game_check
  check (game in ('soccer', 'survivor', 'petanque', 'curling', 'bowling', 'boulons'));
