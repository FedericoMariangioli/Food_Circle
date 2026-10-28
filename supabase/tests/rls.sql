-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'fc-owner@example.test', '', '{}', '{"username":"fc_owner"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'fc-viewer@example.test', '', '{}', '{"username":"fc_viewer"}', now(), now());

insert into public.meals (id, owner_id, title, meal_type, eaten_at, visibility)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'RLS fixture', 'Pranzo', now(), 'private');
insert into public.meal_entries (id, meal_id, owner_id, food_label, quantity, unit)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'RLS fixture', 100, 'g');
insert into public.meal_nutrients (id, owner_id, meal_id, calories, protein_g, source_label)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 100, 5, 'Test fixture');
insert into public.posts (id, author_id, body, visibility)
values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'RLS fixture post', 'public');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.meals where id = '20000000-0000-4000-8000-000000000001'), 1, 'owner reads a private meal');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.meals where id = '20000000-0000-4000-8000-000000000001'), 0, 'other user cannot read private meal');
select is((select count(*)::integer from public.meal_nutrients where id = '40000000-0000-4000-8000-000000000001'), 0, 'other user cannot read private nutrient values');

reset role;
update public.privacy_settings set diary_visibility = 'public' where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.meals where id = '20000000-0000-4000-8000-000000000001'), 0, 'category permission does not expose a meal still marked private');

reset role;
update public.meals set visibility = 'public' where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.meal_entries where id = '30000000-0000-4000-8000-000000000001'), 1, 'meal details require both category and entry sharing');
select is((select count(*)::integer from public.meal_nutrients where id = '40000000-0000-4000-8000-000000000001'), 0, 'sharing diary details does not share nutrition values');

reset role;
update public.privacy_settings set nutrition_visibility = 'public' where user_id = '10000000-0000-4000-8000-000000000001';
insert into public.blocks (blocker_id, blocked_id)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.meal_nutrients where id = '40000000-0000-4000-8000-000000000001'), 0, 'blocked user cannot read explicitly shared nutrition values');
select is((select count(*)::integer from public.posts where id = '50000000-0000-4000-8000-000000000001'), 0, 'blocked user cannot read a public post');

select * from finish();
rollback;
