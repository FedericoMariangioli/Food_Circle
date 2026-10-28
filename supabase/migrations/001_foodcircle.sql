-- FoodCircle initial schema. Apply once to a new Supabase project.
-- Daily meals and nutritional summaries are separate rows and tables by design.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 30),
  display_name text not null default '',
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_lower_unique on public.profiles (lower(username));
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create table public.privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile_visibility text not null default 'private' check (profile_visibility in ('private','followers','public')),
  diary_visibility text not null default 'private' check (diary_visibility in ('private','followers','public')),
  nutrition_visibility text not null default 'private' check (nutrition_visibility in ('private','followers','public')),
  weight_visibility text not null default 'private' check (weight_visibility in ('private','followers','public')),
  progress_visibility text not null default 'private' check (progress_visibility in ('private','followers','public')),
  goals_visibility text not null default 'private' check (goals_visibility in ('private','followers','public')),
  recipes_visibility text not null default 'followers' check (recipes_visibility in ('private','followers','public')),
  community_visibility text not null default 'public' check (community_visibility in ('private','followers','public')),
  shared_progress_metrics text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger privacy_settings_set_updated_at before update on public.privacy_settings
for each row execute function public.set_updated_at();

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_status_idx on public.follows (following_id, status);

create or replace function public.guard_follow_update()
returns trigger language plpgsql as $$
begin
  if new.follower_id <> old.follower_id or new.following_id <> old.following_id then
    raise exception 'Follow participants are immutable';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'Accepted follows must be removed, not reassigned';
  end if;
  return new;
end;
$$;
create trigger follows_guard_update before update on public.follows
for each row execute function public.guard_follow_update();

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked_between(owner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = owner_id and b.blocked_id = auth.uid())
       or (b.blocker_id = auth.uid() and b.blocked_id = owner_id)
  );
$$;

create or replace function public.is_approved_follower(owner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid() and f.following_id = owner_id and f.status = 'accepted'
  ) and not public.is_blocked_between(owner_id);
$$;

create or replace function public.can_view_category(owner_id uuid, category text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare allowed_visibility text; viewer_id uuid := auth.uid();
begin
  if viewer_id is not null and viewer_id = owner_id then return true; end if;
  if owner_id is null or public.is_blocked_between(owner_id) then return false; end if;
  if category not in ('profile','diary','nutrition','weight','progress','goals','recipes','community') then return false; end if;

  select case category
    when 'profile' then profile_visibility
    when 'diary' then diary_visibility
    when 'nutrition' then nutrition_visibility
    when 'weight' then weight_visibility
    when 'progress' then progress_visibility
    when 'goals' then goals_visibility
    when 'recipes' then recipes_visibility
    when 'community' then community_visibility
  end into allowed_visibility
  from public.privacy_settings where user_id = owner_id;

  if allowed_visibility = 'public' then return true; end if;
  if allowed_visibility = 'followers' then return public.is_approved_follower(owner_id); end if;
  return false;
end;
$$;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  meal_type text not null check (meal_type in ('Colazione','Spuntino','Pranzo','Merenda','Cena','Altro')),
  eaten_at timestamptz not null,
  notes text check (char_length(coalesce(notes,'')) <= 500),
  visibility text not null default 'private' check (visibility in ('private','followers','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_owner_eaten_at_idx on public.meals (owner_id, eaten_at desc);
create trigger meals_set_updated_at before update on public.meals
for each row execute function public.set_updated_at();

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  food_item_id uuid,
  food_label text not null check (char_length(food_label) between 1 and 120),
  quantity numeric(10,2) check (quantity is null or quantity > 0),
  unit text check (char_length(coalesce(unit,'')) <= 30),
  ingredients text[] not null default '{}',
  recipe_id uuid,
  created_at timestamptz not null default now()
);
create index meal_entries_meal_idx on public.meal_entries (meal_id);

create or replace function public.check_meal_entry_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare meal_owner uuid;
begin
  select m.owner_id into meal_owner from public.meals m where m.id = new.meal_id;
  if meal_owner is null or meal_owner <> new.owner_id then
    raise exception 'Meal entry owner must match meal owner';
  end if;
  return new;
end;
$$;
create trigger meal_entries_check_owner before insert or update on public.meal_entries
for each row execute function public.check_meal_entry_owner();

-- Values are nullable and require a provenance label when provided. This table
-- is separate so a diary entry can be shared without its nutrition values.
create table public.meal_nutrients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  meal_id uuid not null unique references public.meals(id) on delete cascade,
  calories numeric(10,2) check (calories is null or calories >= 0),
  protein_g numeric(10,2) check (protein_g is null or protein_g >= 0),
  carbohydrates_g numeric(10,2) check (carbohydrates_g is null or carbohydrates_g >= 0),
  fat_g numeric(10,2) check (fat_g is null or fat_g >= 0),
  source_label text not null check (char_length(source_label) between 1 and 160),
  created_at timestamptz not null default now()
);
create index meal_nutrients_owner_idx on public.meal_nutrients (owner_id);

create or replace function public.check_meal_nutrient_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare meal_owner uuid;
begin
  select owner_id into meal_owner from public.meals where id = new.meal_id;
  if meal_owner is null or meal_owner <> new.owner_id then
    raise exception 'Nutrient owner must match meal owner';
  end if;
  return new;
end;
$$;
create trigger meal_nutrients_check_owner before insert or update on public.meal_nutrients
for each row execute function public.check_meal_nutrient_owner();

create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brand text,
  calories_per_100g numeric(10,2) check (calories_per_100g is null or calories_per_100g >= 0),
  protein_per_100g numeric(10,2) check (protein_per_100g is null or protein_per_100g >= 0),
  carbohydrates_per_100g numeric(10,2) check (carbohydrates_per_100g is null or carbohydrates_per_100g >= 0),
  fat_per_100g numeric(10,2) check (fat_per_100g is null or fat_per_100g >= 0),
  data_source text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  check ((calories_per_100g is null and protein_per_100g is null and carbohydrates_per_100g is null and fat_per_100g is null) or nullif(trim(data_source),'') is not null)
);
create index food_items_name_search_idx on public.food_items using gin (to_tsvector('simple', name));

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  visibility text not null default 'followers' check (visibility in ('private','followers','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index posts_feed_public_idx on public.posts (created_at desc) where visibility = 'public' and deleted_at is null;
create index posts_author_created_idx on public.posts (author_id, created_at desc) where deleted_at is null;
create trigger posts_set_updated_at before update on public.posts
for each row execute function public.set_updated_at();

create or replace function public.can_view_post(post_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare post_author uuid; post_visibility text; post_deleted timestamptz; viewer_id uuid := auth.uid();
begin
  select author_id, visibility, deleted_at into post_author, post_visibility, post_deleted
  from public.posts where id = post_id;
  if post_author is null or post_deleted is not null then return false; end if;
  if viewer_id is not null and viewer_id = post_author then return true; end if;
  if not public.can_view_category(post_author, 'community') then return false; end if;
  if public.is_blocked_between(post_author) then return false; end if;
  if post_visibility = 'public' then return true; end if;
  if post_visibility = 'followers' then return public.is_approved_follower(post_author); end if;
  return false;
end;
$$;

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  created_at timestamptz not null default now(),
  unique (post_id, storage_path)
);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_post_created_idx on public.comments (post_id, created_at) where deleted_at is null;

create table public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1200),
  instructions text not null default '' check (char_length(instructions) <= 10000),
  prep_minutes integer check (prep_minutes is null or prep_minutes between 1 and 1440),
  servings numeric(6,2) check (servings is null or servings > 0),
  image_path text,
  visibility text not null default 'private' check (visibility in ('private','followers','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_author_created_idx on public.recipes (author_id, created_at desc);
create index recipes_title_search_idx on public.recipes using gin (to_tsvector('simple', title));
alter table public.meal_entries add constraint meal_entries_food_item_fk
  foreign key (food_item_id) references public.food_items(id) on delete set null;
alter table public.meal_entries add constraint meal_entries_recipe_fk
  foreign key (recipe_id) references public.recipes(id) on delete set null;

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  quantity numeric(10,2) check (quantity is null or quantity >= 0),
  unit text check (char_length(coalesce(unit,'')) <= 30),
  position integer not null default 0
);
create index recipe_ingredients_recipe_position_idx on public.recipe_ingredients (recipe_id, position);

create table public.saved_recipes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table public.community_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique,
  description text not null default '' check (char_length(description) <= 500),
  rules text not null default '' check (char_length(rules) <= 1200),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now()
);

create or replace function public.group_is_public(target_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_groups g where g.id = target_group and g.visibility = 'public');
$$;

create table public.group_members (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator','admin')),
  status text not null default 'pending' check (status in ('pending','accepted')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create or replace function public.add_group_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role, status)
  values (new.id, new.owner_id, 'admin', 'accepted');
  return new;
end;
$$;
create trigger community_group_owner_member after insert on public.community_groups
for each row execute function public.add_group_owner();

create or replace function public.guard_group_membership_update()
returns trigger language plpgsql as $$
begin
  if new.group_id <> old.group_id or new.user_id <> old.user_id or new.role <> old.role then
    raise exception 'Group membership identity and role are immutable';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'Accepted membership must be removed, not reassigned';
  end if;
  return new;
end;
$$;
create trigger group_members_guard_update before update on public.group_members
for each row execute function public.guard_group_membership_update();

create or replace function public.is_group_manager(target_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group and gm.user_id = auth.uid()
      and gm.role in ('admin','moderator') and gm.status = 'accepted'
  );
$$;

create table public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now()
);
create index group_posts_feed_idx on public.group_posts (group_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('follow_request','follow_accepted','like','comment','group_invite','group_reply')),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','post','comment','group')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','abuse','dangerous_advice','privacy','other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_created_idx on public.reports (status, created_at);

create table public.admin_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('moderator','admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles(id) on delete restrict,
  report_id uuid references public.reports(id) on delete set null,
  action text not null check (action in ('warning','hide_content','remove_content','suspend_account','dismiss_report')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_username text;
begin
  requested_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_.]', '', 'g'));
  if char_length(requested_username) < 3 then
    requested_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, coalesce(new.raw_user_meta_data ->> 'display_name', requested_username));
  insert into public.privacy_settings (user_id) values (new.id);
  return new;
end;
$$;
create trigger auth_user_profile_created after insert on auth.users
for each row execute function public.create_user_profile();

alter table public.profiles enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.meals enable row level security;
alter table public.meal_entries enable row level security;
alter table public.meal_nutrients enable row level security;
alter table public.food_items enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.saved_recipes enable row level security;
alter table public.community_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_posts enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.admin_roles enable row level security;
alter table public.moderation_actions enable row level security;

create policy "profiles readable by owner or profile audience" on public.profiles
for select using (id = auth.uid() or public.can_view_category(id, 'profile'));
create policy "profiles insert own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "privacy settings own only" on public.privacy_settings
for select using (user_id = auth.uid());
create policy "privacy settings insert own" on public.privacy_settings
for insert with check (user_id = auth.uid());
create policy "privacy settings update own" on public.privacy_settings
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "follow edges visible to participants" on public.follows
for select using (follower_id = auth.uid() or following_id = auth.uid());
create policy "send follow request" on public.follows
for insert with check (follower_id = auth.uid() and status = 'pending' and not public.is_blocked_between(following_id));
create policy "target can accept request" on public.follows
for update using (following_id = auth.uid()) with check (following_id = auth.uid());
create policy "participants can remove follow" on public.follows
for delete using (follower_id = auth.uid() or following_id = auth.uid());

create policy "blocks owner can read" on public.blocks for select using (blocker_id = auth.uid());
create policy "block own" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "unblock own" on public.blocks for delete using (blocker_id = auth.uid());

create policy "meal owner or explicit diary audience" on public.meals
for select using (
  owner_id = auth.uid() or (
    public.can_view_category(owner_id, 'diary') and (
      visibility = 'public' or (visibility = 'followers' and public.is_approved_follower(owner_id))
    )
  )
);
create policy "create own private meal" on public.meals
for insert with check (owner_id = auth.uid() and visibility = 'private');
create policy "update own meal" on public.meals for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own meal" on public.meals for delete using (owner_id = auth.uid());

create policy "meal entries follow parent diary visibility" on public.meal_entries
for select using (
  owner_id = auth.uid() or exists (
    select 1 from public.meals m
    where m.id = meal_id and public.can_view_category(m.owner_id, 'diary')
      and (m.visibility = 'public' or (m.visibility = 'followers' and public.is_approved_follower(m.owner_id)))
  )
);
create policy "insert own meal entry" on public.meal_entries
for insert with check (owner_id = auth.uid() and exists (select 1 from public.meals m where m.id = meal_id and m.owner_id = auth.uid()));
create policy "update own meal entry" on public.meal_entries
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own meal entry" on public.meal_entries
for delete using (owner_id = auth.uid());

create policy "nutrients owner or explicit nutrition audience" on public.meal_nutrients
for select using (owner_id = auth.uid() or public.can_view_category(owner_id, 'nutrition'));
create policy "insert own nutrient values with provenance" on public.meal_nutrients
for insert with check (owner_id = auth.uid() and exists (select 1 from public.meals m where m.id = meal_id and m.owner_id = auth.uid()));
create policy "update own nutrient values" on public.meal_nutrients
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own nutrient values" on public.meal_nutrients
for delete using (owner_id = auth.uid());

create policy "food catalog owner or public" on public.food_items
for select using (is_public or owner_id = auth.uid());
create policy "create own food" on public.food_items for insert with check (owner_id = auth.uid() and not is_public);
create policy "update own food" on public.food_items for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and not is_public);
create policy "delete own food" on public.food_items for delete using (owner_id = auth.uid());

create policy "post visible to its audience" on public.posts for select using (public.can_view_post(id));
create policy "author creates own post" on public.posts for insert with check (author_id = auth.uid());
create policy "author updates own post" on public.posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "author removes own post" on public.posts for delete using (author_id = auth.uid());

create policy "post media audience" on public.post_media
for select using (owner_id = auth.uid() or public.can_view_post(post_id));
create policy "author adds media to own post" on public.post_media
for insert with check (owner_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "author removes media" on public.post_media
for delete using (owner_id = auth.uid());

create policy "likes visible with post" on public.post_likes
for select using (public.can_view_post(post_id));
create policy "like as self" on public.post_likes
for insert with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy "remove own like" on public.post_likes
for delete using (user_id = auth.uid());

create policy "comments visible with post" on public.comments
for select using (deleted_at is null and public.can_view_post(post_id));
create policy "comment on accessible post" on public.comments
for insert with check (author_id = auth.uid() and public.can_view_post(post_id));
create policy "author edits own comment" on public.comments
for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "author removes own comment" on public.comments
for delete using (author_id = auth.uid());

create policy "saved post list own" on public.saved_posts for select using (user_id = auth.uid());
create policy "save accessible post" on public.saved_posts for insert with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy "unsave own post" on public.saved_posts for delete using (user_id = auth.uid());

create policy "recipe visible to its audience" on public.recipes
for select using (author_id = auth.uid() or public.can_view_category(author_id, 'recipes'));
create policy "author creates recipe" on public.recipes for insert with check (author_id = auth.uid());
create policy "author updates recipe" on public.recipes for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "author deletes recipe" on public.recipes for delete using (author_id = auth.uid());
create policy "recipe ingredients visible with recipe" on public.recipe_ingredients
for select using (exists (select 1 from public.recipes r where r.id = recipe_id and (r.author_id = auth.uid() or public.can_view_category(r.author_id, 'recipes'))));
create policy "recipe owner manages ingredients" on public.recipe_ingredients
for all using (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = auth.uid()))
with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = auth.uid()));
create policy "saved recipe list own" on public.saved_recipes for select using (user_id = auth.uid());
create policy "save accessible recipe" on public.saved_recipes
for insert with check (user_id = auth.uid() and exists (select 1 from public.recipes r where r.id = recipe_id and (r.author_id = auth.uid() or public.can_view_category(r.author_id, 'recipes'))));
create policy "unsave own recipe" on public.saved_recipes for delete using (user_id = auth.uid());

create policy "public groups or member groups" on public.community_groups
for select using (visibility = 'public' or owner_id = auth.uid() or exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = auth.uid() and gm.status = 'accepted'));
create policy "create own group" on public.community_groups for insert with check (owner_id = auth.uid());
create policy "group owner updates" on public.community_groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "group owner deletes" on public.community_groups for delete using (owner_id = auth.uid());
create policy "membership visible to self or group managers" on public.group_members
for select using (user_id = auth.uid() or public.is_group_manager(public.group_members.group_id));
create policy "request own membership" on public.group_members
for insert with check (
  user_id = auth.uid() and role = 'member' and (
    (public.group_is_public(public.group_members.group_id) and status = 'accepted') or
    (not public.group_is_public(public.group_members.group_id) and status = 'pending')
  )
);
create policy "managers approve member" on public.group_members
for update using (public.is_group_manager(public.group_members.group_id))
with check (public.is_group_manager(public.group_members.group_id));
create policy "leave own group" on public.group_members for delete using (user_id = auth.uid());
create policy "group posts visible to members" on public.group_posts
for select using (exists (select 1 from public.community_groups g where g.id = group_id and (g.visibility = 'public' or exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid() and gm.status = 'accepted'))));
create policy "members post in group" on public.group_posts
for insert with check (author_id = auth.uid() and exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'accepted'));
create policy "authors remove group post" on public.group_posts for delete using (author_id = auth.uid());

create policy "notification recipient reads" on public.notifications for select using (recipient_id = auth.uid());
create policy "notification recipient updates read state" on public.notifications
for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "reporter creates report" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reporter reads own report" on public.reports for select using (reporter_id = auth.uid());
create policy "moderators read reports" on public.reports
for select using (exists (select 1 from public.admin_roles ar where ar.user_id = auth.uid() and ar.role in ('moderator','admin')));
create policy "admin role visible to self" on public.admin_roles for select using (user_id = auth.uid());
create policy "admin actions restricted" on public.moderation_actions
for all using (exists (select 1 from public.admin_roles ar where ar.user_id = auth.uid() and ar.role in ('moderator','admin')))
with check (moderator_id = auth.uid() and exists (select 1 from public.admin_roles ar where ar.user_id = auth.uid() and ar.role in ('moderator','admin')));

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.post_media, public.post_likes, public.comments,
  public.recipes, public.recipe_ingredients, public.food_items, public.community_groups, public.group_posts to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.can_view_category(uuid, text) to anon, authenticated;
grant execute on function public.can_view_post(uuid) to anon, authenticated;
grant execute on function public.is_approved_follower(uuid) to anon, authenticated;
grant execute on function public.is_blocked_between(uuid) to anon, authenticated;
grant execute on function public.is_group_manager(uuid) to anon, authenticated;
grant execute on function public.group_is_public(uuid) to anon, authenticated;

