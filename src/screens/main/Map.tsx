
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Mapbox, { type FillLayerStyle, type LineLayerStyle } from '@rnmapbox/maps';
import Config from 'react-native-config';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import EventDetailModal from '../../components/modals/EventDetailModal';
import TopHeader from '../../components/Home/TopHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';
import { CrossIcon, DropdownIcon, SearchIcon } from '../../constants/icons';
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

type DateField = 'start' | 'end';

const isPodcastEvent = (event: FirebaseEvent) =>
  (event.event_type || '').toLowerCase().trim() === 'podcast_event';

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

const eventCoordinate = (event: FirebaseEvent): [number, number] => [
  Number(event.coordinates?.longitude || 0),
  Number(event.coordinates?.latitude || 0),
];

const markerColorForEvent = (event: FirebaseEvent) =>
  isPodcastEvent(event) ? '#1B84FF' : '#F04452';

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildCalendarDays = (monthDate: Date) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const daysInMonth = end.getDate();
  const firstWeekday = start.getDay();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const parseDateOnly = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const eventMatchesDateRange = (
  event: FirebaseEvent,
  startDateFilter: string,
  endDateFilter: string
) => {
  const filterStart = parseDateOnly(startDateFilter);
  const filterEnd = parseDateOnly(endDateFilter);

  if (!filterStart && !filterEnd) {
    return true;
  }

  const eventStart = parseDateOnly(event.startDate) || parseDateOnly(event.endDate);
  const eventEnd = parseDateOnly(event.endDate) || eventStart;

  if (!eventStart && !eventEnd) {
    return false;
  }

  const rangeStart = eventStart || eventEnd;
  const rangeEnd = eventEnd || eventStart;

  if (filterStart && rangeEnd && rangeEnd < filterStart) {
    return false;
  }

  if (filterEnd && rangeStart && rangeStart > filterEnd) {
    return false;
  }

  return true;
};

const Map = () => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [mapReady, setMapReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_CAMERA_ZOOM);
  const [events, setEvents] = useState<FirebaseEvent[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FirebaseEvent | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [activeDateField, setActiveDateField] = useState<DateField>('start');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

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
    return events.filter(
      (event) =>
        eventMatchesFilter(event, filterLabel) &&
        eventMatchesDateRange(event, startDateFilter, endDateFilter)
    );
  }, [endDateFilter, events, selectedLocation, startDateFilter]);

  // Native CircleLayer rendering — every event renders as its own GPU-drawn
  // circle. Unlike MarkerView/PointAnnotation, CircleLayer is part of the
  // map tiles themselves, so markers stay visible at every zoom level no
  // matter how far the user zooms out. Same-coordinate events are nudged
  // by tiny lng offsets so they appear as visually distinct dots instead
  // of overlapping into one.
  const eventPointsShape = useMemo<FeatureCollection<Point>>(() => {
    const seenAtKey = new globalThis.Map<string, number>();
    const features = filteredEvents.map((event) => {
      const coord = eventCoordinate(event);
      const key = `${coord[0].toFixed(4)}:${coord[1].toFixed(4)}`;
      const occurrence = seenAtKey.get(key) || 0;
      seenAtKey.set(key, occurrence + 1);
      // Nudge co-located events by ~10m so each remains tappable and
      // visually distinct on the GPU layer.
      const nudgedCoord: [number, number] = occurrence === 0
        ? coord
        : [coord[0] + occurrence * 0.0001, coord[1] + occurrence * 0.0001];
      return {
        type: 'Feature' as const,
        id: event.id,
        properties: {
          id: event.id,
          color: markerColorForEvent(event),
        },
        geometry: { type: 'Point' as const, coordinates: nudgedCoord },
      };
    });
    return { type: 'FeatureCollection', features };
  }, [filteredEvents]);



  const focusLocation = useCallback((location: LocationSuggestion) => {
  if (!location.coordinates) {
    return;
  }

  const matchingEvents = events.filter(
    (event) =>
      eventMatchesFilter(event, location.label) &&
      eventMatchesDateRange(event, startDateFilter, endDateFilter)
  );

  // CASE 1: No events → just move camera to city
  if (matchingEvents.length === 0) {
    cameraRef.current?.setCamera({
      centerCoordinate: location.coordinates,
      zoomLevel: 4.5,
      pitch: 0,
      heading: 0,
      animationDuration: 1200,
      animationMode: 'flyTo',
    });
    setZoomLevel(4.5);
    return;
  }

  // CASE 2: Get all event coordinates
  const coordinates = matchingEvents.map(eventCoordinate);

  const longitudes = coordinates.map(([lng]) => lng);
  const latitudes = coordinates.map(([, lat]) => lat);

  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);

  // CASE 3: All events at same point → zoom in nicely
  if (minLongitude === maxLongitude && minLatitude === maxLatitude) {
    cameraRef.current?.setCamera({
      centerCoordinate: [minLongitude, minLatitude],
      zoomLevel: 13,
      pitch: 0,
      heading: 0,
      animationDuration: 1200,
      animationMode: 'flyTo',
    });
    setZoomLevel(13);
    return;
  }

  // CASE 4: FIT ALL MARKERS PROPERLY
  // Mapbox v10's fitBounds expects (ne, sw, padding, duration).
  // Padding format is [top, right, bottom, left] in pixels.
  // We give generous padding so the GPU circle markers (11px halo) plus
  // the floating zoom buttons and date filter chips never clip an edge.
  const ne: [number, number] = [maxLongitude, maxLatitude];
  const sw: [number, number] = [minLongitude, minLatitude];
  const padding: [number, number, number, number] = [50, 50, 50, 50];

  cameraRef.current?.fitBounds(ne, sw, padding, 1400);

  // ❌ IMPORTANT: DO NOT manually set zoomLevel here
  // setZoomLevel(...) removed because it breaks fitBounds accuracy
}, [events, startDateFilter, endDateFilter]);
  const openCalendar = useCallback((field: DateField) => {
    const currentValue = field === 'start' ? startDateFilter : endDateFilter;
    const parsed = parseDateOnly(currentValue) || new Date();
    setActiveDateField(field);
    setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setCalendarVisible(true);
  }, [endDateFilter, startDateFilter]);

  const closeCalendar = useCallback(() => {
    setCalendarVisible(false);
  }, []);

  const handleCalendarDateSelect = useCallback((date: Date) => {
    const nextValue = formatDateValue(date);
    if (activeDateField === 'start') {
      setStartDateFilter(nextValue);
    } else {
      setEndDateFilter(nextValue);
    }
    setCalendarVisible(false);
  }, [activeDateField]);

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

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    focusLocation(selectedLocation);
  }, [selectedLocation, startDateFilter, endDateFilter, focusLocation]);

  const handleClearFilter = useCallback(() => {
    setSelectedLocation(null);
    setSearchText('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setStartDateFilter('');
    setEndDateFilter('');
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

  const handleClearSearch = useCallback(() => {
    setSearchText('');
    setSelectedLocation(null);
    setSearchSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const activeDateValue = activeDateField === 'start' ? startDateFilter : endDateFilter;
  const selectedCalendarValue = parseDateOnly(activeDateValue);

  const handleMarkerPress = useCallback((event: FirebaseEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseSelectedEvent = useCallback(() => {
    setSelectedEvent(null);
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
          {/* {QUICK_CITIES.map((city) => {
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
          })} */}
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
            {searchText || selectedLocation ? (
              <TouchableOpacity
                activeOpacity={0.85}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                onPress={handleClearSearch}
              >
                <CrossIcon width={12} height={12} />
              </TouchableOpacity>
            ) : (
              <DropdownIcon width={11} height={6} />
            )}
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

        <View style={styles.dateFiltersRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.dateInputWrap}
            onPress={() => openCalendar('start')}
          >
            <View style={styles.dateFieldRow}>
              <Text style={[styles.dateInputText, !startDateFilter && styles.datePlaceholderText]}>
                {startDateFilter || 'From date'}
              </Text>
              {startDateFilter ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  onPress={(event) => {
                    event.stopPropagation();
                    setStartDateFilter('');
                  }}
                >
                  <CrossIcon width={12} height={12} />
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.dateInputWrap}
            onPress={() => openCalendar('end')}
          >
            <View style={styles.dateFieldRow}>
              <Text style={[styles.dateInputText, !endDateFilter && styles.datePlaceholderText]}>
                {endDateFilter || 'To date'}
              </Text>
              {endDateFilter ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  onPress={(event) => {
                    event.stopPropagation();
                    setEndDateFilter('');
                  }}
                >
                  <CrossIcon width={12} height={12} />
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
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
                onCameraChanged={(state: any) => {
                  const z = state?.properties?.zoom;
                  if (typeof z === 'number') setZoomLevel(z);
                }}
                onPress={() => {
                  setShowSuggestions(false);
                  setSelectedEvent(null);
                }}
              >
                <Mapbox.Camera
                  ref={cameraRef}
                  defaultSettings={{
                    centerCoordinate: INITIAL_CAMERA_CENTER,
                    zoomLevel: INITIAL_CAMERA_ZOOM,
                    pitch: 0,
                    heading: 0,
                  }}
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

                <Mapbox.ShapeSource
                  id="eventPoints"
                  shape={eventPointsShape}
                  onPress={(event) => {
                    const feature = event.features?.[0];
                    const id = feature?.properties?.id as string | undefined;
                    const tappedEvent = id
                      ? filteredEvents.find((e) => e.id === id)
                      : null;
                    if (tappedEvent) {
                      handleMarkerPress(tappedEvent);
                    }
                  }}
                >
                  <Mapbox.CircleLayer
                    id="eventPointsCircleHalo"
                    style={{
                      circleRadius: 11,
                      circleColor: '#FFFFFF',
                      circleOpacity: 1,
                      circlePitchAlignment: 'map',
                    }}
                  />
                  <Mapbox.CircleLayer
                    id="eventPointsCircle"
                    style={{
                      circleRadius: 8,
                      circleColor: ['get', 'color'],
                      circleOpacity: 1,
                      circleStrokeWidth: 1.5,
                      circleStrokeColor: '#FFFFFF',
                      circlePitchAlignment: 'map',
                    }}
                  />
                </Mapbox.ShapeSource>
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

      <View style={[styles.legendCard, { marginBottom: 5 }]}>
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
        onClose={handleCloseSelectedEvent}
        variant="compact"
      />

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
      >
        <Pressable style={styles.calendarOverlay} onPress={closeCalendar}>
          <Pressable style={styles.calendarCard} onPress={() => {}}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                  )
                }
              >
                <Text style={styles.calendarNavText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>
                {calendarMonth.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                  )
                }
              >
                <Text style={styles.calendarNavText}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.calendarWeekday}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((date, index) => {
                const isSelected =
                  Boolean(date) &&
                  Boolean(selectedCalendarValue) &&
                  formatDateValue(date as Date) === formatDateValue(selectedCalendarValue as Date);

                return (
                  <TouchableOpacity
                    key={`${date ? formatDateValue(date) : 'empty'}-${index}`}
                    activeOpacity={0.85}
                    disabled={!date}
                    style={[
                      styles.calendarDayCell,
                      isSelected && styles.calendarDayCellSelected,
                      !date && styles.calendarDayCellEmpty,
                    ]}
                    onPress={() => date && handleCalendarDateSelect(date)}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                        !date && styles.calendarDayTextEmpty,
                      ]}
                    >
                      {date ? date.getDate() : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginTop: 6,
    zIndex: 50,
    elevation: 20,
  },
  inlineFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    marginTop: 8,
    position: 'relative',
    zIndex: 60,
  },
  dateFiltersRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  dateInputWrap: {
    flex: 1,
    height: 44,
    borderRadius: 18,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 14,
    justifyContent: 'center',
    shadowColor: '#0B2A45',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  dateInputText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
  dateFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  datePlaceholderText: {
    color: '#66717B',
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
  groupMarkerTapArea: {
    minWidth: 24,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupMarkerRow: {
    height: 24,
    justifyContent: 'center',
  },
  groupMarkerBubble: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLORS.WHITE,
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
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
    marginTop: 12,
    marginHorizontal: 20,
    paddingHorizontal: 18,
   
    borderRadius: 24,
  
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
    // color: '#56616C',
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: COLORS.WHITE,
    padding: 18,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calendarNavText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    width: 28,
    textAlign: 'center',
  },
  calendarTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    color: '#66717B',
    fontSize: 12,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  calendarDayCellSelected: {
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  calendarDayCellEmpty: {
    opacity: 0,
  },
  calendarDayText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  calendarDayTextSelected: {
    color: COLORS.WHITE,
  },
  calendarDayTextEmpty: {
    color: 'transparent',
  },
});
