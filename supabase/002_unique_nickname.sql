-- Unique nicknames (case-insensitive). Paste once into Supabase -> SQL Editor -> Run.

-- Rename any existing duplicate (the older profile keeps the name).
update public.profiles p
set nickname = left(p.nickname, 16) || '_' || substr(p.friend_code, 1, 3)
where exists (
  select 1 from public.profiles q
  where lower(q.nickname) = lower(p.nickname)
    and (q.created_at, q.id) < (p.created_at, p.id)
);

create unique index profiles_nickname_unique on public.profiles (lower(nickname));

-- The random default nickname must not collide with a chosen one.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nick text;
begin
  loop
    nick := 'Joueur' || floor(1000 + random() * 9000)::int;
    exit when not exists (select 1 from public.profiles where lower(nickname) = lower(nick));
  end loop;
  insert into public.profiles (id, nickname, friend_code)
  values (new.id, nick, public.make_friend_code());
  return new;
end $$;
