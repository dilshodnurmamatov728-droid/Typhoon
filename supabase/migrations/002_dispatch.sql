-- =====================================================================
-- Typhoon — 002: Dispatch v1 (buyurtmani eng yaqin haydovchiga berish)
-- 001_init.sql dan keyin Supabase SQL Editor'da ishga tushiriladi.
--
-- Oqim:
--   mijoz buyurtma yaratadi -> trigger dispatch_next_offer() ni chaqiradi
--   -> eng yaqin bo'sh haydovchiga 15 soniyalik taklif
--   -> haydovchi respond_to_offer() bilan qabul/rad etadi
--   -> rad etsa yoki 15 s o'tsa -> keyingi haydovchi
--   -> 3 km da hech kim qolmasa 6 km, u yerda ham yo'q bo'lsa 'no_driver'
-- =====================================================================

-- Sozlamalar (bir joyda, keyin oson o'zgartirish uchun)
create or replace function public.dispatch_offer_seconds() returns integer
language sql immutable as $$ select 15 $$;
create or replace function public.dispatch_max_radius_m() returns integer
language sql immutable as $$ select 6000 $$;

-- ---------------------------------------------------------------------
-- 1. Eng yaqin haydovchilar (001 dagi versiyani yangilaydi):
--    endi boshqa buyurtma bo'yicha javob kutayotgan haydovchi ham chetlatiladi,
--    shunda bitta haydovchiga bir vaqtda ikkita taklif bormaydi.
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
    and not exists (                       -- bu buyurtmaga avval taklif olgan
      select 1 from public.ride_offers o
      where o.ride_id = r.id and o.driver_id = d.id
    )
    and not exists (                       -- hozir boshqa taklifga javob kutmoqda
      select 1 from public.ride_offers o
      where o.driver_id = d.id and o.status = 'pending' and o.expires_at > now()
    )
  order by d.location <-> r.pickup
  limit p_limit;
$$;

-- ---------------------------------------------------------------------
-- 2. Keyingi taklifni yuborish — dispatchning yuragi
-- ---------------------------------------------------------------------
create or replace function public.dispatch_next_offer(p_ride_id uuid)
returns text            -- natija: 'offered' | 'waiting' | 'no_driver' | 'skipped'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride   public.rides%rowtype;
  v_driver record;
begin
  -- Bir vaqtda ikki jarayon bitta buyurtmani ishlamasligi uchun qatorni qulflaymiz
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found or v_ride.status <> 'searching' then
    return 'skipped';
  end if;

  -- Muddati o'tgan takliflarni yopamiz
  update public.ride_offers
     set status = 'expired', responded_at = now()
   where ride_id = p_ride_id and status = 'pending' and expires_at <= now();

  -- Hali javob kutilayotgan taklif bo'lsa, kutamiz
  if exists (select 1 from public.ride_offers
             where ride_id = p_ride_id and status = 'pending') then
    return 'waiting';
  end if;

  loop
    select * into v_driver
      from public.nearest_available_drivers(p_ride_id, v_ride.search_radius_m, 1);

    if found then
      insert into public.ride_offers (ride_id, driver_id, distance_m, expires_at)
      values (p_ride_id, v_driver.driver_id, round(v_driver.distance_m)::int,
              now() + make_interval(secs => public.dispatch_offer_seconds()));
      return 'offered';
    end if;

    -- Shu radiusda hech kim qolmadi: radiusni kengaytiramiz yoki to'xtaymiz
    if v_ride.search_radius_m < public.dispatch_max_radius_m() then
      v_ride.search_radius_m := public.dispatch_max_radius_m();
      update public.rides set search_radius_m = v_ride.search_radius_m where id = p_ride_id;
    else
      update public.rides set status = 'no_driver' where id = p_ride_id;
      return 'no_driver';
    end if;
  end loop;
end;
$$;

-- Yangi buyurtma yaratilishi bilan dispatch avtomatik boshlanadi
create or replace function public.on_ride_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_next_offer(new.id);
  return new;
end;
$$;

create trigger ride_created_dispatch
  after insert on public.rides
  for each row execute function public.on_ride_created();

-- ---------------------------------------------------------------------
-- 3. Haydovchi taklifga javob beradi (driver-app chaqiradi)
-- ---------------------------------------------------------------------
create or replace function public.respond_to_offer(p_offer_id bigint, p_accept boolean)
returns text            -- 'accepted' | 'rejected' | 'too_late'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.ride_offers%rowtype;
  v_ride  public.rides%rowtype;
begin
  select * into v_offer from public.ride_offers where id = p_offer_id for update;
  if not found or v_offer.driver_id <> auth.uid() then
    raise exception 'Taklif topilmadi';
  end if;

  select * into v_ride from public.rides where id = v_offer.ride_id for update;

  if v_offer.status <> 'pending' or v_offer.expires_at <= now()
     or v_ride.status <> 'searching' then
    return 'too_late';
  end if;

  if p_accept then
    update public.ride_offers set status = 'accepted', responded_at = now()
     where id = p_offer_id;
    update public.rides set status = 'accepted', driver_id = v_offer.driver_id,
           accepted_at = now()
     where id = v_ride.id;
    update public.drivers set is_busy = true where id = v_offer.driver_id;
    return 'accepted';
  else
    update public.ride_offers set status = 'rejected', responded_at = now()
     where id = p_offer_id;
    perform public.dispatch_next_offer(v_ride.id);
    return 'rejected';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Javob bermagan haydovchilar: har 5 soniyada muddati o'tganlarni
--    yopib, keyingi haydovchiga o'tadi (pg_cron chaqiradi)
-- ---------------------------------------------------------------------
create or replace function public.process_expired_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride_id uuid;
  v_count   integer := 0;
begin
  for v_ride_id in
    select distinct o.ride_id
      from public.ride_offers o
      join public.rides r on r.id = o.ride_id
     where o.status = 'pending' and o.expires_at <= now() and r.status = 'searching'
  loop
    perform public.dispatch_next_offer(v_ride_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Mijoz buyurtmani bekor qiladi
-- ---------------------------------------------------------------------
create or replace function public.cancel_ride(p_ride_id uuid, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found or v_ride.customer_id <> auth.uid() then
    raise exception 'Buyurtma topilmadi';
  end if;
  if v_ride.status not in ('searching', 'accepted', 'arrived') then
    return 'cannot_cancel';
  end if;

  update public.rides set status = 'cancelled', cancel_reason = p_reason,
         cancelled_at = now()
   where id = p_ride_id;
  update public.ride_offers set status = 'expired', responded_at = now()
   where ride_id = p_ride_id and status = 'pending';
  if v_ride.driver_id is not null then
    update public.drivers set is_busy = false where id = v_ride.driver_id;
  end if;
  return 'cancelled';
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Haydovchi safar holatini o'zgartiradi: arrived -> in_progress -> completed
-- ---------------------------------------------------------------------
create or replace function public.advance_ride(p_ride_id uuid)
returns ride_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_next ride_status;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found or v_ride.driver_id is distinct from auth.uid() then
    raise exception 'Buyurtma topilmadi';
  end if;

  v_next := case v_ride.status
              when 'accepted'    then 'arrived'::ride_status
              when 'arrived'     then 'in_progress'::ride_status
              when 'in_progress' then 'completed'::ride_status
            end;
  if v_next is null then
    raise exception 'Bu holatdan keyingi qadam yo''q: %', v_ride.status;
  end if;

  update public.rides
     set status = v_next,
         completed_at = case when v_next = 'completed' then now() else completed_at end
   where id = p_ride_id;

  if v_next = 'completed' then
    update public.drivers set is_busy = false where id = v_ride.driver_id;
  end if;
  return v_next;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Ruxsatlar: ilovalar faqat shu funksiyalarni chaqira oladi
-- ---------------------------------------------------------------------
revoke execute on function public.dispatch_next_offer(uuid)  from public, anon, authenticated;
revoke execute on function public.process_expired_offers()   from public, anon, authenticated;
grant  execute on function public.respond_to_offer(bigint, boolean) to authenticated;
grant  execute on function public.cancel_ride(uuid, text)          to authenticated;
grant  execute on function public.advance_ride(uuid)               to authenticated;

-- ---------------------------------------------------------------------
-- 8. Har 5 soniyada muddati o'tgan takliflarni tekshirish (pg_cron).
--    Supabase: Database -> Extensions -> pg_cron yoqilgan bo'lishi kerak.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('typhoon-expire-offers', '5 seconds',
                     $$ select public.process_expired_offers(); $$);
