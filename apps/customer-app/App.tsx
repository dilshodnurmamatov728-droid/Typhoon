import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

// Typhoon ranglari: qora, oq, oltin
const COLORS = {
  black: '#0B0B0C',
  card: '#151517',
  border: '#2A2A2E',
  gold: '#D4AF37',
  white: '#FFFFFF',
  gray: '#9A9A9F',
};

// Qorako'l markazi (taxminiy koordinata). GPS ishlamasa, xarita shu yerdan ochiladi.
const QORAKOL: Region = {
  latitude: 39.5275,
  longitude: 63.8536,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

// Mijozni topgandan keyingi yaqinlashtirish darajasi (ko'cha darajasi)
const STREET_ZOOM = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

type Coords = { latitude: number; longitude: number };
type PermissionState = 'loading' | 'granted' | 'denied' | 'blocked';

export default function App() {
  const mapRef = useRef<MapView>(null);
  const geocodeRequestId = useRef(0);

  const [permission, setPermission] = useState<PermissionState>('loading');
  const [pickup, setPickup] = useState<Coords | null>(null);
  const [address, setAddress] = useState('');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [mapMoving, setMapMoving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    locateMe();
  }, []);

  // 1) Ruxsat so'raydi  2) GPS orqali aniq joyni oladi  3) Xaritani shu joyga olib boradi
  async function locateMe() {
    setLocating(true);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission(canAskAgain ? 'denied' : 'blocked');
        return;
      }
      setPermission('granted');

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setAccuracy(position.coords.accuracy ?? null);
      setPickup(coords);
      lookupAddress(coords);
      mapRef.current?.animateToRegion({ ...coords, ...STREET_ZOOM }, 800);
    } catch (error) {
      Alert.alert(
        'Joylashuv aniqlanmadi',
        "GPS yoqilganini tekshiring yoki ochiq joyga chiqib qayta urinib ko'ring."
      );
    } finally {
      setLocating(false);
    }
  }

  // Koordinatadan ko'cha nomini topishga urinadi. Qishloqlarda bo'sh qolishi mumkin.
  async function lookupAddress(coords: Coords) {
    const requestId = ++geocodeRequestId.current;
    setAddress('');
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (requestId !== geocodeRequestId.current) return; // eskirgan javob
      const place = results[0];
      if (!place) return;
      const text = [place.street, place.streetNumber, place.district, place.city]
        .filter(Boolean)
        .join(', ');
      setAddress(text);
    } catch {
      // Manzil topilmasa ham muammo emas: haydovchi baribir aniq nuqtaga boradi
    }
  }

  // Mijoz xaritani surganda pin markazda qoladi; xarita to'xtaganda markaz = pickup nuqtasi
  function handleRegionChangeComplete(region: Region) {
    setMapMoving(false);
    const coords = { latitude: region.latitude, longitude: region.longitude };
    setPickup(coords);
    lookupAddress(coords);
  }

  function handleOrder() {
    if (!pickup) return;
    Alert.alert(
      'Pickup nuqtasi tanlandi',
      `${pickup.latitude.toFixed(6)}, ${pickup.longitude.toFixed(6)}\n\n` +
        "Keyingi qadamda bu buyurtma eng yaqin haydovchiga yuboriladi."
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={satellite ? 'light' : 'dark'} />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={QORAKOL}
        mapType={satellite ? 'hybrid' : 'standard'}
        showsUserLocation={permission === 'granted'}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onRegionChange={() => setMapMoving(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
      />

      {/* Markazdagi pin: xarita ostida suriladi, pin joyida turadi */}
      <View pointerEvents="none" style={styles.pinWrapper}>
        <View style={[styles.pin, mapMoving && styles.pinLifted]}>
          <View style={styles.pinHead}>
            <View style={styles.pinDot} />
          </View>
          <View style={styles.pinStem} />
        </View>
        <View style={styles.pinShadow} />
      </View>

      {/* Yuqori panel: brend va xarita turi */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>TYPHOON</Text>
        <Pressable style={styles.chip} onPress={() => setSatellite((s) => !s)}>
          <Text style={styles.chipText}>{satellite ? 'Xarita' : 'Sputnik'}</Text>
        </Pressable>
      </View>

      {/* Pastki karta: manzil va tugmalar */}
      <View style={styles.sheet}>
        {permission === 'denied' || permission === 'blocked' ? (
          <>
            <Text style={styles.title}>Joylashuvga ruxsat kerak</Text>
            <Text style={styles.subtitle}>
              Haydovchi sizni aniq topishi uchun ilovaga joylashuvdan foydalanishga ruxsat bering.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={permission === 'blocked' ? () => Linking.openSettings() : locateMe}
            >
              <Text style={styles.primaryButtonText}>
                {permission === 'blocked' ? 'Sozlamalarni ochish' : 'Ruxsat berish'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Qayerdan olib ketamiz?</Text>
            <Text style={styles.title} numberOfLines={2}>
              {mapMoving
                ? 'Nuqtani tanlang...'
                : address || 'Pin turgan joy (xaritani surib aniqlashtiring)'}
            </Text>
            {pickup && (
              <Text style={styles.subtitle}>
                {pickup.latitude.toFixed(6)}, {pickup.longitude.toFixed(6)}
                {accuracy != null ? `  ·  GPS aniqligi ±${Math.round(accuracy)} m` : ''}
              </Text>
            )}

            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={locateMe} disabled={locating}>
                {locating ? (
                  <ActivityIndicator color={COLORS.gold} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Mening joyim</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.flex, (!pickup || mapMoving) && styles.disabled]}
                onPress={handleOrder}
                disabled={!pickup || mapMoving}
              >
                <Text style={styles.primaryButtonText}>Taxi chaqirish</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const PIN_HEAD = 34;
const PIN_STEM = 14;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },

  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: PIN_HEAD,
    marginLeft: -PIN_HEAD / 2,
    marginTop: -(PIN_HEAD + PIN_STEM),
    alignItems: 'center',
  },
  pin: { alignItems: 'center' },
  pinLifted: { transform: [{ translateY: -10 }] },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    backgroundColor: COLORS.black,
    borderWidth: 3,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  pinStem: { width: 3, height: PIN_STEM, backgroundColor: COLORS.black },
  pinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginTop: -2,
  },

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
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chip: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  chipText: { color: COLORS.white, fontWeight: '600' },

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
  label: { color: COLORS.gold, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  subtitle: { color: COLORS.gray, fontSize: 13 },

  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  flex: { flex: 1 },
  primaryButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minWidth: 120,
  },
  secondaryButtonText: { color: COLORS.white, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
