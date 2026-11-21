-- =====================================================================
-- Typhoon — dispatch testi (Supabase SQL Editor'da ishga tushiriladi)
--
-- OLDIN: quyidagi 3 ta so'zni Authentication bo'limida yaratgan
-- foydalanuvchilaringizning ID'lari bilan almashtiring (Ctrl+H):
--   MIJOZ_ID       -> mijoz
--   HAYDOVCHI1_ID  -> 1-haydovchi (mijozdan ~100 m)
--   HAYDOVCHI2_ID  -> 2-haydovchi (mijozdan ~2 km)
-- =====================================================================

-- 1) Ikki haydovchini tasdiqlangan va online qilamiz (Qorako'l koordinatalari)
update public.profiles set role = 'driver'
 where id in ('HAYDOVCHI1_ID', 'HAYDOVCHI2_ID');

insert into public.drivers (id, status, is_online, car_model, plate_number, location, location_updated_at)
values
  ('HAYDOVCHI1_ID', 'approved', true, 'Cobalt', '80 A 111 AA',
   st_setsrid(st_makepoint(63.84876, 39.52560), 4326)::geography, now()),
  ('HAYDOVCHI2_ID', 'approved', true, 'Nexia 3', '80 B 222 BB',
   st_setsrid(st_makepoint(63.87090, 39.52560), 4326)::geography, now())
on conflict (id) do update
  set status = 'approved', is_online = true, is_busy = false,
      location = excluded.location, location_updated_at = now();

-- 2) Mijoz buyurtma beradi -> trigger avtomatik eng yaqin haydovchiga taklif yuboradi
insert into public.rides (customer_id, pickup, pickup_address)
values ('MIJOZ_ID',
        st_setsrid(st_makepoint(63.84760, 39.52560), 4326)::geography,
        'Test: Toshkent ko''cha');

-- 3) 1-haydovchi nomidan rad etamiz
select set_config('request.jwt.claims', '{"sub":"HAYDOVCHI1_ID","role":"authenticated"}', false);
select public.respond_to_offer(
  (select id from public.ride_offers where driver_id = 'HAYDOVCHI1_ID' and status = 'pending'),
  false
) as haydovchi1_javobi;

-- 4) 2-haydovchi nomidan qabul qilamiz
select set_config('request.jwt.claims', '{"sub":"HAYDOVCHI2_ID","role":"authenticated"}', false);
select public.respond_to_offer(
  (select id from public.ride_offers where driver_id = 'HAYDOVCHI2_ID' and status = 'pending'),
  true
) as haydovchi2_javobi;

-- 5) NATIJA: takliflar tarixi
--    Kutilgan: HAYDOVCHI1 = rejected (~100 m), HAYDOVCHI2 = accepted (~1900 m)
select o.driver_id, o.status, o.distance_m, r.status as buyurtma_holati
  from public.ride_offers o
  join public.rides r on r.id = o.ride_id
 order by o.id desc
 limit 5;
