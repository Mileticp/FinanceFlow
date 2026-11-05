-- Additive FinanceFlow v2. Never copies, updates or deletes existing user records.
-- Apply only after review. Existing food_logs, weight_logs and finance tables remain intact.
begin;
create table public.nutrition_foods (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
name text not null check(length(trim(name)) between 1 and 200), brand text,
 basis_quantity numeric not null check(basis_quantity>0), basis_unit text not null check(basis_unit in ('g','ml','serving')),
 calories numeric check(calories between 0 and 100000), protein_g numeric check(protein_g between 0 and 10000),
 carbs_g numeric check(carbs_g>=0), fat_g numeric check(fat_g>=0), fiber_g numeric check(fiber_g>=0),
 calories_low numeric check(calories_low>=0), calories_high numeric check(calories_high>=0),
 protein_low numeric check(protein_low>=0), protein_high numeric check(protein_high>=0),
 price_eur numeric check(price_eur>=0), price_quantity numeric check(price_quantity>0), price_unit text check(price_unit in ('g','ml','serving')),
 availability text not null default 'unknown' check(availability in ('unknown','reported_available','purchased','considered','rejected')),
 favorite boolean not null default false,
 check(calories_low<=calories_high), check(protein_low<=protein_high),
 check(calories_low is null or calories is null or calories_low<=calories),
 check(calories_high is null or calories is null or calories_high>=calories),
 check(protein_low is null or protein_g is null or protein_low<=protein_g),
 check(protein_high is null or protein_g is null or protein_high>=protein_g)
);
create table public.nutrition_recipes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
name text not null check(length(trim(name)) between 1 and 200),
 servings numeric not null default 1 check(servings>0)
);
create table public.nutrition_ingredients (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
recipe_id uuid not null, food_id uuid,
 ingredient_name text not null,
 quantity numeric check(quantity>0), unit text check(unit in ('g','ml','serving')),
 foreign key(user_id,recipe_id) references public.nutrition_recipes(user_id,id) on delete cascade,
 foreign key(user_id,food_id) references public.nutrition_foods(user_id,id)
);
create table public.nutrition_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
logged_on date not null, logged_time time,
 meal text not null default 'Other' check(meal in ('Breakfast','Lunch','Dinner','Snack','Other')),
 name text not null check(length(trim(name)) between 1 and 200), food_id uuid, recipe_id uuid,
 quantity numeric check(quantity>0), unit text check(unit in ('g','ml','serving')),
 calories numeric check(calories between 0 and 100000), protein_g numeric check(protein_g between 0 and 10000),
 carbs_g numeric check(carbs_g>=0), fat_g numeric check(fat_g>=0), fiber_g numeric check(fiber_g>=0),
 calories_low numeric check(calories_low>=0), calories_high numeric check(calories_high>=0),
 protein_low numeric check(protein_low>=0), protein_high numeric check(protein_high>=0),
 deleted_at timestamptz,
 foreign key(user_id,food_id) references public.nutrition_foods(user_id,id),
 foreign key(user_id,recipe_id) references public.nutrition_recipes(user_id,id),
 check(calories_low<=calories_high), check(protein_low<=protein_high),
 check(calories_low is null or calories is null or calories_low<=calories),
 check(calories_high is null or calories is null or calories_high>=calories),
 check(protein_low is null or protein_g is null or protein_low<=protein_g),
 check(protein_high is null or protein_g is null or protein_high>=protein_g)
);
create table public.nutrition_days (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
logged_on date not null, status text not null default 'partial' check(status in ('partial','complete','unlogged')),
 unique(user_id,logged_on)
);
create table public.nutrition_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
sex text, height_cm numeric check(height_cm>0),
 starting_weight_kg numeric check(starting_weight_kg>0 and starting_weight_kg<500),
 recent_reference_kg numeric check(recent_reference_kg>0 and recent_reference_kg<500),
 unique(user_id)
);
create table public.nutrition_goals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
protein_g numeric check(protein_g>0), calorie_goal numeric check(calorie_goal>0),
 weight_min_kg numeric check(weight_min_kg>0), weight_max_kg numeric check(weight_max_kg>0), milestone_kg numeric check(milestone_kg>0),
 walking_km numeric check(walking_km>=0), maintenance_low numeric check(maintenance_low>0), maintenance_high numeric check(maintenance_high>0),
 net_pay_percent numeric check(net_pay_percent between 0 and 100),
 check(weight_min_kg<=weight_max_kg),check(maintenance_low<=maintenance_high),unique(user_id)
);
create table public.nutrition_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
kind text not null, logged_on date,
 reported_calories numeric, reported_protein_g numeric
);
create table public.nutrition_activity (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_key text,
 source text not null default 'user_entered',
 confidence text not null default 'unverified',
 notes text not null default '',
 evidence jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,import_key),
logged_on date not null, kind text not null,
 distance_km numeric check(distance_km>=0), duration_minutes numeric check(duration_minutes>=0),
 measured_kcal numeric check(measured_kcal>=0)
);

do $policies$
declare t text;
begin
 foreach t in array array['nutrition_foods','nutrition_recipes','nutrition_ingredients','nutrition_entries','nutrition_days','nutrition_profiles','nutrition_goals','nutrition_history','nutrition_activity'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
  execute format('revoke all on public.%I from public,anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $policies$;
create index nutrition_entries_user_day on public.nutrition_entries(user_id,logged_on,id);
create index nutrition_ingredients_user_recipe on public.nutrition_ingredients(user_id,recipe_id);
create index nutrition_ingredients_user_food on public.nutrition_ingredients(user_id,food_id);
create index nutrition_entries_user_food on public.nutrition_entries(user_id,food_id);
create index nutrition_entries_user_recipe on public.nutrition_entries(user_id,recipe_id);
create index nutrition_activity_user_day on public.nutrition_activity(user_id,logged_on);
create index nutrition_history_user_day on public.nutrition_history(user_id,logged_on);
-- Atomic recipe creation: caller ownership, RLS and composite FKs all apply.
create function public.nutrition_create_recipe(recipe jsonb, ingredients jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $recipe$
declare rid uuid; owner_id uuid := auth.uid(); item jsonb;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if ingredients is null or jsonb_typeof(ingredients) is distinct from 'array' or jsonb_array_length(ingredients) = 0 then
  raise exception 'Recipe needs ingredients';
 end if;
 insert into public.nutrition_recipes(user_id,name,servings,notes,source,confidence)
 values(owner_id,recipe->>'name',(recipe->>'servings')::numeric,coalesce(recipe->>'notes',''),'User recipe','user_entered') returning id into rid;
 for item in select value from jsonb_array_elements(ingredients) loop
  insert into public.nutrition_ingredients(user_id,recipe_id,food_id,ingredient_name,quantity,unit,source,confidence)
  values(owner_id,rid,(item->>'food_id')::uuid,item->>'ingredient_name',(item->>'quantity')::numeric,item->>'unit','User recipe','user_entered');
 end loop;
 return rid;
end $recipe$;
revoke all on function public.nutrition_create_recipe(jsonb,jsonb) from public,anon;
grant execute on function public.nutrition_create_recipe(jsonb,jsonb) to authenticated;
commit;
