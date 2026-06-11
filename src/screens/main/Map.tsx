// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
// import {
//   Dimensions,
//   Keyboard,
//   Modal,
//   Pressable,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import Mapbox, {
//   type FillLayerStyle,
//   type LineLayerStyle,
//   type SymbolLayerStyle,
// } from '@rnmapbox/maps';
// import Config from 'react-native-config';
// import type { FeatureCollection, Point, Polygon } from 'geojson';
// import EventDetailModal from '../../components/modals/EventDetailModal';
// import TopHeader from '../../components/Home/TopHeader';
// import { COLORS } from '../../constants/colors';
// import { FONT_FAMILY } from '../../constants/fonts';
// import { CrossIcon, DropdownIcon, SearchIcon, BlueMapIcon, PodcastEvent, PrideEvent } from '../../constants/icons';
// import {
//   fetchMapEvents,
//   searchLocationSuggestions,
//   type FirebaseEvent,
//   type LocationSuggestion,
// } from '../../services/myTourService';
// import { isPodcastEvent } from '../../utils/eventHelpers';

// const BG_MATCH = '#8ECAE6';
// const INITIAL_CAMERA_CENTER: [number, number] = [-18, 18];
// const INITIAL_CAMERA_ZOOM = 0.8;
// const SEARCH_DEBOUNCE_MS = 350;

// // --- Auto-zoom / marker spreading tuning -----------------------------------
// // How tightly the auto-fit is allowed to zoom. MAX keeps a dense cluster from
// // snapping uncomfortably close; MIN keeps a country-wide spread from zooming
// // all the way out to the globe.
// // const MAX_FIT_ZOOM = 16;
// const MAX_FIT_ZOOM = 16;
// // const MIN_FIT_ZOOM = 3.5;
// const MIN_FIT_ZOOM = 2.5;
// // Zoom used when a city has exactly one event, or when the user taps a marker.
// const SINGLE_EVENT_ZOOM = 14.5;
// const EVENT_FOCUS_ZOOM = 16.5;
// // Pixels reserved around the markers so the 48px icons never clip the map edge
// // or sit under the floating zoom buttons / legend / date filters.
// const FIT_PADDING = { top: 100, right: 80, bottom: 150, left: 80 };
// // Minimum on-screen gap (in pixels) enforced between any two marker centres so
// // the 48px icons never hide behind one another. Decluttering runs in pixel
// // space at the current zoom, so this holds at every zoom level.
// const MARKER_SEPARATION_PX = 70;

// type DateField = 'start' | 'end';

// const clamp = (value: number, min: number, max: number) =>
//   Math.min(Math.max(value, min), max);

// // Standard Google-Maps "bounds zoom" computation: returns the highest zoom at
// // which the given lat/lng box still fits inside `viewWidth` x `viewHeight`
// // pixels. Unlike a raw fitBounds it lets us clamp the result so identical /
// // near-identical markers don't force an extreme zoom.
// const WORLD_TILE_SIZE = 512;

// const latRadians = (lat: number) => {
//   const sin = Math.sin((lat * Math.PI) / 180);
//   const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
//   return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
// };

// const getBoundsZoom = (
//   ne: { lat: number; lng: number },
//   sw: { lat: number; lng: number },
//   viewWidth: number,
//   viewHeight: number
// ) => {
//   const latFraction = (latRadians(ne.lat) - latRadians(sw.lat)) / Math.PI;
//   const lngDiff = ne.lng - sw.lng;
//   const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

//   // A zero fraction means a single point (or a single line) — let the caller's
//   // clamp decide the final zoom instead of producing Infinity.
//   const latZoom = latFraction > 0 ? Math.log2(viewHeight / WORLD_TILE_SIZE / latFraction) : MAX_FIT_ZOOM;
//   const lngZoom = lngFraction > 0 ? Math.log2(viewWidth / WORLD_TILE_SIZE / lngFraction) : MAX_FIT_ZOOM;

//   return Math.min(latZoom, lngZoom);
// };

// // The single source of truth for "where the camera should sit to show this set
// // of events". Used both to drive the camera AND to pick the (stable) zoom we
// // declutter markers at — so the two never disagree and markers don't jump.
// const computeFitCamera = (
//   coordinates: [number, number][],
//   viewWidth: number,
//   viewHeight: number
// ): { center: [number, number]; zoom: number } => {
//   const lngs = coordinates.map((c) => c[0]);
//   const lats = coordinates.map((c) => c[1]);
//   const minLng = Math.min(...lngs);
//   const maxLng = Math.max(...lngs);
//   const minLat = Math.min(...lats);
//   const maxLat = Math.max(...lats);
//   const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

//   if (coordinates.length === 1) {
//     return { center, zoom: SINGLE_EVENT_ZOOM };
//   }

//   const availableWidth = Math.max(viewWidth - FIT_PADDING.left - FIT_PADDING.right, 1);
//   const availableHeight = Math.max(viewHeight - FIT_PADDING.top - FIT_PADDING.bottom, 1);
//   const zoom = clamp(
//     getBoundsZoom(
//       { lat: maxLat, lng: maxLng },
//       { lat: minLat, lng: minLng },
//       availableWidth,
//       availableHeight
//     ),
//     MIN_FIT_ZOOM,
//     MAX_FIT_ZOOM
//   );
//   return { center, zoom };
// };

// const PRIDE_BANDS: { color: string; minLon: number; maxLon: number }[] = [
//   { color: '#FF5C0A', minLon: -180, maxLon: -120 },
//   { color: '#F39A22', minLon: -120, maxLon: -60 },
//   { color: '#FFE100', minLon: -60, maxLon: -20 },
//   { color: '#95D600', minLon: -20, maxLon: 20 },
//   { color: '#31C93A', minLon: 20, maxLon: 60 },
//   { color: '#249D78', minLon: 60, maxLon: 100 },
//   { color: '#3367CC', minLon: 100, maxLon: 140 },
//   { color: '#A11FD6', minLon: 140, maxLon: 180 },
// ];

// const prideStripes: FeatureCollection<Polygon> = {
//   type: 'FeatureCollection',
//   features: PRIDE_BANDS.map((band) => ({
//     type: 'Feature',
//     properties: { color: band.color },
//     geometry: {
//       type: 'Polygon',
//       coordinates: [[
//         [band.minLon, -90],
//         [band.maxLon, -90],
//         [band.maxLon, 90],
//         [band.minLon, 90],
//         [band.minLon, -90],
//       ]],
//     },
//   })),
// };

// const prideFillStyle: FillLayerStyle = {
//   fillColor: ['get', 'color'],
//   fillOpacity: 1,
// };

// const landFillStyle: FillLayerStyle = {
//   fillColor: '#F4F6F8',
//   fillOpacity: 1,
// };

// const waterFillStyle: FillLayerStyle = {
//   fillColor: '#5BA4D4',
//   fillOpacity: 1,
// };

// const roadCasingStyle: LineLayerStyle = {
//   lineColor: '#FFFFFF',
//   lineWidth: ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 2.5, 14, 5, 18, 10],
//   lineOpacity: 1,
//   lineCap: 'round',
//   lineJoin: 'round',
// };

// const roadFillStyle: LineLayerStyle = {
//   lineColor: '#C5CDD6',
//   lineWidth: ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 1.6, 14, 3.2, 18, 7],
//   lineOpacity: 1,
//   lineCap: 'round',
//   lineJoin: 'round',
// };

// const placeLabelStyle: SymbolLayerStyle = {
//   textField: ['coalesce', ['get', 'name_en'], ['get', 'name'], ['get', 'name_fr']],
//   textSize: ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 12, 10, 14, 14, 16],
//   textColor: '#1E293B',
//   textHaloColor: '#FFFFFF',
//   textHaloWidth: 2.5,
//   textHaloBlur: 0.35,
//   textAnchor: 'center',
//   textAllowOverlap: false,
//   textOptional: true,
//   textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
//   symbolSortKey: ['get', 'symbolrank'],
// };

// const atmosphereStyle = {
//   color: BG_MATCH,
//   highColor: BG_MATCH,
//   horizonBlend: 0,
//   spaceColor: BG_MATCH,
//   starIntensity: 0,
// };

// const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

// const buildLocationLabel = (city?: string, country?: string) =>
//   [city, country].filter(Boolean).join(', ');

// const eventMatchesFilter = (event: FirebaseEvent, filterLabel: string) => {
//   const normalizedFilter = normalizeText(filterLabel);
//   if (!normalizedFilter) {
//     return true;
//   }

//   const haystack = [
//     event.city_name,
//     event.country,
//     buildLocationLabel(event.city_name, event.country),
//     event.address,
//     event.title,
//   ]
//     .filter(Boolean)
//     .join(' ')
//     .toLowerCase();

//   return haystack.includes(normalizedFilter);
// };

// const eventCoordinate = (event: FirebaseEvent): [number, number] => [
//   Number(event.coordinates?.longitude || 0),
//   Number(event.coordinates?.latitude || 0),
// ];

// type EventMarker = { event: FirebaseEvent; coordinate: [number, number] };

// // --- Web-Mercator pixel projection (single 512px world tile) ----------------
// // We project markers to absolute world pixels at a given zoom so we can measure
// // and enforce their on-screen distance, then project back to lng/lat.
// const projectToPixels = (lng: number, lat: number, zoom: number) => {
//   const scale = WORLD_TILE_SIZE * Math.pow(2, zoom);
//   const clampedLat = Math.max(Math.min(lat, 85.05112878), -85.05112878);
//   const sin = Math.sin((clampedLat * Math.PI) / 180);
//   return {
//     x: ((lng + 180) / 360) * scale,
//     y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
//   };
// };

// const unprojectFromPixels = (x: number, y: number, zoom: number): [number, number] => {
//   const scale = WORLD_TILE_SIZE * Math.pow(2, zoom);
//   const lng = (x / scale) * 360 - 180;
//   const n = Math.PI - (2 * Math.PI * y) / scale;
//   const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
//   return [lng, lat];
// };

// // Pushes apart any markers that would render closer than `separation` pixels at
// // the given zoom, so every marker stays visible and individually tappable — no
// // matter how many share the same (or nearly the same) coordinate. As the user
// // zooms in, real distances exceed the separation and markers settle back onto
// // their true locations automatically.
// const declusterMarkers = (
//   list: FirebaseEvent[],
//   zoom: number,
//   separation: number
// ): EventMarker[] => {
//   const points = list.map((event, index) => {
//     const [lng, lat] = eventCoordinate(event);
//     const projected = projectToPixels(lng, lat, zoom);
//     // Tiny deterministic jitter so exact duplicates get a defined push direction.
//     return {
//       event,
//       x: projected.x + ((index % 7) - 3) * 0.01,
//       y: projected.y + ((index % 5) - 2) * 0.01,
//     };
//   });

//   // Two markers can only collide if they are within `separation` px, i.e. within
//   // one grid cell of that size. So each pass we only compare a marker against the
//   // handful in its own and the 8 neighbouring cells — this keeps the whole thing
//   // near-linear and able to handle thousands of points instead of O(n²).
//   const cellSize = separation;
//   const cellKey = (x: number, y: number) =>
//     `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;

//   const maxIterations = 60;
//   for (let iteration = 0; iteration < maxIterations; iteration += 1) {
//     const grid = new globalThis.Map<string, number[]>();
//     points.forEach((point, index) => {
//       const key = cellKey(point.x, point.y);
//       const bucket = grid.get(key);
//       if (bucket) {
//         bucket.push(index);
//       } else {
//         grid.set(key, [index]);
//       }
//     });

//     let moved = false;
//     for (let i = 0; i < points.length; i += 1) {
//       const baseCellX = Math.floor(points[i].x / cellSize);
//       const baseCellY = Math.floor(points[i].y / cellSize);
//       for (let gx = -1; gx <= 1; gx += 1) {
//         for (let gy = -1; gy <= 1; gy += 1) {
//           const candidates = grid.get(`${baseCellX + gx}:${baseCellY + gy}`);
//           if (!candidates) continue;
//           for (const j of candidates) {
//             if (j <= i) continue;
//             let dx = points[j].x - points[i].x;
//             let dy = points[j].y - points[i].y;
//             let distance = Math.hypot(dx, dy);
//             if (distance < separation) {
//               if (distance === 0) {
//                 dx = Math.cos(i);
//                 dy = Math.sin(i);
//                 distance = 1;
//               }
//               const shift = (separation - distance) / 2;
//               const nx = dx / distance;
//               const ny = dy / distance;
//               points[i].x -= nx * shift;
//               points[i].y -= ny * shift;
//               points[j].x += nx * shift;
//               points[j].y += ny * shift;
//               moved = true;
//             }
//           }
//         }
//       }
//     }
//     if (!moved) {
//       break;
//     }
//   }

//   return points.map((point) => ({
//     event: point.event,
//     coordinate: unprojectFromPixels(point.x, point.y, zoom),
//   }));
// };

// const EventMarkerIcon = ({
//   event,
//   size = 71,
// }: {
//   event: FirebaseEvent;
//   size?: number;
// }) =>
//   isPodcastEvent(event) ? (
//     <PodcastEvent width={size} height={size} />
//   ) : (
//     <PrideEvent width={size} height={size} />
//   );

// const formatDateValue = (date: Date) => {
//   const year = date.getFullYear();
//   const month = `${date.getMonth() + 1}`.padStart(2, '0');
//   const day = `${date.getDate()}`.padStart(2, '0');
//   return `${year}-${month}-${day}`;
// };

// const buildCalendarDays = (monthDate: Date) => {
//   const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
//   const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
//   const daysInMonth = end.getDate();
//   const firstWeekday = start.getDay();
//   const cells: Array<Date | null> = [];

//   for (let index = 0; index < firstWeekday; index += 1) {
//     cells.push(null);
//   }

//   for (let day = 1; day <= daysInMonth; day += 1) {
//     cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
//   }

//   while (cells.length % 7 !== 0) {
//     cells.push(null);
//   }

//   return cells;
// };

// const parseDateOnly = (value?: string | null) => {
//   if (!value) return null;
//   const trimmed = value.trim();
//   if (!trimmed) return null;
//   const parsed = new Date(trimmed);
//   if (Number.isNaN(parsed.getTime())) return null;
//   parsed.setHours(0, 0, 0, 0);
//   return parsed;
// };

// const eventMatchesDateRange = (
//   event: FirebaseEvent,
//   startDateFilter: string,
//   endDateFilter: string
// ) => {
//   const filterStart = parseDateOnly(startDateFilter);
//   const filterEnd = parseDateOnly(endDateFilter);

//   if (!filterStart && !filterEnd) {
//     return true;
//   }

//   const eventStart = parseDateOnly(event.startDate) || parseDateOnly(event.endDate);
//   const eventEnd = parseDateOnly(event.endDate) || eventStart;

//   if (!eventStart && !eventEnd) {
//     return false;
//   }

//   const rangeStart = eventStart || eventEnd;
//   const rangeEnd = eventEnd || eventStart;

//   if (filterStart && rangeEnd && rangeEnd < filterStart) {
//     return false;
//   }

//   if (filterEnd && rangeStart && rangeStart > filterEnd) {
//     return false;
//   }

//   return true;
// };

// const Map = () => {
//   const bottomTabBarHeight = useBottomTabBarHeight();
//   const cameraRef = useRef<Mapbox.Camera>(null);
//   const [mapReady, setMapReady] = useState(false);
//   const [zoomLevel, setZoomLevel] = useState(INITIAL_CAMERA_ZOOM);
//   const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
//   const [events, setEvents] = useState<FirebaseEvent[]>([]);
//   const [searchText, setSearchText] = useState('');
//   const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
//   const [selectedEvent, setSelectedEvent] = useState<FirebaseEvent | null>(null);
//   const [searchSuggestions, setSearchSuggestions] = useState<LocationSuggestion[]>([]);
//   const [showSuggestions, setShowSuggestions] = useState(false);
//   const [startDateFilter, setStartDateFilter] = useState('');
//   const [endDateFilter, setEndDateFilter] = useState('');
//   const [calendarVisible, setCalendarVisible] = useState(false);
//   const [activeDateField, setActiveDateField] = useState<DateField>('start');
//   const [calendarMonth, setCalendarMonth] = useState(() => {
//     const today = new Date();
//     return new Date(today.getFullYear(), today.getMonth(), 1);
//   });

//   useEffect(() => {
//     let isMounted = true;
//     if (!Config.MAPBOX_TOKEN) return undefined;

//     Mapbox.setAccessToken(Config.MAPBOX_TOKEN)
//       .then(() => {
//         if (isMounted) {
//           setMapReady(true);
//           setZoomLevel(INITIAL_CAMERA_ZOOM);
//         }
//       })
//       .catch(() => {
//         if (isMounted) {
//           setMapReady(false);
//         }
//       });

//     return () => {
//       isMounted = false;
//     };
//   }, []);

//   useEffect(() => {
//     let isMounted = true;

//     fetchMapEvents()
//       .then((response) => {
//         if (isMounted) {
//           setEvents(response);
//         }
//       })
//       .catch(() => {
//         if (isMounted) {
//           setEvents([]);
//         }
//       });

//     return () => {
//       isMounted = false;
//     };
//   }, []);

//   useEffect(() => {
//     if (selectedLocation || searchText.trim().length < 2) {
//       setSearchSuggestions([]);
//       return undefined;
//     }

//     const timeoutId = setTimeout(() => {
//       searchLocationSuggestions(searchText)
//         .then((results) => {
//           setSearchSuggestions(results);
//           setShowSuggestions(true);
//         })
//         .catch(() => {
//           setSearchSuggestions([]);
//         });
//     }, SEARCH_DEBOUNCE_MS);

//     return () => clearTimeout(timeoutId);
//   }, [searchText, selectedLocation]);

//   const filteredEvents = useMemo(() => {
//     const filterLabel = selectedLocation?.label || '';
//     return events.filter(
//       (event) =>
//         eventMatchesFilter(event, filterLabel) &&
//         eventMatchesDateRange(event, startDateFilter, endDateFilter)
//     );
//   }, [endDateFilter, events, selectedLocation, startDateFilter]);

//   // The camera target for the focused city. Computed once per
//   // search/filter/layout change — NOT on every zoom frame — so it stays stable.
//   const cityFit = useMemo(() => {
//     if (!selectedLocation || filteredEvents.length === 0) {
//       return null;
//     }
//     const width = mapLayout.width || Dimensions.get('window').width;
//     const height = mapLayout.height || Dimensions.get('window').height * 0.5;
//     return computeFitCamera(filteredEvents.map(eventCoordinate), width, height);
//   }, [filteredEvents, selectedLocation, mapLayout]);

//   const mapEventMarkers = useMemo(() => {
//     // Only declutter once the user has focused a city. On the global globe view
//     // markers should stay in their real countries (and pushing hundreds apart by
//     // a pixel gap would scatter them across continents and be expensive).
//     if (!selectedLocation) {
//       return filteredEvents.map((event) => ({
//         event,
//         coordinate: eventCoordinate(event),
//       }));
//     }
//     // Declutter at the STABLE fit zoom (not the live camera zoom). Because the
//     // positions no longer depend on the moment-to-moment zoom, markers hold
//     // their place while the user zooms instead of vibrating/recomputing.
//     const declustered = declusterMarkers(
//       filteredEvents,
//       cityFit?.zoom ?? SINGLE_EVENT_ZOOM,
//       MARKER_SEPARATION_PX
//     );

//     // Decluttering spreads co-located markers apart for visibility, which moves
//     // them off their true coordinate. So the marker the user has tapped is
//     // pinned back to its EXACT real location — tapping always reveals the true
//     // spot, while the rest stay spread out.
//     if (!selectedEvent) {
//       return declustered;
//     }
//     return declustered.map((marker) =>
//       marker.event.id === selectedEvent.id
//         ? { event: marker.event, coordinate: eventCoordinate(marker.event) }
//         : marker
//     );
//   }, [filteredEvents, selectedLocation, cityFit, selectedEvent]);



//   const focusLocation = useCallback((location: LocationSuggestion) => {
//     if (!location.coordinates) {
//       return;
//     }

//     const matchingEvents = events.filter(
//       (event) =>
//         eventMatchesFilter(event, location.label) &&
//         eventMatchesDateRange(event, startDateFilter, endDateFilter)
//     );

//     // CASE 1: No events → just move camera to the city itself.
//     if (matchingEvents.length === 0) {
//       cameraRef.current?.setCamera({
//         centerCoordinate: location.coordinates,
//         zoomLevel: 4.5,
//         pitch: 0,
//         heading: 0,
//         animationDuration: 1200,
//         animationMode: 'flyTo',
//       });
//       setZoomLevel(4.5);
//       return;
//     }

//     // CASE 2: One or more events → compute the exact zoom that fits every marker
//     // inside the visible map area (minus padding for icons + floating controls).
//     // Uses the SAME helper that the markers are decluttered with, so the camera
//     // and the marker layout always agree. Shows them all at once without any
//     // hiding behind the others, and never zooms uncomfortably close or far.
//     const width = mapLayout.width || Dimensions.get('window').width;
//     const height = mapLayout.height || Dimensions.get('window').height * 0.5;
//     const { center, zoom } = computeFitCamera(
//       matchingEvents.map(eventCoordinate),
//       width,
//       height
//     );

//     cameraRef.current?.setCamera({
//       centerCoordinate: center,
//       zoomLevel: zoom,
//       pitch: 0,
//       heading: 0,
//       animationDuration: 1300,
//       animationMode: 'flyTo',
//     });
//     setZoomLevel(zoom);
//   }, [events, startDateFilter, endDateFilter, mapLayout]);
//   const openCalendar = useCallback((field: DateField) => {
//     const currentValue = field === 'start' ? startDateFilter : endDateFilter;
//     const parsed = parseDateOnly(currentValue) || new Date();
//     setActiveDateField(field);
//     setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
//     setCalendarVisible(true);
//   }, [endDateFilter, startDateFilter]);

//   const closeCalendar = useCallback(() => {
//     setCalendarVisible(false);
//   }, []);

//   const handleCalendarDateSelect = useCallback((date: Date) => {
//     const nextValue = formatDateValue(date);
//     if (activeDateField === 'start') {
//       setStartDateFilter(nextValue);
//     } else {
//       setEndDateFilter(nextValue);
//     }
//     setCalendarVisible(false);
//   }, [activeDateField]);

//   const handleSuggestionPress = useCallback(
//     (suggestion: LocationSuggestion) => {
//       setSelectedLocation(suggestion);
//       setSearchText(suggestion.label);
//       setShowSuggestions(false);
//       setSearchSuggestions([]);
//       Keyboard.dismiss();
//       focusLocation(suggestion);
//     },
//     [focusLocation]
//   );

//   useEffect(() => {
//     if (!selectedLocation) {
//       return;
//     }

//     focusLocation(selectedLocation);
//   }, [selectedLocation, startDateFilter, endDateFilter, focusLocation]);

//   const handleClearFilter = useCallback(() => {
//     setSelectedLocation(null);
//     setSearchText('');
//     setSearchSuggestions([]);
//     setShowSuggestions(false);
//     setStartDateFilter('');
//     setEndDateFilter('');
//     cameraRef.current?.setCamera({
//       centerCoordinate: INITIAL_CAMERA_CENTER,
//       zoomLevel: INITIAL_CAMERA_ZOOM,
//       pitch: 0,
//       heading: 0,
//       animationDuration: 1400,
//       animationMode: 'flyTo',
//     });
//     setZoomLevel(INITIAL_CAMERA_ZOOM);
//   }, []);

//   const handleSearchTextChange = useCallback((text: string) => {
//     setSearchText(text);
//     setSelectedLocation(null);
//     setShowSuggestions(true);
//   }, []);

//   const handleClearSearch = useCallback(() => {
//     setSearchText('');
//     setSelectedLocation(null);
//     setSearchSuggestions([]);
//     setShowSuggestions(false);
//   }, []);

//   const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
//   const activeDateValue = activeDateField === 'start' ? startDateFilter : endDateFilter;
//   const selectedCalendarValue = parseDateOnly(activeDateValue);

//   const handleMarkerPress = useCallback(
//     (event: FirebaseEvent) => {
//       setSelectedEvent(event);
//       // Google-Maps style: fly to the event's EXACT real coordinate (not the
//       // decluttered/spread position) and zoom hard onto it. The marker itself is
//       // simultaneously pinned back to this true coordinate in mapEventMarkers, so
//       // the pin and the camera centre line up on the real location.
//       const target = eventCoordinate(event);
//       const nextZoom = Math.max(zoomLevel, EVENT_FOCUS_ZOOM);
//       cameraRef.current?.setCamera({
//         centerCoordinate: target,
//         zoomLevel: nextZoom,
//         pitch: 0,
//         heading: 0,
//         animationDuration: 800,
//         animationMode: 'flyTo',
//       });
//       setZoomLevel(nextZoom);
//     },
//     [zoomLevel]
//   );

//   const handleCloseSelectedEvent = useCallback(() => {
//     setSelectedEvent(null);
//   }, []);


//   const handleZoom = useCallback((direction: 'in' | 'out') => {
//     const nextZoom =
//       direction === 'in'
//         ? Math.min(zoomLevel + 0.8, 18)
//         : Math.max(zoomLevel - 0.8, 0.8);

//     cameraRef.current?.setCamera({
//       zoomLevel: nextZoom,
//       animationDuration: 450,
//     });
//     setZoomLevel(nextZoom);
//   }, [zoomLevel]);

//   return (
//     <View style={styles.container}>
//       <TopHeader title="Map" />
//       <View style={styles.controlsWrap}>
//         <View style={styles.inlineFilterHeader}>
//           <Text style={styles.controlsTitle}>Explore By City</Text>
//           {selectedLocation ? (
//             <TouchableOpacity
//               activeOpacity={0.85}
//               onPress={handleClearFilter}
//               style={styles.resetPill}
//             >
//               <Text style={styles.resetPillText}>Clear</Text>
//             </TouchableOpacity>
//           ) : null}
//         </View>

//         <ScrollView
//           horizontal
//           showsHorizontalScrollIndicator={false}
//           contentContainerStyle={styles.quickCitiesContent}
//         >
//           {/* {QUICK_CITIES.map((city) => {
//             const isActive = selectedLocation?.id === city.id;
//             return (
//               <TouchableOpacity
//                 key={city.id}
//                 activeOpacity={0.85}
//                 style={[styles.quickCityChip, isActive && styles.quickCityChipActive]}
//                 onPress={() => handleQuickCityPress(city)}
//               >
//                 <Text
//                   style={[
//                     styles.quickCityChipText,
//                     isActive && styles.quickCityChipTextActive,
//                   ]}
//                 >
//                   {city.label}
//                 </Text>
//               </TouchableOpacity>
//             );
//           })} */}
//         </ScrollView>

//         <View style={styles.searchBlock}>
//           <View style={styles.citySearchWrap}>
//             <View style={styles.citySearchInputWrap}>
//               <SearchIcon width={18} height={18} />
//               <TextInput
//                 value={searchText}
//                 onChangeText={handleSearchTextChange}
//                 placeholder="Search any city in the world"
//                 placeholderTextColor="#66717B"
//                 style={styles.citySearchInput}
//                 onFocus={() => setShowSuggestions(true)}
//               />
//             </View>
//             {searchText || selectedLocation ? (
//               <TouchableOpacity
//                 activeOpacity={0.85}
//                 hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
//                 onPress={handleClearSearch}
//               >
//                 <CrossIcon width={12} height={12} />
//               </TouchableOpacity>
//             ) : (
//               <DropdownIcon width={11} height={6} />
//             )}
//           </View>

//           {showSuggestions && searchSuggestions.length > 0 ? (
//             <View style={styles.suggestionsCard}>
//               <ScrollView
//                 nestedScrollEnabled
//                 keyboardShouldPersistTaps="handled"
//                 showsVerticalScrollIndicator={false}
//                 style={styles.suggestionsScroll}
//               >
//                 {searchSuggestions.map((suggestion) => (
//                   <TouchableOpacity
//                     key={suggestion.id}
//                     activeOpacity={0.85}
//                     style={styles.suggestionRow}
//                     onPress={() => handleSuggestionPress(suggestion)}
//                   >
//                     <Text style={styles.suggestionTitle}>{suggestion.label}</Text>
//                   </TouchableOpacity>
//                 ))}
//               </ScrollView>
//             </View>
//           ) : null}
//         </View>

//         <View style={styles.dateFiltersRow}>
//           <TouchableOpacity
//             activeOpacity={0.85}
//             style={styles.dateInputWrap}
//             onPress={() => openCalendar('start')}
//           >
//             <View style={styles.dateFieldRow}>
//               <Text style={[styles.dateInputText, !startDateFilter && styles.datePlaceholderText]}>
//                 {startDateFilter || 'From date'}
//               </Text>
//               {startDateFilter ? (
//                 <TouchableOpacity
//                   activeOpacity={0.85}
//                   hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
//                   onPress={(event) => {
//                     event.stopPropagation();
//                     setStartDateFilter('');
//                   }}
//                 >
//                   <CrossIcon width={12} height={12} />
//                 </TouchableOpacity>
//               ) : null}
//             </View>
//           </TouchableOpacity>
//           <TouchableOpacity
//             activeOpacity={0.85}
//             style={styles.dateInputWrap}
//             onPress={() => openCalendar('end')}
//           >
//             <View style={styles.dateFieldRow}>
//               <Text style={[styles.dateInputText, !endDateFilter && styles.datePlaceholderText]}>
//                 {endDateFilter || 'To date'}
//               </Text>
//               {endDateFilter ? (
//                 <TouchableOpacity
//                   activeOpacity={0.85}
//                   hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
//                   onPress={(event) => {
//                     event.stopPropagation();
//                     setEndDateFilter('');
//                   }}
//                 >
//                   <CrossIcon width={12} height={12} />
//                 </TouchableOpacity>
//               ) : null}
//             </View>
//           </TouchableOpacity>
//         </View>
//       </View>

//       <View style={styles.mapSection}>
//         <View style={styles.globeContainer}>
//           {Config.MAPBOX_TOKEN && mapReady ? (
//             <View
//               style={styles.mapShell}
//               onLayout={(event) => {
//                 const { width, height } = event.nativeEvent.layout;
//                 setMapLayout((prev) =>
//                   prev.width === width && prev.height === height
//                     ? prev
//                     : { width, height }
//                 );
//               }}
//             >
//               <Mapbox.MapView
//                 style={styles.map}
//                 styleURL={Mapbox.StyleURL.Light}
//                 projection="globe"
//                 logoEnabled={false}
//                 attributionEnabled={false}
//                 compassEnabled={false}
//                 scaleBarEnabled={false}
//                 rotateEnabled
//                 pitchEnabled={false}
//                 scrollEnabled
//                 zoomEnabled
//                 surfaceView={false}
//                 onCameraChanged={(state: any) => {
//                   const z = state?.properties?.zoom;
//                   if (typeof z === 'number') setZoomLevel(z);
//                 }}
//                 onPress={() => {
//                   setShowSuggestions(false);
//                   setSelectedEvent(null);
//                 }}
//               >
//                 <Mapbox.Camera
//                   ref={cameraRef}
//                   defaultSettings={{
//                     centerCoordinate: INITIAL_CAMERA_CENTER,
//                     zoomLevel: INITIAL_CAMERA_ZOOM,
//                     pitch: 0,
//                     heading: 0,
//                   }}
//                 />
//                 <Mapbox.Atmosphere style={atmosphereStyle} />
//                 <Mapbox.ShapeSource id="prideStripes" shape={prideStripes}>
//                   <Mapbox.FillLayer
//                     id="prideStripesFill"
//                     style={prideFillStyle}
//                     belowLayerID="water"
//                   />
//                 </Mapbox.ShapeSource>
//                 <Mapbox.VectorSource
//                   id="composite"
//                   url="mapbox://mapbox.mapbox-streets-v8"
//                   existing
//                 >
//                   <Mapbox.FillLayer
//                     id="customLandFill"
//                     sourceID="composite"
//                     sourceLayerID="landuse"
//                     style={landFillStyle}
//                     filter={['==', ['geometry-type'], 'Polygon']}
//                   />
//                   <Mapbox.FillLayer
//                     id="customWaterFill"
//                     sourceID="composite"
//                     sourceLayerID="water"
//                     style={waterFillStyle}
//                   />
//                   <Mapbox.LineLayer
//                     id="customRoadCasing"
//                     sourceID="composite"
//                     sourceLayerID="road"
//                     style={roadCasingStyle}
//                   />
//                   <Mapbox.LineLayer
//                     id="customRoadFill"
//                     sourceID="composite"
//                     sourceLayerID="road"
//                     style={roadFillStyle}
//                     aboveLayerID="customRoadCasing"
//                   />
//                   <Mapbox.SymbolLayer
//                     id="customPlaceLabels"
//                     sourceID="composite"
//                     sourceLayerID="place_label"
//                     style={placeLabelStyle}
//                     aboveLayerID="customRoadFill"
//                   />
//                 </Mapbox.VectorSource>

//                 {mapEventMarkers.map(({ event, coordinate }) => (
//                   <Mapbox.MarkerView
//                     key={event.id}
//                     id={`map-event-${event.id}`}
//                     coordinate={coordinate}
//                     anchor={{ x: 0.5, y: 0.5 }}
//                   >
//                     <TouchableOpacity
//                       activeOpacity={0.85}
//                       accessibilityRole="button"
//                       accessibilityLabel={`Show ${isPodcastEvent(event) ? 'podcast' : 'pride'} event ${event.title}`}
//                       onPress={() => handleMarkerPress(event)}
//                       style={styles.eventMapMarker}
//                     >
//                       <EventMarkerIcon event={event} size={48} />
//                     </TouchableOpacity>
//                   </Mapbox.MarkerView>
//                 ))}
//               </Mapbox.MapView>

//               <View style={[styles.zoomControls]}>
//                 <TouchableOpacity
//                   activeOpacity={0.85}
//                   style={[styles.zoomButton, styles.zoomButtonTop]}
//                   onPress={() => handleZoom('in')}
//                 >
//                   <Text style={styles.zoomButtonText}>+</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   activeOpacity={0.85}
//                   style={styles.zoomButton}
//                   onPress={() => handleZoom('out')}
//                 >
//                   <Text style={styles.zoomButtonText}>-</Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           ) : (
//             <View style={styles.mapFallback}>
//               <Text style={styles.mapFallbackText}>
//                 {Config.MAPBOX_TOKEN ? 'Loading map...' : 'Mapbox token missing'}
//               </Text>
//             </View>
//           )}
//         </View>
//       </View>

//       <View style={[styles.legendCard, { marginBottom: 5 }]}>
//         <View style={styles.legendRow}>
//           <PrideEvent width={24} height={24}/>
//           <Text style={styles.legendText}>Purple markers show Pride events.</Text>
//         </View>
//         <View style={styles.legendRow}>
//           <PodcastEvent height={24} width={24}/>
//           <Text style={styles.legendText}>
//             Blue markers show Podcast events.
//           </Text>
//         </View>
//       </View>

//       <EventDetailModal
//         visible={Boolean(selectedEvent)}
//         event={selectedEvent}
//         onClose={handleCloseSelectedEvent}
//         variant="compact"
//       />

//       <Modal
//         visible={calendarVisible}
//         transparent
//         animationType="fade"
//         onRequestClose={closeCalendar}
//       >
//         <Pressable style={styles.calendarOverlay} onPress={closeCalendar}>
//           <Pressable style={styles.calendarCard} onPress={() => { }}>
//             <View style={styles.calendarHeader}>
//               <TouchableOpacity
//                 activeOpacity={0.85}
//                 onPress={() =>
//                   setCalendarMonth(
//                     new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
//                   )
//                 }
//               >
//                 <Text style={styles.calendarNavText}>{'<'}</Text>
//               </TouchableOpacity>
//               <Text style={styles.calendarTitle}>
//                 {calendarMonth.toLocaleDateString('en-US', {
//                   month: 'long',
//                   year: 'numeric',
//                 })}
//               </Text>
//               <TouchableOpacity
//                 activeOpacity={0.85}
//                 onPress={() =>
//                   setCalendarMonth(
//                     new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
//                   )
//                 }
//               >
//                 <Text style={styles.calendarNavText}>{'>'}</Text>
//               </TouchableOpacity>
//             </View>

//             <View style={styles.calendarWeekRow}>
//               {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
//                 <Text key={`${day}-${index}`} style={styles.calendarWeekday}>
//                   {day}
//                 </Text>
//               ))}
//             </View>

//             <View style={styles.calendarGrid}>
//               {calendarDays.map((date, index) => {
//                 const isSelected =
//                   Boolean(date) &&
//                   Boolean(selectedCalendarValue) &&
//                   formatDateValue(date as Date) === formatDateValue(selectedCalendarValue as Date);

//                 return (
//                   <TouchableOpacity
//                     key={`${date ? formatDateValue(date) : 'empty'}-${index}`}
//                     activeOpacity={0.85}
//                     disabled={!date}
//                     style={[
//                       styles.calendarDayCell,
//                       isSelected && styles.calendarDayCellSelected,
//                       !date && styles.calendarDayCellEmpty,
//                     ]}
//                     onPress={() => date && handleCalendarDateSelect(date)}
//                   >
//                     <Text
//                       style={[
//                         styles.calendarDayText,
//                         isSelected && styles.calendarDayTextSelected,
//                         !date && styles.calendarDayTextEmpty,
//                       ]}
//                     >
//                       {date ? date.getDate() : ''}
//                     </Text>
//                   </TouchableOpacity>
//                 );
//               })}
//             </View>
//           </Pressable>
//         </Pressable>
//       </Modal>
//     </View>
//   );
// };

// export default Map;


// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: BG_MATCH,
//   },
//   eventMapMarker: {
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   mapSection: {
//     flex: 1,
//   },
//   controlsWrap: {
//     marginHorizontal: 20,
//     marginTop: 6,
//     zIndex: 50,
//     elevation: 20,
//   },
//   inlineFilterHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 6,
//   },
//   controlsTitle: {
//     color: COLORS.WHITE,
//     fontSize: 16,
//     fontFamily: FONT_FAMILY.InterTight_SemiBold,
//   },
//   resetPill: {
//     height: 32,
//     paddingHorizontal: 14,
//     borderRadius: 16,
//     backgroundColor: 'rgba(255,255,255,0.18)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   resetPillText: {
//     color: COLORS.WHITE,
//     fontSize: 13,
//     fontFamily: FONT_FAMILY.InterTight_SemiBold,
//   },
//   quickCitiesContent: {
//     paddingRight: 8,
//     gap: 10,
//   },
//   quickCityChip: {
//     height: 38,
//     paddingHorizontal: 16,
//     borderRadius: 19,
//     backgroundColor: 'rgba(255,255,255,0.16)',
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.28)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   quickCityChipActive: {
//     backgroundColor: COLORS.WHITE,
//     borderColor: COLORS.WHITE,
//   },
//   quickCityChipText: {
//     color: COLORS.WHITE,
//     fontSize: 13,
//     fontFamily: FONT_FAMILY.InterTight_Medium,
//   },
//   quickCityChipTextActive: {
//     color: COLORS.PRIMARY || '#1888E7',
//   },
//   citySearchWrap: {
//     height: 52,
//     borderRadius: 26,
//     backgroundColor: COLORS.WHITE,
//     paddingHorizontal: 18,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     shadowColor: '#0B2A45',
//     shadowOpacity: 0.12,
//     shadowRadius: 12,
//     shadowOffset: { width: 0, height: 8 },
//     elevation: 6,
//   },
//   searchBlock: {
//     marginTop: 8,
//     position: 'relative',
//     zIndex: 60,
//   },
//   dateFiltersRow: {
//     flexDirection: 'row',
//     gap: 10,
//     marginVertical: 8,
//   },
//   dateInputWrap: {
//     flex: 1,
//     height: 44,
//     borderRadius: 18,
//     backgroundColor: COLORS.WHITE,
//     paddingHorizontal: 14,
//     justifyContent: 'center',
//     shadowColor: '#0B2A45',
//     shadowOpacity: 0.08,
//     shadowRadius: 10,
//     shadowOffset: { width: 0, height: 6 },
//     elevation: 4,
//   },
//   dateInputText: {
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 13,
//     fontFamily: FONT_FAMILY.InterTight_Regular,
//   },
//   dateFieldRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     gap: 10,
//   },
//   datePlaceholderText: {
//     color: '#66717B',
//   },
//   citySearchInputWrap: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//   },
//   citySearchInput: {
//     flex: 1,
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 15,
//     fontFamily: FONT_FAMILY.InterTight_Regular,
//     paddingVertical: 0,
//   },
//   suggestionsCard: {
//     position: 'absolute',
//     top: 50,
//     left: 0,
//     right: 0,
//     borderRadius: 22,
//     backgroundColor: COLORS.WHITE,
//     paddingVertical: 8,
//     shadowColor: '#0B2A45',
//     shadowOpacity: 0.14,
//     shadowRadius: 14,
//     shadowOffset: { width: 0, height: 8 },
//     elevation: 7,
//     maxHeight: 220,
//     zIndex: 70,
//   },
//   suggestionsScroll: {
//     maxHeight: 220,
//   },
//   suggestionRow: {
//     paddingHorizontal: 18,
//     paddingVertical: 13,
//     borderBottomWidth: 1,
//     borderBottomColor: '#EFF3F7',
//   },
//   suggestionTitle: {
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 15,
//     fontFamily: FONT_FAMILY.InterTight_Medium,
//   },
//   globeContainer: {
//     flex: 1,
//     overflow: 'hidden',
//   },
//   mapShell: {
//     flex: 1,
//   },
//   map: {
//     flex: 1,
//   },
//   zoomControls: {
//     position: 'absolute',
//     right: 18,
//     bottom: 40,
//     borderRadius: 18,
//     overflow: 'hidden',
//     backgroundColor: 'rgba(255,255,255,0.96)',
//     shadowColor: '#0A1B2A',
//     shadowOpacity: 0.14,
//     shadowRadius: 10,
//     shadowOffset: { width: 0, height: 6 },
//     elevation: 8,
//   },
//   zoomButton: {
//     width: 44,
//     height: 44,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   zoomButtonTop: {
//     borderBottomWidth: 1,
//     borderBottomColor: '#E6EDF3',
//   },
//   zoomButtonText: {
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 24,
//     lineHeight: 28,
//     fontFamily: FONT_FAMILY.InterTight_SemiBold,
//   },
//   groupMarkerTapArea: {
//     minWidth: 24,
//     height: 34,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   groupMarkerRow: {
//     height: 24,
//     justifyContent: 'center',
//   },
//   groupMarkerBubble: {
//     position: 'absolute',
//     width: 24,
//     height: 24,
//     borderRadius: 12,
//     borderWidth: 3,
//     borderColor: COLORS.WHITE,
//     shadowColor: '#0A1B2A',
//     shadowOpacity: 0.24,
//     shadowRadius: 8,
//     shadowOffset: { width: 0, height: 4 },
//     elevation: 7,
//   },
//   mapFallback: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   mapFallbackText: {
//     color: COLORS.WHITE,
//     fontSize: 16,
//     fontFamily: FONT_FAMILY.InterTight_Medium,
//   },
//   legendCard: {
//     marginTop: 12,
//     marginHorizontal: 20,
//     paddingHorizontal: 18,

//     borderRadius: 24,

//   },
//   legendTitle: {
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 18,
//     fontFamily: FONT_FAMILY.InterTight_SemiBold,
//     marginBottom: 12,
//   },
//   legendRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 6,
//     // gap: 6
//   },
//   legendDot: {
//     width: 14,
//     height: 14,
//     borderRadius: 7,
//     marginTop: 3,
//     marginRight: 10,
//   },
//   legendDotRed: {
//     backgroundColor: '#F04452',
//   },
//   legendDotBlue: {
//     backgroundColor: '#1B84FF',
//   },
//   legendText: {
//     flex: 1,
//     // color: '#56616C',
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 14,
//     lineHeight: 20,
//     fontFamily: FONT_FAMILY.InterTight_Regular,
//   },
//   calendarOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.35)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//   },
//   calendarCard: {
//     width: '100%',
//     maxWidth: 360,
//     borderRadius: 24,
//     backgroundColor: COLORS.WHITE,
//     padding: 18,
//   },
//   calendarHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 14,
//   },
//   calendarNavText: {
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 22,
//     fontFamily: FONT_FAMILY.InterTight_SemiBold,
//     width: 28,
//     textAlign: 'center',
//   },
//   calendarTitle: {
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 17,
//     fontFamily: FONT_FAMILY.InterTight_SemiBold,
//   },
//   calendarWeekRow: {
//     flexDirection: 'row',
//     marginBottom: 8,
//   },
//   calendarWeekday: {
//     flex: 1,
//     textAlign: 'center',
//     color: '#66717B',
//     fontSize: 12,
//     fontFamily: FONT_FAMILY.InterTight_Medium,
//   },
//   calendarGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//   },
//   calendarDayCell: {
//     width: '14.2857%',
//     aspectRatio: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 18,
//   },
//   calendarDayCellSelected: {
//     backgroundColor: COLORS.BUTTON_COLOR,
//   },
//   calendarDayCellEmpty: {
//     opacity: 0,
//   },
//   calendarDayText: {
//     color: COLORS.TEXT_PRIMARY,
//     fontSize: 14,
//     fontFamily: FONT_FAMILY.InterTight_Medium,
//   },
//   calendarDayTextSelected: {
//     color: COLORS.WHITE,
//   },
//   calendarDayTextEmpty: {
//     color: 'transparent',
//   },
// });




import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  Dimensions,
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
import Mapbox, {
  type FillLayerStyle,
  type LineLayerStyle,
  type SymbolLayerStyle,
} from '@rnmapbox/maps';
import Config from 'react-native-config';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import EventDetailModal from '../../components/modals/EventDetailModal';
import TopHeader from '../../components/Home/TopHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';
import { CrossIcon, DropdownIcon, SearchIcon, BlueMapIcon, PodcastEvent, PrideEvent } from '../../constants/icons';
import {
  fetchMapEvents,
  searchLocationSuggestions,
  type FirebaseEvent,
  type LocationSuggestion,
} from '../../services/myTourService';
import { isPodcastEvent } from '../../utils/eventHelpers';

const BG_MATCH = '#8ECAE6';
const INITIAL_CAMERA_CENTER: [number, number] = [-18, 18];
const INITIAL_CAMERA_ZOOM = 0.8;
const SEARCH_DEBOUNCE_MS = 350;

// --- Auto-zoom / marker spreading tuning -----------------------------------
// How tightly the auto-fit is allowed to zoom. MAX keeps a dense cluster from
// snapping uncomfortably close; MIN keeps a country-wide spread from zooming
// all the way out to the globe.
// const MAX_FIT_ZOOM = 16;
const MAX_FIT_ZOOM = 16;
// const MIN_FIT_ZOOM = 3.5;
const MIN_FIT_ZOOM = 2.5;
// Zoom used when a city has exactly one event, or when the user taps a marker.
const SINGLE_EVENT_ZOOM = 14.5;
const EVENT_FOCUS_ZOOM = 16.5;
// Pixels reserved around the markers so the 48px icons never clip the map edge
// or sit under the floating zoom buttons / legend / date filters.
const FIT_PADDING = { top: 100, right: 80, bottom: 150, left: 80 };
// Minimum on-screen gap (in pixels) enforced between any two marker centres so
// the 48px icons never hide behind one another. Decluttering runs in pixel
// space at the current zoom, so this holds at every zoom level.
const MARKER_SEPARATION_PX = 70;
// Don't decluster when the user is zoomed out past this threshold; at very
// low zooms the globe projection can scatter markers across the world.
const MIN_DECLUSTER_ZOOM = 6.5;

type DateField = 'start' | 'end';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// Standard Google-Maps "bounds zoom" computation: returns the highest zoom at
// which the given lat/lng box still fits inside `viewWidth` x `viewHeight`
// pixels. Unlike a raw fitBounds it lets us clamp the result so identical /
// near-identical markers don't force an extreme zoom.
const WORLD_TILE_SIZE = 512;

const latRadians = (lat: number) => {
  const sin = Math.sin((lat * Math.PI) / 180);
  const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
};

const getBoundsZoom = (
  ne: { lat: number; lng: number },
  sw: { lat: number; lng: number },
  viewWidth: number,
  viewHeight: number
) => {
  const latFraction = (latRadians(ne.lat) - latRadians(sw.lat)) / Math.PI;
  const lngDiff = ne.lng - sw.lng;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  // A zero fraction means a single point (or a single line) — let the caller's
  // clamp decide the final zoom instead of producing Infinity.
  const latZoom = latFraction > 0 ? Math.log2(viewHeight / WORLD_TILE_SIZE / latFraction) : MAX_FIT_ZOOM;
  const lngZoom = lngFraction > 0 ? Math.log2(viewWidth / WORLD_TILE_SIZE / lngFraction) : MAX_FIT_ZOOM;

  return Math.min(latZoom, lngZoom);
};

// The single source of truth for "where the camera should sit to show this set
// of events". Used both to drive the camera AND to pick the (stable) zoom we
// declutter markers at — so the two never disagree and markers don't jump.
const computeFitCamera = (
  coordinates: [number, number][],
  viewWidth: number,
  viewHeight: number
): { center: [number, number]; zoom: number } => {
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

  if (coordinates.length === 1) {
    return { center, zoom: SINGLE_EVENT_ZOOM };
  }

  const availableWidth = Math.max(viewWidth - FIT_PADDING.left - FIT_PADDING.right, 1);
  const availableHeight = Math.max(viewHeight - FIT_PADDING.top - FIT_PADDING.bottom, 1);
  const zoom = clamp(
    getBoundsZoom(
      { lat: maxLat, lng: maxLng },
      { lat: minLat, lng: minLng },
      availableWidth,
      availableHeight
    ),
    MIN_FIT_ZOOM,
    MAX_FIT_ZOOM
  );
  return { center, zoom };
};

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

const landFillStyle: FillLayerStyle = {
  fillColor: '#F4F6F8',
  fillOpacity: 1,
};

const waterFillStyle: FillLayerStyle = {
  fillColor: '#5BA4D4',
  fillOpacity: 1,
};

const roadCasingStyle: LineLayerStyle = {
  lineColor: '#FFFFFF',
  lineWidth: ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 2.5, 14, 5, 18, 10],
  lineOpacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
};

const roadFillStyle: LineLayerStyle = {
  lineColor: '#C5CDD6',
  lineWidth: ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 1.6, 14, 3.2, 18, 7],
  lineOpacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
};

const placeLabelStyle: SymbolLayerStyle = {
  textField: ['coalesce', ['get', 'name_en'], ['get', 'name'], ['get', 'name_fr']],
  textSize: ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 12, 10, 14, 14, 16],
  textColor: '#1E293B',
  textHaloColor: '#FFFFFF',
  textHaloWidth: 2.5,
  textHaloBlur: 0.35,
  textAnchor: 'center',
  textAllowOverlap: false,
  textOptional: true,
  textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
  symbolSortKey: ['get', 'symbolrank'],
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

type EventMarker = { event: FirebaseEvent; coordinate: [number, number] };

// --- Web-Mercator pixel projection (single 512px world tile) ----------------
// We project markers to absolute world pixels at a given zoom so we can measure
// and enforce their on-screen distance, then project back to lng/lat.
const projectToPixels = (lng: number, lat: number, zoom: number) => {
  const scale = WORLD_TILE_SIZE * Math.pow(2, zoom);
  const clampedLat = Math.max(Math.min(lat, 85.05112878), -85.05112878);
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
};

const unprojectFromPixels = (x: number, y: number, zoom: number): [number, number] => {
  const scale = WORLD_TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
};

// Pushes apart any markers that would render closer than `separation` pixels at
// the given zoom, so every marker stays visible and individually tappable — no
// matter how many share the same (or nearly the same) coordinate. As the user
// zooms in, real distances exceed the separation and markers settle back onto
// their true locations automatically.
const declusterMarkers = (
  list: FirebaseEvent[],
  zoom: number,
  separation: number
): EventMarker[] => {
  const points = list.map((event, index) => {
    const [lng, lat] = eventCoordinate(event);
    const projected = projectToPixels(lng, lat, zoom);
    // Tiny deterministic jitter so exact duplicates get a defined push direction.
    return {
      event,
      x: projected.x + ((index % 7) - 3) * 0.01,
      y: projected.y + ((index % 5) - 2) * 0.01,
    };
  });

  // Two markers can only collide if they are within `separation` px, i.e. within
  // one grid cell of that size. So each pass we only compare a marker against the
  // handful in its own and the 8 neighbouring cells — this keeps the whole thing
  // near-linear and able to handle thousands of points instead of O(n²).
  const cellSize = separation;
  const cellKey = (x: number, y: number) =>
    `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;

  const maxIterations = 60;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const grid = new globalThis.Map<string, number[]>();
    points.forEach((point, index) => {
      const key = cellKey(point.x, point.y);
      const bucket = grid.get(key);
      if (bucket) {
        bucket.push(index);
      } else {
        grid.set(key, [index]);
      }
    });

    let moved = false;
    for (let i = 0; i < points.length; i += 1) {
      const baseCellX = Math.floor(points[i].x / cellSize);
      const baseCellY = Math.floor(points[i].y / cellSize);
      for (let gx = -1; gx <= 1; gx += 1) {
        for (let gy = -1; gy <= 1; gy += 1) {
          const candidates = grid.get(`${baseCellX + gx}:${baseCellY + gy}`);
          if (!candidates) continue;
          for (const j of candidates) {
            if (j <= i) continue;
            let dx = points[j].x - points[i].x;
            let dy = points[j].y - points[i].y;
            let distance = Math.hypot(dx, dy);
            if (distance < separation) {
              if (distance === 0) {
                dx = Math.cos(i);
                dy = Math.sin(i);
                distance = 1;
              }
              const shift = (separation - distance) / 2;
              const nx = dx / distance;
              const ny = dy / distance;
              points[i].x -= nx * shift;
              points[i].y -= ny * shift;
              points[j].x += nx * shift;
              points[j].y += ny * shift;
              moved = true;
            }
          }
        }
      }
    }
    if (!moved) {
      break;
    }
  }

  return points.map((point) => ({
    event: point.event,
    coordinate: unprojectFromPixels(point.x, point.y, zoom),
  }));
};

const EventMarkerIcon = ({
  event,
  size = 71,
}: {
  event: FirebaseEvent;
  size?: number;
}) =>
  isPodcastEvent(event) ? (
    <PodcastEvent width={size} height={size} />
  ) : (
    <PrideEvent width={size} height={size} />
  );

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
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
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

  // The camera target for the focused city. Computed once per
  // search/filter/layout change — NOT on every zoom frame — so it stays stable.
  const cityFit = useMemo(() => {
    if (!selectedLocation || filteredEvents.length === 0) {
      return null;
    }
    const width = mapLayout.width || Dimensions.get('window').width;
    const height = mapLayout.height || Dimensions.get('window').height * 0.5;
    return computeFitCamera(filteredEvents.map(eventCoordinate), width, height);
  }, [filteredEvents, selectedLocation, mapLayout]);

  const mapEventMarkers = useMemo(() => {
    // Only declutter once the user has focused a city. On the global globe view
    // markers should stay in their real countries (and pushing hundreds apart by
    // a pixel gap would scatter them across continents and be expensive).
    if (!selectedLocation) {
      return filteredEvents.map((event) => ({
        event,
        coordinate: eventCoordinate(event),
      }));
    }
    // If the user has zoomed out past the decluster threshold, render true
    // coordinates (they'll overlap) instead of running the declusterer which
    // can scatter points across the globe at very low zooms.
    if (zoomLevel <= MIN_DECLUSTER_ZOOM) {
      return filteredEvents.map((event) => ({ event, coordinate: eventCoordinate(event) }));
    }

    // Let the decluster zoom follow whichever zoom is larger: the live
    // camera zoom (so markers converge as you zoom in) or the stable city-fit
    // zoom (so positions remain stable while panning). Clamp into a safe range
    // to avoid globe-scattering at very low zooms.
    const rawDeclusterZoom = Math.max(zoomLevel, cityFit?.zoom ?? SINGLE_EVENT_ZOOM);
    const declusterZoom = clamp(rawDeclusterZoom, MIN_DECLUSTER_ZOOM, MAX_FIT_ZOOM);

    const declustered = declusterMarkers(filteredEvents, declusterZoom, MARKER_SEPARATION_PX);

    // Decluttering spreads co-located markers apart for visibility, which moves
    // them off their true coordinate. So the marker the user has tapped is
    // pinned back to its EXACT real location — tapping always reveals the true
    // spot, while the rest stay spread out.
    if (!selectedEvent) {
      return declustered;
    }
    return declustered.map((marker) =>
      marker.event.id === selectedEvent.id
        ? { event: marker.event, coordinate: eventCoordinate(marker.event) }
        : marker
    );
  }, [filteredEvents, selectedLocation, cityFit, selectedEvent, zoomLevel]);



  const focusLocation = useCallback((location: LocationSuggestion) => {
    if (!location.coordinates) {
      return;
    }

    const matchingEvents = events.filter(
      (event) =>
        eventMatchesFilter(event, location.label) &&
        eventMatchesDateRange(event, startDateFilter, endDateFilter)
    );

    // CASE 1: No events → just move camera to the city itself.
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

    // CASE 2: One or more events → compute the exact zoom that fits every marker
    // inside the visible map area (minus padding for icons + floating controls).
    // Uses the SAME helper that the markers are declustered with, so the camera
    // and the marker layout always agree. Shows them all at once without any
    // hiding behind the others, and never zooms uncomfortably close or far.
    const width = mapLayout.width || Dimensions.get('window').width;
    const height = mapLayout.height || Dimensions.get('window').height * 0.5;
    const { center, zoom } = computeFitCamera(
      matchingEvents.map(eventCoordinate),
      width,
      height
    );

    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: zoom,
      pitch: 0,
      heading: 0,
      animationDuration: 1300,
      animationMode: 'flyTo',
    });
    setZoomLevel(zoom);
  }, [events, startDateFilter, endDateFilter, mapLayout]);
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

  const handleMarkerPress = useCallback(
    (event: FirebaseEvent) => {
      setSelectedEvent(event);
      // Google-Maps style: fly to the event's EXACT real coordinate (not the
      // decluttered/spread position) and zoom hard onto it. The marker itself is
      // simultaneously pinned back to this true coordinate in mapEventMarkers, so
      // the pin and the camera centre line up on the real location.
      const target = eventCoordinate(event);
      const nextZoom = Math.max(zoomLevel, EVENT_FOCUS_ZOOM);
      cameraRef.current?.setCamera({
        centerCoordinate: target,
        zoomLevel: nextZoom,
        pitch: 0,
        heading: 0,
        animationDuration: 800,
        animationMode: 'flyTo',
      });
      setZoomLevel(nextZoom);
    },
    [zoomLevel]
  );

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
            <View
              style={styles.mapShell}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setMapLayout((prev) =>
                  prev.width === width && prev.height === height
                    ? prev
                    : { width, height }
                );
              }}
            >
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
                    id="customLandFill"
                    sourceID="composite"
                    sourceLayerID="landuse"
                    style={landFillStyle}
                    filter={['==', ['geometry-type'], 'Polygon']}
                  />
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
                  <Mapbox.SymbolLayer
                    id="customPlaceLabels"
                    sourceID="composite"
                    sourceLayerID="place_label"
                    style={placeLabelStyle}
                    aboveLayerID="customRoadFill"
                  />
                </Mapbox.VectorSource>

                {mapEventMarkers.map(({ event, coordinate }) => (
                  <Mapbox.MarkerView
                    key={event.id}
                    id={`map-event-${event.id}`}
                    coordinate={coordinate}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${isPodcastEvent(event) ? 'podcast' : 'pride'} event ${event.title}`}
                      onPress={() => handleMarkerPress(event)}
                      style={styles.eventMapMarker}
                    >
                      <EventMarkerIcon event={event} size={48} />
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

      <View style={[styles.legendCard, { marginBottom: 5 }]}>
        <View style={styles.legendRow}>
          <PrideEvent width={24} height={24}/>
          <Text style={styles.legendText}>Purple markers show Pride events.</Text>
        </View>
        <View style={styles.legendRow}>
          <PodcastEvent height={24} width={24}/>
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
          <Pressable style={styles.calendarCard} onPress={() => { }}>
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
  eventMapMarker: {
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    marginBottom: 6,
    // gap: 6
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
