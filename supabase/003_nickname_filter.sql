-- Nickname profanity filter, enforced by the database (a modified app cannot skip it).
-- Paste once into Supabase -> SQL Editor -> Run. Add words later with:
--   insert into public.banned_words (word) values ('motinterdit');           -- blocked anywhere in a nickname
--   insert into public.banned_words (word, whole_only) values ('mot', true);  -- blocked only as a whole word
-- Words are lowercase, without accents.

create table public.banned_words (
  word text primary key check (word = lower(word) and word ~ '^[a-z]+$'),
  -- Short words ("pute", "cul") would also hit innocent names ("computer", "calcul"):
  -- those only count when they are the whole nickname or a whole word of it.
  whole_only boolean not null default false
);
alter table public.banned_words enable row level security; -- no policy: invisible to the app
revoke all on public.banned_words from anon, authenticated;

insert into public.banned_words (word, whole_only) values
  -- anywhere in the nickname
  ('putain', false), ('salope', false), ('connard', false), ('connasse', false), ('encule', false),
  ('merde', false), ('couille', false), ('niquer', false), ('batard', false), ('salaud', false),
  ('foutre', false), ('bordel', false), ('branleur', false), ('enfoire', false), ('trouduc', false),
  ('tarlouze', false), ('bougnoule', false), ('youpin', false), ('nazi', false), ('hitler', false),
  ('fuck', false), ('shit', false), ('bitch', false), ('asshole', false),
  ('nigger', false), ('nigga', false), ('faggot', false), ('whore', false), ('pussy', false),
  -- whole nickname or whole word only
  ('pute', true), ('bite', true), ('cul', true), ('con', true), ('nique', true), ('chier', true),
  ('pd', true), ('pede', true), ('fdp', true), ('ntm', true), ('negre', true), ('ducon', true),
  ('dick', true), ('cunt', true), ('cock', true), ('slut', true), ('rape', true);

-- "fuuuck" and "fuuck" are the same word.
create function public.collapse_letters(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(t, '(.)\1+', '\1', 'g')
$$;

-- Lowercases, drops accents, undoes simple leetspeak (0->o 1->i 3->e 4->a 5->s 7->t @->a $->s)
-- and ignores separators, so "F.u.c.k" and "m3rd3" are caught.
create function public.is_nickname_allowed(nick text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  norm text := translate(
    translate(lower(nick), 'àâäáãçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy'),
    '013457@$', 'oieastas');
  joined text := public.collapse_letters(regexp_replace(norm, '[^a-z]', '', 'g'));
  tokens text[] := regexp_split_to_array(norm, '[^a-z]+');
begin
  return not exists (
    select 1 from public.banned_words b
    where (not b.whole_only and joined like '%' || public.collapse_letters(b.word) || '%')
       or (b.whole_only and (
             joined = public.collapse_letters(b.word)
             or exists (select 1 from unnest(tokens) t where public.collapse_letters(t) = public.collapse_letters(b.word))))
  );
end $$;

create function public.check_nickname() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_nickname_allowed(new.nickname) then
    raise exception 'nickname not allowed';
  end if;
  return new;
end $$;

-- Only when a player picks a nickname: the random default one is not checked.
create trigger profiles_check_nickname
  before update of nickname on public.profiles
  for each row execute function public.check_nickname();

revoke execute on function public.is_nickname_allowed(text), public.check_nickname(), public.collapse_letters(text)
  from public, anon;
grant execute on function public.is_nickname_allowed(text), public.collapse_letters(text) to authenticated;
