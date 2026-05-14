import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Mapbox, {
  type CircleLayerStyle,
  type LineLayerStyle,
} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import Config from 'react-native-config';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFavorites } from '../../context/FavoritesContext';
import { showSuccess, showInfo } from '../../components/common/AppToast';
import { RECOMMENDED_IMAGE } from '../../constants/images';
import {
  DropdownIcon,
  StarIcon,
  LocationIcon,
  HeartIcon,
  TimeIcon,
  ForkIcon,
  DeleteWhiteIcon,
  RedHeartIcon,
} from '../../constants/icons';
import BlueMapIcon from '../../assets/icons/blueMapIcon.svg';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';
import ScanVerifyModal from '../../components/modals/ScanVerifyModal';
import TopHeader from '../../components/Home/TopHeader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Card dimensions – used to position it near the tapped marker
const CARD_WIDTH = 182;
const CARD_HEIGHT = 192;

type TourStop = {
  id: string;
  title: string;
  coordinate: [number, number];
};

const INITIAL_TOUR_STOPS: TourStop[] = [
  { id: 'stop-1', title: 'Skyline Rooftop Dining', coordinate: [-118.3009, 34.0652] },
  { id: 'stop-2', title: 'Gallery District', coordinate: [-118.2969, 34.0631] },
  { id: 'stop-3', title: 'Canal Walk', coordinate: [-118.2991, 34.0604] },
  { id: 'stop-4', title: 'Garden Square', coordinate: [-118.3036, 34.0617] },
  { id: 'stop-5', title: 'Street Market', coordinate: [-118.3051, 34.0648] },
];

const routeLineLayerStyle: LineLayerStyle = {
  lineColor: COLORS.LOGOUT_TEXT,
  lineWidth: 4,
  lineOpacity: 0.95,
  lineDasharray: [1.4, 1.6],
  lineCap: 'round',
  lineJoin: 'round',
};

const markerHitLayerStyle: CircleLayerStyle = {
  circleColor: COLORS.BUTTON_COLOR,
  circleRadius: 26,
  circleOpacity: 0.01,
};

const MyTourStart = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);

  const [tourStops, setTourStops] = useState<TourStop[]>(INITIAL_TOUR_STOPS);
  const [scanVisible, setScanVisible] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Card state: which stop is selected + screen position near the marker
  const [selectedStop, setSelectedStop] = useState<TourStop | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const tourId = route.params?.tourId;

  const currentRoute = {
    id: tourId ?? 'route-1',
    title: 'California Scenic Route',
    description: 'Beautiful travel path across California',
    rating: '4.8',
    image: RECOMMENDED_IMAGE,
    category: 'Route' as const,
  };

  useEffect(() => {
    let isMounted = true;
    if (!Config.MAPBOX_TOKEN) return undefined;

    Mapbox.setAccessToken(Config.MAPBOX_TOKEN)
      .then(() => { if (isMounted) setMapReady(true); })
      .catch(() => { if (isMounted) setMapReady(false); });

    return () => { isMounted = false; };
  }, []);

  // Append a stop returned from the AddLocations screen
  useEffect(() => {
    const added = route.params?.addedStop;
    if (!added) return;
    setTourStops((prev) => {
      if (prev.some((s) => s.id === added.id)) return prev;
      return [...prev, { id: added.id, title: added.title, coordinate: added.coordinate }];
    });
  }, [route.params?.addedStop]);

  // Rebuild line + point sources whenever stops change
  const routeLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: tourStops.map((s) => [...s.coordinate]),
          },
        },
      ],
    }),
    [tourStops]
  );

  const routePoints = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: tourStops.map((stop) => ({
        type: 'Feature',
        properties: { id: stop.id, title: stop.title },
        geometry: { type: 'Point', coordinates: [...stop.coordinate] },
      })),
    }),
    [tourStops]
  );

  // Project a geographic coordinate to screen XY, then clamp the card inside bounds
  const getCardPosition = useCallback(
    async (coordinate: [number, number]): Promise<{ x: number; y: number }> => {
      if (!mapRef.current) return { x: 40, y: 300 };

      try {
        const screenPoint = await (mapRef.current as any).getPointInView(coordinate);
        // screenPoint = [x, y] in pixels from top-left of the map view
        let x = (screenPoint[0] ?? 40) - CARD_WIDTH / 2;
        let y = (screenPoint[1] ?? 300) - CARD_HEIGHT - 52; // appear above the pin

        // Clamp horizontally
        x = Math.max(12, Math.min(SCREEN_WIDTH - CARD_WIDTH - 12, x));
        // Clamp vertically – if too close to top, show below the pin
        if (y < 80) y = (screenPoint[1] ?? 300) + 52;
        y = Math.min(SCREEN_HEIGHT - CARD_HEIGHT - 120, y);

        return { x, y };
      } catch {
        return { x: 40, y: 300 };
      }
    },
    []
  );

  const handleMarkerPress = useCallback(
    async (stop: TourStop) => {
      const pos = await getCardPosition(stop.coordinate);
      setCardPosition(pos);
      setSelectedStop(stop);
    },
    [getCardPosition]
  );

  // Delete stop from state → removes marker + rebuilds line
  const handleDeleteStop = useCallback((stopId: string) => {
    setTourStops((prev) => prev.filter((s) => s.id !== stopId));
    setSelectedStop(null);
  }, []);

  const handleFavorite = () => {
    const exists = isFavorite(currentRoute.id);
    if (exists) {
      removeFromFavorites(currentRoute.id);
      showInfo('Removed', 'Removed from favorites');
    } else {
      addToFavorites({
        ...currentRoute,
        routeName: 'MyTourStart',
        routeParams: { tourId: currentRoute.id },
      });
      showSuccess('Added', 'Added to favorites');
    }
  };

  const handleCurrentLocation = useCallback(() => {
    const request = (granted: boolean) => {
      if (!granted) return;
      Geolocation.getCurrentPosition(
        (pos) => {
          cameraRef.current?.setCamera({
            centerCoordinate: [pos.coords.longitude, pos.coords.latitude],
            zoomLevel: 14,
            animationDuration: 800,
            animationMode: 'easeTo',
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    };

    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then((result) => request(result === PermissionsAndroid.RESULTS.GRANTED));
    } else {
      request(true);
    }
  }, []);

  return (
    <View style={styles.container}>
      <TopHeader title="My Tour" />
      <View style={styles.background}>
        {/* ── Top controls row ── */}
        <View style={styles.topSection}>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>California, USA</Text>
            <DropdownIcon width={11} height={6} />
          </TouchableOpacity>

          {/* Add Location button – top right */}
          <TouchableOpacity
            style={styles.addLocationBtn}
            onPress={() => navigation.navigate('AddLocations', { tourId: tourId ?? 0 })}
          >
            <Text style={styles.addLocationText}>+ Add Location</Text>
          </TouchableOpacity>
        </View>

        {/* ── Map ── */}
        <View style={styles.mapContainer}>
          {Config.MAPBOX_TOKEN && mapReady ? (
            <Mapbox.MapView
              ref={mapRef}
              style={styles.map}
              styleURL={Mapbox.StyleURL.Street}
              projection="mercator"
              logoEnabled={false}
              attributionEnabled={false}
              compassEnabled={false}
              scaleBarEnabled={false}
              rotateEnabled
              pitchEnabled
              scrollEnabled
              zoomEnabled
              surfaceView={false}
              onPress={() => setSelectedStop(null)}
            >
              <Mapbox.Camera
                ref={cameraRef}
                centerCoordinate={[-118.3014, 34.063]}
                zoomLevel={15.4}
                pitch={0}
                heading={tourStarted ? 18 : 0}
                animationMode="easeTo"
                animationDuration={900}
              />

              {/* Route line */}
              <Mapbox.ShapeSource id="tourRouteLine" shape={routeLine}>
                <Mapbox.LineLayer id="tourRouteLineLayer" style={routeLineLayerStyle} />
              </Mapbox.ShapeSource>

              {/* Invisible hit targets for the ShapeSource onPress fallback */}
              <Mapbox.ShapeSource
                id="tourRouteHitTargets"
                shape={routePoints}
                hitbox={{ width: 64, height: 64 }}
              >
                <Mapbox.CircleLayer
                  id="tourRouteHitTargetLayer"
                  style={markerHitLayerStyle}
                />
              </Mapbox.ShapeSource>

              {/* Blue pin markers */}
              {tourStops.map((stop) => (
                <Mapbox.MarkerView
                  key={stop.id}
                  id={stop.id}
                  coordinate={[...stop.coordinate]}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${stop.title}`}
                    onPress={() => handleMarkerPress(stop)}
                    style={styles.markerTapArea}
                  >
                    {/* Replace with your blueMapIcon.svg */}
                    <BlueMapIcon width={42} height={42} />
                  </TouchableOpacity>
                </Mapbox.MarkerView>
              ))}
            </Mapbox.MapView>
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>
                {Config.MAPBOX_TOKEN ? 'Loading map...' : 'Mapbox token missing'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Current location indicator ── */}
        <TouchableOpacity activeOpacity={0.85} style={styles.currentLocationBtn} onPress={handleCurrentLocation}>
          <View style={styles.currentLocationOuter}>
            <View style={styles.currentLocationInner} />
          </View>
        </TouchableOpacity>

        {/* ── Detail card – appears near tapped marker ── */}
        {selectedStop && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}} // swallow taps on the card itself
            style={[
              styles.detailCard,
              { position: 'absolute', left: cardPosition.x, top: cardPosition.y },
            ]}
          >
              <Image source={{ uri: RECOMMENDED_IMAGE }} style={styles.cardImage} />

              <View style={styles.topRow}>
                <View style={styles.pill}>
                  <ForkIcon width={8} height={8} />
                  <Text style={styles.pillText}>Restaurant</Text>
                </View>
                <HeartIcon width={13} height={11} />
              </View>

              <View style={styles.textBlock}>
                <Text style={styles.cardTitle}>{selectedStop.title}</Text>
                <Text style={styles.cardSubtitle}>Enjoy food with stunning city views</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <StarIcon width={9} height={9} />
                  <Text style={styles.infoText}>4.8</Text>
                </View>
                <View style={styles.infoItem}>
                  <LocationIcon width={8} height={8} />
                  <Text style={styles.infoText}>California</Text>
                </View>
                <View style={styles.infoItem}>
                  <TimeIcon width={8} height={8} />
                  <Text style={styles.openText}>Open Now</Text>
                </View>
              </View>

              <View style={styles.bottomRow}>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => setScanVisible(true)}
                >
                  <Text style={styles.confirmText}>Confirm Visit</Text>
                </TouchableOpacity>

                {/* Delete → removes stop from map */}
                <TouchableOpacity onPress={() => handleDeleteStop(selectedStop.id)}>
                  <DeleteWhiteIcon width={24} height={24} />
                </TouchableOpacity>
              </View>
          </TouchableOpacity>
        )}

        {/* ── Bottom action buttons ── */}
        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.favoriteBtn} onPress={handleFavorite}>
            {isFavorite(currentRoute.id) ? (
              <RedHeartIcon width={18.5} height={15.92} />
            ) : (
              <HeartIcon width={18.5} height={15.92} />
            )}
            <Text
              style={[
                styles.btnText,
                { color: isFavorite(currentRoute.id) ? COLORS.CLEAR_ALL : COLORS.TEXT_PRIMARY },
              ]}
            >
              {isFavorite(currentRoute.id) ? 'Added' : 'Add to Favorites'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startTourBtn, tourStarted && styles.startTourBtnStarted]}
            onPress={() => setTourStarted(true)}
          >
            <Text style={[styles.btnText, { color: COLORS.WHITE }]}>
              {tourStarted ? 'Tour Started' : 'Start a Tour'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScanVerifyModal
          visible={scanVisible}
          onClose={() => setScanVisible(false)}
          onScanSuccess={() => setScanVisible(false)}
        />
      </View>
    </View>
  );
};

export default MyTourStart;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  background: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 30,
    backgroundColor: '#F6F2EC',
  },
  topSection: {
    marginTop: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',           // row so dropdown + button sit side-by-side
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 10,
  },
  dropdown: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
    height: 32,
    width: 134,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownText: {
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 12,
    color: COLORS.TEXT_PRIMARY,
  },
  /** Add Location button – top right */
  addLocationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.BUTTON_COLOR,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  addLocationText: {
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: 12,
    color: COLORS.WHITE,
  },
  mapContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  mapFallbackText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 13,
  },
  markerTapArea: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationBtn: {
    position: 'absolute',
    right: 34,
    bottom: 138,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.TEXT_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  currentLocationOuter: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.WHITE,
  },
  /** Card is absolutely placed at runtime via cardPosition */
  detailCard: {
    padding: 6,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: COLORS.WHITE,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.BUTTON_COLOR,
    overflow: 'hidden',
    elevation: 10,
    zIndex: 100,
  },
  cardImage: {
    width: '100%',
    height: 70,
    borderRadius: 4,
  },
  topRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#75757538',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 20,
    gap: 3,
  },
  pillText: {
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 7,
  },
  textBlock: {
    marginTop: 7,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: 11,
    color: COLORS.TEXT_PRIMARY,
  },
  cardSubtitle: {
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: 8,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  divider: {
    height: 0,
    marginVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  infoText: {
    fontSize: 7,
    color: COLORS.TEXT_PRIMARY,
  },
  openText: {
    fontSize: 7,
    color: COLORS.TEXT_GREEN,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  confirmBtn: {
    backgroundColor: '#EA673F',
    borderRadius: 18,
    height: 28,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: COLORS.WHITE,
    fontSize: 8,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  rowButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    position: 'relative',
    zIndex: 10,
  },
  favoriteBtn: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    height: 48,
    backgroundColor: COLORS.WHITE,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  startTourBtn: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.BUTTON_COLOR,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTourBtnStarted: {
    backgroundColor: COLORS.GET_DIRECTION_BUTTON,
  },
  btnText: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});