import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

// ---------------------------------------------------------------------
// Typhoon Driver — DEMO REJIM
// Supabase ulanmaguncha buyurtmalar soxta (demo) bo'ladi. Maqsad: UI,
// taymer va "Yo'l ko'rsat" navigatsiyasini telefonda sinash.
// ---------------------------------------------------------------------

const COLORS = {
  black: '#0B0B0C',
  card: '#151517',
  border: '#2A2A2E',
  gold: '#D4AF37',
  white: '#FFFFFF',
  gray: '#9A9A9F',
  green: '#2ECC71',
  red: '#E74C3C',
};

const OFFER_SECONDS = 15;

// Demo buyurtma nuqtasi: Qorako'l, Toshkent ko'chasi atrofi
const DEMO_PICKUP = {
  latitude: 39.525697,
  longitude: 63.84767,
  address: "Toshkent ko'cha, 117",
  note: "Ko'k darvoza oldida",
};

type Coords = { latitude: number; longitude: number };
type Phase = 'offline' | 'waiting' | 'offer' | 'to_pickup' | 'arrived' | 'in_progress';

export default function App() {
  const mapRef = useRef<MapView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const [phase, setPhase] = useState<Phase>('offline');
  const [myLocation, setMyLocation] = useState<Coords | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);

  // Online bo'lganda joylashuvni kuzatamiz (keyin Supabase'ga yuboriladi)
  async function goOnline() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ruxsat kerak', 'Buyurtma olish uchun joylashuvga ruxsat bering.');
      return;
    }
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyLocation(coords);
        // TODO (Supabase): drivers jadvalida location va location_updated_at ni yangilash
      }
    );
    setPhase('waiting');
  }

  function goOffline() {
    watchRef.current?.remove();
    watchRef.current = null;
    setPhase('offline');
  }

  useEffect(() => () => watchRef.current?.remove(), []);

  // DEMO: online bo'lgandan 4 soniya keyin buyurtma taklifi keladi
  useEffect(() => {
    if (phase !== 'waiting') return;
    const t = setTimeout(() => {
      setSecondsLeft(OFFER_SECONDS);
      setPhase('offer');
    }, 4000);
    return () => clearTimeout(t);
  }, [phase]);

  // Taklif taymeri: 15 soniyada javob bo'lmasa, taklif yo'qoladi
  useEffect(() => {
    if (phase !== 'offer') return;
    if (secondsLeft <= 0) {
      setPhase('waiting');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  // Buyurtma qabul qilinganda xaritani mijoz nuqtasiga olib boramiz
  useEffect(() => {
    if (phase === 'to_pickup') {
      mapRef.current?.animateToRegion(
        { ...DEMO_PICKUP, latitudeDelta: 0.003, longitudeDelta: 0.003 },
        800
      );
    }
  }, [phase]);

  // "Yo'l ko'rsat": Yandex Navigator yoki Google Maps ovozli navigatsiyasi
  function openNavigation() {
    const { latitude: lat, longitude: lng } = DEMO_PICKUP;
    Alert.alert("Yo'l ko'rsatish", 'Qaysi ilova orqali?', [
      {
        text: 'Yandex Navigator',
        onPress: () =>
          Linking.openURL(`yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`).catch(
            () => Alert.alert('Yandex Navigator topilmadi', "Play Market'dan o'rnating yoki Google Maps'ni tanlang.")
          ),
      },
      {
        text: 'Google Maps',
        onPress: () => {
          const native =
            Platform.OS === 'android'
              ? `google.navigation:q=${lat},${lng}&mode=d`
              : `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
          const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
          Linking.openURL(native).catch(() => Linking.openURL(web));
        },
      },
      { text: 'Bekor', style: 'cancel' },
    ]);
  }

  const distanceText = myLocation ? `${Math.round(distanceMeters(myLocation, DEMO_PICKUP))} m` : '—';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType="hybrid"
        initialRegion={{ ...DEMO_PICKUP, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsUserLocation={phase !== 'offline'}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {(phase === 'offer' || phase === 'to_pickup' || phase === 'arrived') && (
          <Marker coordinate={DEMO_PICKUP} title="Mijoz" description={DEMO_PICKUP.note}>
            <View style={styles.pickupPin}>
              <View style={styles.pickupDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Yuqori panel */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>TYPHOON · DRIVER</Text>
        <View style={styles.demoBadge}>
          <Text style={styles.demoText}>DEMO</Text>
        </View>
      </View>

      {/* Pastki karta: holatga qarab o'zgaradi */}
      <View style={styles.sheet}>
        {phase === 'offline' && (
          <>
            <Text style={styles.title}>Siz offline holatdasiz</Text>
            <Text style={styles.subtitle}>Buyurtma olish uchun online bo'ling.</Text>
            <Button label="Online bo'lish" color={COLORS.green} onPress={goOnline} />
          </>
        )}

        {phase === 'waiting' && (
          <>
            <Text style={styles.title}>Buyurtma kutilmoqda...</Text>
            <Text style={styles.subtitle}>Siz onlinesiz. Joylashuvingiz yangilanib turibdi.</Text>
            <Button label="Offline bo'lish" color={COLORS.border} textColor={COLORS.white} onPress={goOffline} />
          </>
        )}

        {phase === 'offer' && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>YANGI BUYURTMA</Text>
              <Text style={styles.timer}>{secondsLeft} s</Text>
            </View>
            <Text style={styles.title}>{DEMO_PICKUP.address}</Text>
            <Text style={styles.subtitle}>
              Sizdan {distanceText} · Izoh: {DEMO_PICKUP.note}
            </Text>
            <View style={styles.row}>
              <Button label="Rad etish" color={COLORS.border} textColor={COLORS.white} onPress={() => setPhase('waiting')} flex />
              <Button label="Qabul qilish" color={COLORS.gold} onPress={() => setPhase('to_pickup')} flex />
            </View>
          </>
        )}

        {phase === 'to_pickup' && (
          <>
            <Text style={styles.label}>MIJOZ TOMON</Text>
            <Text style={styles.title}>{DEMO_PICKUP.address}</Text>
            <Text style={styles.subtitle}>
              {distanceText} · Izoh: {DEMO_PICKUP.note}
            </Text>
            <View style={styles.row}>
              <Button label="Yo'l ko'rsat" color={COLORS.gold} onPress={openNavigation} flex />
              <Button label="Keldim" color={COLORS.green} onPress={() => setPhase('arrived')} flex />
            </View>
          </>
        )}

        {phase === 'arrived' && (
          <>
            <Text style={styles.label}>MIJOZ KUTILMOQDA</Text>
            <Text style={styles.title}>Mijozga xabar yuborildi</Text>
            <Text style={styles.subtitle}>Mijoz mashinaga o'tirgach, safarni boshlang.</Text>
            <Button label="Safarni boshlash" color={COLORS.gold} onPress={() => setPhase('in_progress')} />
          </>
        )}

        {phase === 'in_progress' && (
          <>
            <Text style={styles.label}>SAFAR DAVOM ETMOQDA</Text>
            <Text style={styles.title}>Mijoz manziliga</Text>
            <Button
              label="Safarni yakunlash"
              color={COLORS.green}
              onPress={() => {
                Alert.alert('Safar yakunlandi', "Demo: keyingi buyurtma kutilmoqda.");
                setPhase('waiting');
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

function Button(props: {
  label: string;
  color: string;
  textColor?: string;
  onPress: () => void;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: props.color, opacity: pressed ? 0.8 : 1 },
        props.flex && { flex: 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: props.textColor ?? COLORS.black }]}>{props.label}</Text>
    </Pressable>
  );
}

// Ikki nuqta orasidagi to'g'ri chiziqli masofa (metr) — Haversine formulasi
function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },

  topBar: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  demoBadge: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.gold,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  demoText: { color: COLORS.gold, fontWeight: '700', fontSize: 12 },

  pickupPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.black,
    borderWidth: 3,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    paddingBottom: 34,
    gap: 8,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  label: { color: COLORS.gold, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  timer: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  title: { color: COLORS.white, fontSize: 19, fontWeight: '700' },
  subtitle: { color: COLORS.gray, fontSize: 14 },

  button: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: { fontSize: 16, fontWeight: '800' },
});
