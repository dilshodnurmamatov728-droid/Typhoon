-- =====================================================================
-- Typhoon — 003: ilovalar uchun qulayliklar (001 va 002 dan keyin)
-- =====================================================================

-- 1) Koordinatalarni oddiy son ko'rinishida ham saqlaymiz.
--    Ilovalar va Realtime PostGIS formatini o'qiy olmaydi, lat/lng esa oson.
alter table public.drivers
  add column location_lat double precision
    generated always as (st_y(location::geometry)) stored,
  add column location_lng double precision
    generated always as (st_x(location::geometry)) stored;

alter table public.rides
  add column pickup_lat double precision
    generated always as (st_y(pickup::geometry)) stored,
  add column pickup_lng double precision
    generated always as (st_x(pickup::geometry)) stored,
  add column pickup_note text;   -- mijoz izohi: "ko'k darvoza oldida"

-- 2) Haydovchi o'ziga taklif kelgan buyurtmani ko'ra olishi kerak
--    (qabul qilishdan oldin manzil va izohni ko'rish uchun)
create policy "rides: taklif olgan haydovchi ko'radi" on public.rides
  for select using (
    exists (
      select 1 from public.ride_offers o
      where o.ride_id = rides.id and o.driver_id = auth.uid()
    )
  );

-- 3) Mijoz o'z ismi va telefonini kiritadi (pilotda SMS yo'q)
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- 4) Mijoz o'z buyurtmasidagi haydovchining ismi va telefonini ko'radi
create policy "profiles: mijoz o'z haydovchisini ko'radi" on public.profiles
  for select using (
    exists (
      select 1 from public.rides r
      where r.driver_id = profiles.id and r.customer_id = auth.uid()
    )
  );

-- 5) Haydovchi o'z buyurtmasidagi mijozning ismi va telefonini ko'radi
create policy "profiles: haydovchi o'z mijozini ko'radi" on public.profiles
  for select using (
    exists (
      select 1 from public.rides r
      where r.customer_id = profiles.id and r.driver_id = auth.uid()
    )
  );
