// Supabase bilan ulanish. Ikkala ilovada ham bir xil (src/lib/supabase.ts).
// Kalitlar .env faylidan olinadi — .env GitHub'ga chiqmaydi.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Sozlama xato bo'lsa ilova yopilib qolmaydi: App ekranda sababini ko'rsatadi
export const supabaseConfigError: string | null =
  !url || !anonKey
    ? "Supabase sozlanmagan: EXPO_PUBLIC_SUPABASE_URL va EXPO_PUBLIC_SUPABASE_ANON_KEY topilmadi (.env yoki eas.json)"
    : null;

export const supabase = createClient(url ?? 'https://not-configured.invalid', anonKey ?? 'not-configured', {
  auth: {
    storage: AsyncStorage, // kirgan foydalanuvchi ilova yopilganda ham eslab qolinadi
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Ilova ochiq bo'lganda sessiyani avtomatik yangilab turadi
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Koordinatani PostGIS formatiga o'giradi (DIQQAT: avval longitude, keyin latitude)
export function toPoint(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}
