-- =====================================================================
-- Typhoon — 001: asosiy ma'lumotlar bazasi sxemasi (Qorako'l Taxi MVP)
-- Supabase SQL Editor'da bir marta ishga tushiriladi.
-- =====================================================================

-- PostGIS: "eng yaqin haydovchi" kabi geografik so'rovlar uchun
create extension if not exists postgis;

-- ---------------------------------------------------------------------
-- 1. Holatlar (enum)
-- ---------------------------------------------------------------------
create type user_role     as enum ('customer', 'driver', 'admin');
create type driver_status as enum ('pending', 'approved', 'blocked');
create type ride_status   as enum (
  'searching',    -- haydovchi qidirilmoqda
  'accepted',     -- haydovchi qabul qildi, mijozga kelmoqda
  'arrived',      -- haydovchi yetib keldi
  'in_progress',  -- safar davom etmoqda
  'completed',    -- safar tugadi
  'cancelled',    -- bekor qilindi
  'no_driver'     -- hech kim topilmadi
);
create type offer_status  as enum ('pending', 'accepted', 'rejected', 'expired');

-- ---------------------------------------------------------------------
-- 2. Jadvallar
-- ---------------------------------------------------------------------

-- Har bir foydalanuvchi (mijoz, haydovchi, admin)
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        user_role   not null default 'customer',
  full_name   text,
  phone       text unique,
  created_at  timestamptz not null default now()
);

-- Haydovchi ma'lumotlari va jonli joylashuvi
create table public.drivers (
  id                   uuid primary key references public.profiles (id) on delete cascade,
  status               driver_status not null default 'pending',
  is_online            boolean       not null default false,
  is_busy              boolean       not null default false,
  car_model            text,
  car_color            text,
  plate_number         text,
  location             geography(Point, 4326),
  location_updated_at  timestamptz,
  rating               numeric(2, 1) not null default 5.0,
  created_at           timestamptz   not null default now()
);
create index drivers_location_idx on public.drivers using gist (location);

-- Buyurtmalar (safarlar)
create table public.rides (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.profiles (id),
  driver_id            uuid references public.drivers (id),
  status               ride_status not null default 'searching',
  pickup               geography(Point, 4326) not null,
  pickup_address       text,
  destination          geography(Point, 4326),
  destination_address  text,
  price_uzs            integer,                       -- so'mda
  search_radius_m      integer not null default 3000, -- 3 km dan boshlanadi
  cancel_reason        text,
  created_at           timestamptz not null default now(),
  accepted_at          timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz
);
create index rides_status_idx on public.rides (status);
create index rides_customer_idx on public.rides (customer_id, created_at desc);

-- Dispatch tarixi: qaysi haydovchiga qachon taklif yuborildi va nima javob berdi.
-- Kelajakda AI dispatcher shu ma'lumotdan o'rganadi.
create table public.ride_offers (
  id            bigserial primary key,
  ride_id       uuid not null references public.rides (id) on delete cascade,
  driver_id     uuid not null references public.drivers (id),
  status        offer_status not null default 'pending',
  distance_m    integer,
  offered_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  responded_at  timestamptz,
  unique (ride_id, driver_id)
);
create index ride_offers_driver_idx on public.ride_offers (driver_id, status);

-- ---------------------------------------------------------------------
-- 3. Yangi foydalanuvchi ro'yxatdan o'tganda profil avtomatik yaratiladi
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. Dispatch yordamchisi: buyurtmaga eng yaqin bo'sh haydovchilar
--    - faqat tasdiqlangan, online va band bo'lmagan haydovchilar
--    - joylashuvi oxirgi 2 daqiqada yangilangan bo'lishi kerak
--    - shu buyurtmaga avval taklif olganlar qayta olinmaydi
-- ---------------------------------------------------------------------
create or replace function public.nearest_available_drivers(
  p_ride_id  uuid,
  p_radius_m integer,
  p_limit    integer default 5
)
returns table (driver_id uuid, distance_m double precision)
language sql
stable
as $$
  select d.id, st_distance(d.location, r.pickup)
  from public.drivers d
  join public.rides r on r.id = p_ride_id
  where d.status = 'approved'
    and d.is_online
    and not d.is_busy
    and d.location is not null
    and d.location_updated_at > now() - interval '2 minutes'
    and st_dwithin(d.location, r.pickup, p_radius_m)
    and not exists (
      select 1 from public.ride_offers o
      where o.ride_id = r.id and o.driver_id = d.id
    )
  order by d.location <-> r.pickup
  limit p_limit;
$$;

-- ---------------------------------------------------------------------
-- 5. Xavfsizlik: Row Level Security (har kim faqat o'z ma'lumotini ko'radi)
--    Dispatch Edge Function service_role kaliti bilan ishlaydi va RLS'dan o'tadi.
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.drivers     enable row level security;
alter table public.rides       enable row level security;
alter table public.ride_offers enable row level security;

-- profiles: o'z profilini ko'radi va ismini o'zgartiradi (rolini emas)
create policy "profiles: o'zini ko'radi" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: o'zini yangilaydi" on public.profiles
  for update using (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- drivers: haydovchi o'z qatorini ko'radi; faqat online holati va joylashuvini o'zgartiradi.
-- status (approved/blocked) ni faqat admin o'zgartiradi.
create policy "drivers: o'zini ko'radi" on public.drivers
  for select using (id = auth.uid());
create policy "drivers: o'zini yangilaydi" on public.drivers
  for update using (id = auth.uid());
revoke update on public.drivers from authenticated;
grant update (is_online, location, location_updated_at) on public.drivers to authenticated;

-- mijoz o'z safaridagi haydovchini (mashina, raqam) ko'ra oladi
create policy "drivers: mijoz o'z haydovchisini ko'radi" on public.drivers
  for select using (
    exists (
      select 1 from public.rides r
      where r.driver_id = drivers.id and r.customer_id = auth.uid()
    )
  );

-- rides: mijoz o'zi uchun buyurtma yaratadi; mijoz va haydovchi o'z safarini ko'radi
create policy "rides: mijoz yaratadi" on public.rides
  for insert with check (customer_id = auth.uid() and status = 'searching');
create policy "rides: ishtirokchilar ko'radi" on public.rides
  for select using (customer_id = auth.uid() or driver_id = auth.uid());

-- ride_offers: haydovchi faqat o'ziga kelgan takliflarni ko'radi
create policy "offers: haydovchi o'zinikini ko'radi" on public.ride_offers
  for select using (driver_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. Realtime: ilovalar o'zgarishlarni darhol ko'rishi uchun
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.ride_offers;
alter publication supabase_realtime add table public.drivers;
