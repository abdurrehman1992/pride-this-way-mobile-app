import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Mapbox, { type FillLayerStyle, type LineLayerStyle } from '@rnmapbox/maps';
import Config from 'react-native-config';
import type { FeatureCollection, Polygon } from 'geojson';
import EventDetailModal from '../../components/modals/EventDetailModal';
import TopHeader from '../../components/Home/TopHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';
import { DropdownIcon, SearchIcon } from '../../constants/icons';
import {
  fetchMapEvents,
  searchLocationSuggestions,
  type FirebaseEvent,
  type LocationSuggestion,
} from '../../services/myTourService';

const BG_MATCH = '#7AB4DC';
const INITIAL_CAMERA_CENTER: [number, number] = [-18, 18];
const INITIAL_CAMERA_ZOOM = 0.8;
const SEARCH_DEBOUNCE_MS = 350;

type QuickCity = {
  id: string;
  label: string;
  coordinates: [number, number];
};

type EventMarker = FirebaseEvent & {
  markerType: 'pride' | 'podcast';
  markerCoordinate: [number, number];
};

const STATIC_PODCAST_MARKERS: Array<{
  id: string;
  title: string;
  city_name: string;
  country: string;
  address: string;
  description: string;
  category: string;
  startDate: string;
  startTime: string;
  coverImage?: string;
  coordinates: [number, number];
}> = [
  {
    id: 'podcast-static-1',
    title: 'Voices of Pride Live',
    city_name: 'Toronto',
    country: 'Canada',
    address: 'Downtown Toronto, ON, Canada',
    description: 'A live community podcast recording featuring creators and local voices.',
    category: 'Podcast Event',
    startDate: '2026-06-15',
    startTime: '17:30',
    coordinates: [-79.3832, 43.6532],
  },
  {
    id: 'podcast-static-2',
    title: 'City Stories Podcast Meetup',
    city_name: 'Dubai',
    country: 'UAE',
    address: 'Downtown Dubai, UAE',
    description: 'A podcast meetup focused on travel, stories, and identity across cities.',
    category: 'Podcast Event',
    startDate: '2026-06-21',
    startTime: '18:00',
    coordinates: [55.2708, 25.2048],
  },
  {
    id: 'podcast-static-3',
    title: 'Rainbow Talks Studio Session',
    city_name: 'London',
    country: 'United Kingdom',
    address: 'Camden, London, UK',
    description: 'A hosted podcast session with interviews, music, and community highlights.',
    category: 'Podcast Event',
    startDate: '2026-06-29',
    startTime: '19:00',
    coordinates: [-0.1425, 51.5416],
  },
];

const QUICK_CITIES: QuickCity[] = [
  {
    id: 'new-york',
    label: 'New York, USA',
    coordinates: [-74.006, 40.7128],
  },
  {
    id: 'los-angeles',
    label: 'Los Angeles, USA',
    coordinates: [-118.2437, 34.0522],
  },
  {
    id: 'london',
    label: 'London, UK',
    coordinates: [-0.1276, 51.5072],
  },
  {
    id: 'dubai',
    label: 'Dubai, UAE',
    coordinates: [55.2708, 25.2048],
  },
  {
    id: 'toronto',
    label: 'Toronto, Canada',
    coordinates: [-79.3832, 43.6532],
  },
];

const PRIDE_BANDS: { color: string; minLon: number; maxLon: number }[] = [
{ color: '#FF5C0A', minLon: -180, maxLon: -120 },
    { color: '#F39A22', minLon: -120, maxLon: -60 },
    { color: '#FFE100', minLon: -60, maxLon: -20 },
    { color: '#95D600', minLon: -20, maxLon: 20 },
    { color: '#31C93A', minLon: 20, maxLon: 60 },
    { color: '#249D78', minLon: 60, maxLon: 100 },
    { color: '#3367CC', minLon: 100, maxLon: 140 },
    { color: '#A11FD6', minLon: 140, maxLon: 180 },
];

const prideStripes: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: PRIDE_BANDS.map((band) => ({
    type: 'Feature',
    properties: { color: band.color },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [band.minLon, -90],
        [band.maxLon, -90],
        [band.maxLon, 90],
        [band.minLon, 90],
        [band.minLon, -90],
      ]],
    },
  })),
};

const prideFillStyle: FillLayerStyle = {
  fillColor: ['get', 'color'],
  fillOpacity: 1,
};

const waterFillStyle: FillLayerStyle = {
  fillColor: '#066ac1',
  fillOpacity: 1,
};

const roadCasingStyle: LineLayerStyle = {
  lineColor: '#FFFFFF',
  lineWidth: ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2, 16, 6],
  lineOpacity: 0.9,
  lineCap: 'round',
  lineJoin: 'round',
};

const roadFillStyle: LineLayerStyle = {
  lineColor: '#0000FF',
  lineWidth: ['interpolate', ['linear'], ['zoom'], 5, 0.3, 12, 1.4, 16, 4],
  lineOpacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
};

const atmosphereStyle = {
  color: BG_MATCH,
  highColor: BG_MATCH,
  horizonBlend: 0,
  spaceColor: BG_MATCH,
  starIntensity: 0,
};

const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

const buildLocationLabel = (city?: string, country?: string) =>
  [city, country].filter(Boolean).join(', ');

const eventMatchesFilter = (event: FirebaseEvent, filterLabel: string) => {
  const normalizedFilter = normalizeText(filterLabel);
  if (!normalizedFilter) {
    return true;
  }

  const haystack = [
    event.city_name,
    event.country,
    buildLocationLabel(event.city_name, event.country),
    event.address,
    event.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedFilter);
};

const buildPodcastCoordinate = (event: FirebaseEvent, index: number): [number, number] => {
  const longitude = Number(event.coordinates?.longitude || 0);
  const latitude = Number(event.coordinates?.latitude || 0);
  const offset = index % 2 === 0 ? 0.32 : -0.32;

  return [longitude + offset, latitude + 0.18];
};

const Map = () => {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [mapReady, setMapReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_CAMERA_ZOOM);
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FirebaseEvent | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!Config.MAPBOX_TOKEN) return undefined;

    Mapbox.setAccessToken(Config.MAPBOX_TOKEN)
      .then(() => {
        if (isMounted) {
          setMapReady(true);
          setZoomLevel(INITIAL_CAMERA_ZOOM);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMapReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchMapEvents()
      .then((response) => {
        if (isMounted) {
          setEvents(response);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEvents([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedLocation || searchText.trim().length < 2) {
      setSearchSuggestions([]);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      searchLocationSuggestions(searchText)
        .then((results) => {
          setSearchSuggestions(results);
          setShowSuggestions(true);
        })
        .catch(() => {
          setSearchSuggestions([]);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchText, selectedLocation]);

  const filteredEvents = useMemo(() => {
    const filterLabel = selectedLocation?.label || '';
    return events.filter((event) => eventMatchesFilter(event, filterLabel));
  }, [events, selectedLocation]);

  const prideMarkers = useMemo<EventMarker[]>(
    () =>
      filteredEvents.map((event) => ({
        ...event,
        markerType: 'pride',
        markerCoordinate: [
          Number(event.coordinates?.longitude || 0),
          Number(event.coordinates?.latitude || 0),
        ],
      })),
    [filteredEvents]
  );

  const podcastMarkers = useMemo<EventMarker[]>(
    () =>
      STATIC_PODCAST_MARKERS.filter((event) =>
        eventMatchesFilter(
          {
            ...event,
            coordinates: {
              longitude: event.coordinates[0],
              latitude: event.coordinates[1],
            },
          },
          selectedLocation?.label || ''
        )
      ).map((event, index) => ({
        ...event,
        markerType: 'podcast',
        coordinates: {
          longitude: event.coordinates[0],
          latitude: event.coordinates[1],
        },
        markerCoordinate: buildPodcastCoordinate(
          {
            ...event,
            coordinates: {
              longitude: event.coordinates[0],
              latitude: event.coordinates[1],
            },
          },
          index
        ),
      })),
    [selectedLocation]
  );

  const focusLocation = useCallback((location: LocationSuggestion) => {
    if (!location.coordinates) {
      return;
    }

    cameraRef.current?.setCamera({
      centerCoordinate: location.coordinates,
      zoomLevel: 4.4,
      pitch: 0,
      heading: 0,
      animationDuration: 1400,
      animationMode: 'flyTo',
    });
    setZoomLevel(4.4);
  }, []);

  const handleQuickCityPress = useCallback(
    (city: QuickCity) => {
      const nextSelection: LocationSuggestion = {
        id: city.id,
        label: city.label,
        city: city.label.split(',')[0]?.trim(),
        country: city.label.split(',').slice(1).join(',').trim(),
        coordinates: city.coordinates,
      };

      setSelectedLocation(nextSelection);
      setSearchText(city.label);
      setShowSuggestions(false);
      setSearchSuggestions([]);
      Keyboard.dismiss();
      focusLocation(nextSelection);
    },
    [focusLocation]
  );

  const handleSuggestionPress = useCallback(
    (suggestion: LocationSuggestion) => {
      setSelectedLocation(suggestion);
      setSearchText(suggestion.label);
      setShowSuggestions(false);
      setSearchSuggestions([]);
      Keyboard.dismiss();
      focusLocation(suggestion);
    },
    [focusLocation]
  );

  const handleClearFilter = useCallback(() => {
    setSelectedLocation(null);
    setSearchText('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    cameraRef.current?.setCamera({
      centerCoordinate: INITIAL_CAMERA_CENTER,
      zoomLevel: INITIAL_CAMERA_ZOOM,
      pitch: 0,
      heading: 0,
      animationDuration: 1400,
      animationMode: 'flyTo',
    });
    setZoomLevel(INITIAL_CAMERA_ZOOM);
  }, []);

  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text);
    setSelectedLocation(null);
    setShowSuggestions(true);
  }, []);

  const handleMarkerPress = useCallback((marker: EventMarker) => {
    setSelectedEvent(marker);
    cameraRef.current?.setCamera({
      centerCoordinate: marker.markerCoordinate,
      zoomLevel: 5.2,
      pitch: 0,
      heading: 0,
      animationDuration: 1200,
      animationMode: 'flyTo',
    });
    setZoomLevel(5.2);
  }, []);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const nextZoom =
      direction === 'in'
        ? Math.min(zoomLevel + 0.8, 18)
        : Math.max(zoomLevel - 0.8, 0.8);

    cameraRef.current?.setCamera({
      zoomLevel: nextZoom,
      animationDuration: 450,
    });
    setZoomLevel(nextZoom);
  }, [zoomLevel]);

  return (
    <View style={styles.container}>
      <TopHeader title="Map" />
      <View style={styles.controlsWrap}>
        <View style={styles.inlineFilterHeader}>
          <Text style={styles.controlsTitle}>Explore By City</Text>
          {selectedLocation ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleClearFilter}
              style={styles.resetPill}
            >
              <Text style={styles.resetPillText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickCitiesContent}
        >
          {QUICK_CITIES.map((city) => {
            const isActive = selectedLocation?.id === city.id;
            return (
              <TouchableOpacity
                key={city.id}
                activeOpacity={0.85}
                style={[styles.quickCityChip, isActive && styles.quickCityChipActive]}
                onPress={() => handleQuickCityPress(city)}
              >
                <Text
                  style={[
                    styles.quickCityChipText,
                    isActive && styles.quickCityChipTextActive,
                  ]}
                >
                  {city.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchBlock}>
          <View style={styles.citySearchWrap}>
            <View style={styles.citySearchInputWrap}>
              <SearchIcon width={18} height={18} />
              <TextInput
                value={searchText}
                onChangeText={handleSearchTextChange}
                placeholder="Search any city in the world"
                placeholderTextColor="#66717B"
                style={styles.citySearchInput}
                onFocus={() => setShowSuggestions(true)}
              />
            </View>
            <DropdownIcon width={11} height={6} />
          </View>

          {showSuggestions && searchSuggestions.length > 0 ? (
            <View style={styles.suggestionsCard}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.suggestionsScroll}
              >
                {searchSuggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.id}
                    activeOpacity={0.85}
                    style={styles.suggestionRow}
                    onPress={() => handleSuggestionPress(suggestion)}
                  >
                    <Text style={styles.suggestionTitle}>{suggestion.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.mapSection}>
        <View style={styles.globeContainer}>
          {Config.MAPBOX_TOKEN && mapReady ? (
            <View style={styles.mapShell}>
              <Mapbox.MapView
                style={styles.map}
                styleURL={Mapbox.StyleURL.Light}
                projection="globe"
                logoEnabled={false}
                attributionEnabled={false}
                compassEnabled={false}
                scaleBarEnabled={false}
                rotateEnabled
                pitchEnabled={false}
                scrollEnabled
                zoomEnabled
                surfaceView={false}
                onPress={() => {
                  setShowSuggestions(false);
                  setSelectedEvent(null);
                }}
              >
                <Mapbox.Camera
                  ref={cameraRef}
                  centerCoordinate={INITIAL_CAMERA_CENTER}
                  zoomLevel={INITIAL_CAMERA_ZOOM}
                  pitch={0}
                  heading={0}
                />
                <Mapbox.Atmosphere style={atmosphereStyle} />
                <Mapbox.ShapeSource id="prideStripes" shape={prideStripes}>
                  <Mapbox.FillLayer
                    id="prideStripesFill"
                    style={prideFillStyle}
                    belowLayerID="water"
                  />
                </Mapbox.ShapeSource>
                <Mapbox.VectorSource
                  id="composite"
                  url="mapbox://mapbox.mapbox-streets-v8"
                  existing
                >
                  <Mapbox.FillLayer
                    id="customWaterFill"
                    sourceID="composite"
                    sourceLayerID="water"
                    style={waterFillStyle}
                  />
                  <Mapbox.LineLayer
                    id="customRoadCasing"
                    sourceID="composite"
                    sourceLayerID="road"
                    style={roadCasingStyle}
                  />
                  <Mapbox.LineLayer
                    id="customRoadFill"
                    sourceID="composite"
                    sourceLayerID="road"
                    style={roadFillStyle}
                    aboveLayerID="customRoadCasing"
                  />
                </Mapbox.VectorSource>

                {prideMarkers.map((event) => (
                  <Mapbox.MarkerView
                    key={`pride-${event.id}`}
                    id={`pride-${event.id}`}
                    coordinate={event.markerCoordinate}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleMarkerPress(event)}
                      style={styles.markerTapArea}
                    >
                      <View style={[styles.markerBubble, styles.redMarkerBubble]}>
                        <View style={styles.markerInnerDot} />
                      </View>
                    </TouchableOpacity>
                  </Mapbox.MarkerView>
                ))}

                {podcastMarkers.map((event) => (
                  <Mapbox.MarkerView
                    key={`podcast-${event.id}`}
                    id={`podcast-${event.id}`}
                    coordinate={event.markerCoordinate}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleMarkerPress(event)}
                      style={styles.markerTapArea}
                    >
                      <View style={[styles.markerBubble, styles.blueMarkerBubble]}>
                        <View style={styles.markerInnerDot} />
                      </View>
                    </TouchableOpacity>
                  </Mapbox.MarkerView>
                ))}
              </Mapbox.MapView>

              <View style={[styles.zoomControls]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.zoomButton, styles.zoomButtonTop]}
                  onPress={() => handleZoom('in')}
                >
                  <Text style={styles.zoomButtonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.zoomButton}
                  onPress={() => handleZoom('out')}
                >
                  <Text style={styles.zoomButtonText}>-</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>
                {Config.MAPBOX_TOKEN ? 'Loading map...' : 'Mapbox token missing'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.legendCard]}>
        {/* <Text style={styles.legendTitle}>Map Legend</Text> */}
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, styles.legendDotRed]} />
          <Text style={styles.legendText}>Red markers show Pride events.</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, styles.legendDotBlue]} />
          <Text style={styles.legendText}>
            Blue markers show Podcast events. 
          </Text>
        </View>
      </View>

      <EventDetailModal
        visible={Boolean(selectedEvent)}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        variant="compact"
      />
    </View>
  );
};

export default Map;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_MATCH,
  },
  mapSection: {
    flex: 1,
  },
  controlsWrap: {
    marginHorizontal: 20,
    marginTop: 10,
    zIndex: 50,
    elevation: 20,
  },
  inlineFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  controlsTitle: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  resetPill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetPillText: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  quickCitiesContent: {
    paddingRight: 8,
    gap: 10,
  },
  quickCityChip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickCityChipActive: {
    backgroundColor: COLORS.WHITE,
    borderColor: COLORS.WHITE,
  },
  quickCityChipText: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  quickCityChipTextActive: {
    color: COLORS.PRIMARY || '#1888E7',
  },
  citySearchWrap: {
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0B2A45',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  searchBlock: {
    marginTop: 14,
    position: 'relative',
    zIndex: 60,
  },
  citySearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  citySearchInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    paddingVertical: 0,
  },
  suggestionsCard: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    borderRadius: 22,
    backgroundColor: COLORS.WHITE,
    paddingVertical: 8,
    shadowColor: '#0B2A45',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
    maxHeight: 220,
    zIndex: 70,
  },
  suggestionsScroll: {
    maxHeight: 220,
  },
  suggestionRow: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F7',
  },
  suggestionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  globeContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  mapShell: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  zoomControls: {
    position: 'absolute',
    right: 18,
    bottom: 40,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  zoomButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomButtonTop: {
    borderBottomWidth: 1,
    borderBottomColor: '#E6EDF3',
  },
  zoomButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  markerTapArea: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  redMarkerBubble: {
    backgroundColor: '#F04452',
  },
  blueMarkerBubble: {
    backgroundColor: '#1B84FF',
  },
  markerInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.WHITE,
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapFallbackText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  legendCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: -10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  legendTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3,
    marginRight: 10,
  },
  legendDotRed: {
    backgroundColor: '#F04452',
  },
  legendDotBlue: {
    backgroundColor: '#1B84FF',
  },
  legendText: {
    flex: 1,
    color: '#56616C',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
});
