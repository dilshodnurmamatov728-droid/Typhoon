-- =====================================================================
-- Typhoon — 005: boshlang'ich narx (posadka)
-- Oddiy mashina: 3000 so'm boshlang'ich + har km uchun 1100 (kunduzi) / 1250 (kechasi)
-- =====================================================================

alter table public.tariffs add column base_fare_uzs integer not null default 0;

update public.tariffs
   set base_fare_uzs = 3000,
       min_fare_uzs  = 3000,
       updated_at    = now()
 where id = 1;

create or replace function public.calculate_fare(p_distance_m integer, p_at timestamptz default now())
returns integer
language sql
stable
as $$
  select greatest(
           t.min_fare_uzs,
           (round(
              ( t.base_fare_uzs
                + (greatest(coalesce(p_distance_m, 0), 0) / 1000.0)
                  * case
                      when extract(hour from p_at at time zone 'Asia/Tashkent') >= t.night_start_hour
                        or extract(hour from p_at at time zone 'Asia/Tashkent') <  t.night_end_hour
                      then t.night_per_km_uzs
                      else t.day_per_km_uzs
                    end
              ) / t.round_to_uzs) * t.round_to_uzs)::integer
         )
  from public.tariffs t
  where t.id = 1;
$$;
