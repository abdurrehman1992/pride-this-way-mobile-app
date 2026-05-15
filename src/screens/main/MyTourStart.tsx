import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Mapbox, {
  type CircleLayerStyle,
  type LineLayerStyle,
} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import Config from 'react-native-config';
import axios from 'axios';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFavorites } from '../../context/FavoritesContext';
import { showError, showSuccess, showInfo } from '../../components/common/AppToast';
import {
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
import EventDetailModal from '../../components/modals/EventDetailModal';
import {
  deleteUserTour,
  fetchPlacesByIds,
  fetchRouteDetails,
  FirebaseEvent,
  FirebasePlace,
  FirebaseRoute,
  fetchUserTourById,
  saveUserTour,
} from '../../services/myTourService';
import { useSelector } from 'react-redux';
import { RootState } from '../../Redux/store';

type TourStop = {
  id: string;
  title: string;
  coordinate: [number, number];
  type: 'place' | 'event';
  place?: FirebasePlace;
  event?: FirebaseEvent;
};

type DirectionsResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
};

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

const VISIT_DISTANCE_THRESHOLD_METERS = 300;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DETAIL_CARD_WIDTH = 260;
const DETAIL_CARD_HEIGHT = 255;

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceInMeters = (
  from: [number, number],
  to: [number, number]
) => {
  const earthRadius = 6371000;
  const dLat = toRadians(to[1] - from[1]);
  const dLon = toRadians(to[0] - from[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from[1])) *
      Math.cos(toRadians(to[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const getCurrentPositionAsync = async () =>
  new Promise<[number, number]>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

const orderStopsByNearest = (
  stops: TourStop[],
  startCoordinate: [number, number] | null
) => {
  if (stops.length <= 1) {
    return stops;
  }

  const remaining = [...stops];
  const ordered: TourStop[] = [];
  let cursor = startCoordinate || remaining[0].coordinate;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = distanceInMeters(cursor, remaining[0].coordinate);

    for (let index = 1; index < remaining.length; index += 1) {
      const candidateDistance = distanceInMeters(cursor, remaining[index].coordinate);
      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearestIndex = index;
      }
    }

    const [nextStop] = remaining.splice(nearestIndex, 1);
    ordered.push(nextStop);
    cursor = nextStop.coordinate;
  }

  return ordered;
};

const MyTourStart = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const user = useSelector((state: RootState) => state.auth.user);

  const [scanVisible, setScanVisible] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [tourId, setTourId] = useState<string | null>(route.params?.tourId || null);
  const [isEdited, setIsEdited] = useState(Boolean(route.params?.isEdited));
  const [extraPlaceIds, setExtraPlaceIds] = useState<string[]>(
    route.params?.extraPlaceIds || []
  );
  const [removedPlaceIds, setRemovedPlaceIds] = useState<string[]>(
    route.params?.removedPlaceIds || []
  );
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(
    null
  );
  const [placeProgress, setPlaceProgress] = useState<
    Record<
      string,
      {
        visited: boolean;
        visitedAt?: string | null;
        proofImageUri?: string | null;
        pointsEarned?: number;
        addedByUser?: boolean;
      }
    >
  >({});
  const [routeDetails, setRouteDetails] = useState<{
    route: FirebaseRoute;
    places: FirebasePlace[];
    events: FirebaseEvent[];
    favoritePlace: FirebasePlace | null;
    favoritePlaces: FirebasePlace[];
  } | null>(null);
  const [selectedStop, setSelectedStop] = useState<TourStop | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FirebaseEvent | null>(null);
  const [tourCompletedVisible, setTourCompletedVisible] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 24, y: 260 });
  const [tourActionVisible, setTourActionVisible] = useState(false);

  const routeId = route.params?.routeId;
  const routeName = route.params?.routeName;
  const cityLabel = route.params?.cityLabel || '';

  const currentRoute = {
    id: routeId ?? 'route-1',
    title: routeName || routeDetails?.route.name || 'Tour Route',
    description: `Beautiful travel path across ${cityLabel || routeDetails?.route.city_name || 'the city'}`,
    rating: '4.8',
    image:
      routeDetails?.places[0]?.imageUrl ||
      routeDetails?.favoritePlaces?.[0]?.imageUrl ||
      routeDetails?.favoritePlace?.imageUrl ||
      routeDetails?.events[0]?.coverImage ||
      '',
    category: 'Route' as const,
  };

  useEffect(() => {
    let isMounted = true;
    if (!Config.MAPBOX_TOKEN) return undefined;

    Mapbox.setAccessToken(Config.MAPBOX_TOKEN)
      .then(() => {
        if (isMounted) setMapReady(true);
      })
      .catch(() => {
        if (isMounted) setMapReady(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!routeId) {
      return;
    }

    setLoading(true);

    Promise.all([
      fetchRouteDetails({
        routeId,
        userId: user?.id,
        extraPlaceIds,
        removedPlaceIds,
      }),
      fetchUserTourById(route.params?.tourId || null),
    ])
      .then(async ([data, savedTour]) => {
        if (!data) {
          return;
        }

        let nextDetails = data;
        let nextProgress: Record<
          string,
          {
            visited: boolean;
            visitedAt?: string | null;
            proofImageUri?: string | null;
            pointsEarned?: number;
            addedByUser?: boolean;
          }
        > = {};

        if (savedTour && savedTour.status !== 'completed') {
          const savedPlaces = await fetchPlacesByIds(
            savedTour.all_places.map((item) => item.place_id)
          );

          nextDetails = {
            ...data,
            places: savedPlaces,
          };
          nextProgress = savedTour.all_places.reduce<
            Record<
              string,
              {
                visited: boolean;
                visitedAt?: string | null;
                proofImageUri?: string | null;
                pointsEarned?: number;
                addedByUser?: boolean;
              }
            >
          >((acc, item) => {
            acc[item.place_id] = {
              visited: item.visited,
              visitedAt: item.visitedAt,
              proofImageUri: item.proofImageUri,
              pointsEarned: item.pointsEarned,
              addedByUser: item.addedByUser,
            };
            return acc;
          }, {});
          setTourStarted(true);
          setTourId(savedTour.id);
          setStartedAt(savedTour.startedAt || null);
          setIsEdited(savedTour.isEdited || isEdited);
        }

        setPlaceProgress(nextProgress);
        setRouteDetails(nextDetails);
        const favoritePlaces =
          nextDetails.favoritePlaces.length > 0
            ? nextDetails.favoritePlaces
            : nextDetails.favoritePlace
              ? [nextDetails.favoritePlace]
              : [];
        const allPlaces = [...nextDetails.places, ...favoritePlaces].filter(
          (place, index, items) =>
            items.findIndex((item) => item.id === place.id) === index
        );
        const stops: TourStop[] = [
          ...allPlaces
            .filter(
              (place) =>
                place.coordinates?.longitude !== undefined &&
                place.coordinates?.latitude !== undefined
            )
            .map((place) => ({
              id: place.id,
              title: place.name,
              coordinate: [
                Number(place.coordinates?.longitude || 0),
                Number(place.coordinates?.latitude || 0),
              ] as [number, number],
              type: 'place' as const,
              place,
            })),
          ...nextDetails.events
            .filter(
              (event) =>
                event.coordinates?.longitude !== undefined &&
                event.coordinates?.latitude !== undefined
            )
            .map((event) => ({
              id: event.id,
              title: event.title,
              coordinate: [
                Number(event.coordinates?.longitude || 0),
                Number(event.coordinates?.latitude || 0),
              ] as [number, number],
              type: 'event' as const,
              event,
            })),
        ];

        setTourStops(stops);
      })
      .finally(() => setLoading(false));
  }, [extraPlaceIds, isEdited, removedPlaceIds, route.params?.tourId, routeId, user?.id]);

  useEffect(() => {
    const addedPlaceId = route.params?.addedPlaceId;
    if (!addedPlaceId) {
      return;
    }

    fetchPlacesByIds([addedPlaceId]).then((places) => {
      const addedPlace = places[0];
      if (!addedPlace?.coordinates) {
        return;
      }

      setTourStops((prev) => {
        if (prev.some((stop) => stop.id === addedPlace.id)) {
          return prev;
        }

        setExtraPlaceIds((current) =>
          current.includes(addedPlace.id) ? current : [...current, addedPlace.id]
        );
        setPlaceProgress((prevProgress) => ({
          ...prevProgress,
          [addedPlace.id]: {
            ...prevProgress[addedPlace.id],
            visited: Boolean(prevProgress[addedPlace.id]?.visited),
            addedByUser: true,
          },
        }));
        setIsEdited(true);

        return [
          ...prev,
          {
            id: addedPlace.id,
            title: addedPlace.name,
            coordinate: [
              Number(addedPlace.coordinates?.longitude || 0),
              Number(addedPlace.coordinates?.latitude || 0),
            ],
            type: 'place',
            place: addedPlace,
          },
        ];
      });
    });
  }, [route.params?.addedPlaceId]);

  const placeStops = useMemo(
    () => tourStops.filter((stop) => stop.type === 'place'),
    [tourStops]
  );

  const orderedPlaceStops = useMemo(
    () => orderStopsByNearest(placeStops, currentLocation),
    [currentLocation, placeStops]
  );

  const unvisitedPlaceStops = useMemo(
    () =>
      orderedPlaceStops.filter((stop) => {
        const progress = placeProgress[stop.id];
        return !progress?.visited;
      }),
    [orderedPlaceStops, placeProgress]
  );

  useEffect(() => {
    if (!tourStarted) {
      return;
    }

    handleCurrentLocation();
  }, [handleCurrentLocation, tourStarted]);

  useEffect(() => {
    handleCurrentLocation(false);
  }, [handleCurrentLocation]);

  useEffect(() => {
    if (!cameraRef.current || !mapReady) {
      return;
    }

    const coordinates =
      routeCoordinates.length >= 2
        ? routeCoordinates
        : orderedPlaceStops.map((stop) => stop.coordinate);

    if (coordinates.length === 0) {
      return;
    }

    if (coordinates.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: coordinates[0],
        zoomLevel: 13,
        animationDuration: 900,
        animationMode: 'easeTo',
      });
      return;
    }

    const longitudes = coordinates.map((item) => item[0]);
    const latitudes = coordinates.map((item) => item[1]);
    const ne: [number, number] = [
      Math.max(...longitudes),
      Math.max(...latitudes),
    ];
    const sw: [number, number] = [
      Math.min(...longitudes),
      Math.min(...latitudes),
    ];

    cameraRef.current.fitBounds(ne, sw, [170, 36, 180, 36], 900);
  }, [mapReady, orderedPlaceStops, routeCoordinates]);

  useEffect(() => {
    const lineStops =
      [
        ...(currentLocation ? [currentLocation] : []),
        ...(tourStarted && unvisitedPlaceStops.length > 0
          ? unvisitedPlaceStops
          : orderedPlaceStops
        ).map((stop) => stop.coordinate),
      ];

    if (!Config.MAPBOX_TOKEN || lineStops.length < 2) {
      setRouteCoordinates(lineStops as [number, number][]);
      return;
    }

    let isMounted = true;
    setRouteCoordinates(lineStops as [number, number][]);

    const fetchRoadRoute = async () => {
      try {
        const coordinates = lineStops.map((item) => `${item[0]},${item[1]}`).join(';');
        const { data } = await axios.get<DirectionsResponse>(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}`,
          {
            params: {
              access_token: Config.MAPBOX_TOKEN,
              geometries: 'geojson',
              overview: 'full',
              steps: false,
            },
          }
        );

        const routedCoordinates = data.routes?.[0]?.geometry?.coordinates;

        if (isMounted && routedCoordinates && routedCoordinates.length >= 2) {
          setRouteCoordinates(routedCoordinates);
        }
      } catch {
        if (isMounted) {
          setRouteCoordinates(lineStops as [number, number][]);
        }
      }
    };

    fetchRoadRoute();

    return () => {
      isMounted = false;
    };
  }, [currentLocation, orderedPlaceStops, tourStarted, unvisitedPlaceStops]);

  const routeLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: routeCoordinates.length >= 2
        ? [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoordinates,
            },
          }]
        : [],
    }),
    [routeCoordinates]
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

  const totalEarnedPoints = useMemo(
    () =>
      Object.values(placeProgress).reduce(
        (sum, item) => sum + Number(item.pointsEarned || 0),
        0
      ),
    [placeProgress]
  );

  const routeDistanceKm = useMemo(() => {
    if (routeCoordinates.length < 2) {
      return 0;
    }

    const meters = routeCoordinates.slice(1).reduce((sum, coordinate, index) => {
      return sum + distanceInMeters(routeCoordinates[index], coordinate);
    }, 0);

    return meters / 1000;
  }, [routeCoordinates]);

  const hasVisitedProgress = useMemo(
    () => Object.values(placeProgress).some((item) => item.visited),
    [placeProgress]
  );

  const canResumeTour = Boolean(tourId || hasVisitedProgress || startedAt);

  const updateSelectedStopPosition = useCallback(async (stop: TourStop) => {
    if (!mapRef.current) {
      return;
    }

    try {
      const point = await (mapRef.current as any).getPointInView(stop.coordinate);
      let x = Number(point?.[0] || 24) - DETAIL_CARD_WIDTH / 2;
      let y = Number(point?.[1] || 260) - DETAIL_CARD_HEIGHT - 42;

      x = Math.max(16, Math.min(SCREEN_WIDTH - DETAIL_CARD_WIDTH - 16, x));
      if (y < 92) {
        y = Number(point?.[1] || 260) + 40;
      }
      y = Math.min(SCREEN_HEIGHT - DETAIL_CARD_HEIGHT - 120, y);

      setCardPosition({ x, y });
    } catch {
      setCardPosition({ x: 24, y: 260 });
    }
  }, []);

  const handleMarkerPress = useCallback(
    async (stop: TourStop) => {
      if (stop.type === 'event' && stop.event) {
        setSelectedStop(null);
        setSelectedEvent(stop.event);
        cameraRef.current?.setCamera({
          centerCoordinate: stop.coordinate,
          zoomLevel: 15.8,
          pitch: 0,
          heading: 0,
          animationDuration: 900,
          animationMode: 'flyTo',
        });
        return;
      }

      cameraRef.current?.setCamera({
        centerCoordinate: stop.coordinate,
        zoomLevel: 16.1,
        pitch: 0,
        heading: 0,
        animationDuration: 900,
        animationMode: 'flyTo',
      });
      setSelectedEvent(null);
      setSelectedStop(stop);
      await updateSelectedStopPosition(stop);
    },
    [updateSelectedStopPosition]
  );

  const handleDeleteStop = useCallback((stopId: string) => {
    setExtraPlaceIds((prev) => prev.filter((id) => id !== stopId));
    setRemovedPlaceIds((prev) => (prev.includes(stopId) ? prev : [...prev, stopId]));
    setIsEdited(true);
    setTourStops((prev) => prev.filter((s) => s.id !== stopId));
    setSelectedStop(null);
  }, []);

  const persistTourIfNeeded = useCallback(
    async (
      nextProgress: typeof placeProgress,
      nextStartedAt: string | null
    ) => {
      if (!routeDetails || !user?.id) {
        return null;
      }

      const hasVisited = Object.values(nextProgress).some((item) => item.visited);
      if (!isEdited && !hasVisited) {
        return null;
      }

      const activePlaceStops = tourStops
        .filter((stop) => stop.type === 'place')
        .map((stop) => stop.place!)
        .filter(Boolean);
      const nextCurrentStopIndex = activePlaceStops.findIndex(
        (place) => !nextProgress[place.id]?.visited
      );
      const remainingStops = activePlaceStops.filter(
        (place) => !nextProgress[place.id]?.visited
      );
      const status = remainingStops.length === 0 ? 'completed' : 'active';
      const savedId = await saveUserTour({
        tourId,
        userId: user.id,
        route: routeDetails.route,
        title: route.params?.tourName || routeDetails.route.name,
        places: activePlaceStops,
        events: routeDetails.events,
        placeProgress: nextProgress,
        currentStopIndex:
          nextCurrentStopIndex < 0 ? activePlaceStops.length : nextCurrentStopIndex,
        isEdited,
        status,
        startedAt: nextStartedAt || new Date().toISOString(),
        completedAt: status === 'completed' ? new Date().toISOString() : null,
      });
      setTourId(savedId);
      return savedId;
    },
    [isEdited, route.params?.tourName, routeDetails, tourId, tourStops, user?.id]
  );

  const handleStopFavorite = async (place: FirebasePlace) => {
    if (isFavorite(place.id)) {
      await removeFromFavorites(place.id);
      showInfo('Removed', 'Removed from favorites');
      return;
    }

    await addToFavorites({
      id: place.id,
      title: place.name,
      description: place.description || place.address || 'Location',
      rating: String(place.rating || 0),
      image: place.imageUrl || '',
      category: 'Food',
      routeName: 'RecommendationDetials',
      routeParams: { item: place },
      city_name: place.city_name,
      country: place.country,
    });
    showSuccess('Added', 'Added to favorites');
  };

  const handleCurrentLocation = useCallback((shouldFocus = true) => {
    const request = (granted: boolean) => {
      if (!granted) return;
      Geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [
            pos.coords.longitude,
            pos.coords.latitude,
          ];
          setCurrentLocation(coords);
          if (shouldFocus) {
            cameraRef.current?.setCamera({
              centerCoordinate: coords,
              zoomLevel: 14,
              animationDuration: 800,
              animationMode: 'easeTo',
            });
          }
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

  const handleStartTour = async () => {
    if (!routeDetails) {
      return;
    }

    const nextStartedAt = startedAt || new Date().toISOString();
    setStartedAt(nextStartedAt);
    setTourStarted(true);

    try {
      if (isEdited) {
        await persistTourIfNeeded(placeProgress, nextStartedAt);
      }
      showSuccess(
        canResumeTour ? 'Tour Resumed' : 'Tour Started',
        canResumeTour
          ? 'You can continue your journey from where you paused.'
          : isEdited
            ? 'Your edited tour has been saved.'
            : 'Your route is ready to explore.'
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start tour.';
      showError('Start Tour Failed', message);
    }
  };

  const handlePauseTour = () => {
    setTourStarted(false);
    setSelectedStop(null);
    setSelectedEvent(null);
    setTourActionVisible(false);
    showInfo('Tour Paused', 'You can resume this tour anytime.');
  };

  const handleCloseTour = async () => {
    if (tourId) {
      await deleteUserTour(tourId);
    }

    setTourId(null);
    setStartedAt(null);
    setPlaceProgress({});
    setSelectedStop(null);
    setSelectedEvent(null);
    setTourActionVisible(false);
    showInfo('Tour Closed', 'This tour has been closed and will not resume again.');
    navigation.goBack();
  };

  const handleTourAction = () => {
    setTourActionVisible(true);
  };

  const handleVisitVerification = async (imageUri: string) => {
    if (!selectedStop?.place) {
      return;
    }

    try {
      const coords = await getCurrentPositionAsync();
      const distance = distanceInMeters(coords, selectedStop.coordinate);

      if (distance > VISIT_DISTANCE_THRESHOLD_METERS) {
        showError(
          'Verification Failed',
          'You need to be near this location to confirm your visit.'
        );
        return;
      }

      const visitedAt = new Date().toISOString();
      const pointsEarned = Number(selectedStop.place.points || 10);
      const nextProgress = {
        ...placeProgress,
        [selectedStop.id]: {
          ...placeProgress[selectedStop.id],
          visited: true,
          visitedAt,
          proofImageUri: imageUri,
          pointsEarned,
          addedByUser:
            placeProgress[selectedStop.id]?.addedByUser ||
            extraPlaceIds.includes(selectedStop.id),
        },
      };

      setCurrentLocation(coords);
      setPlaceProgress(nextProgress);
      setTourStarted(true);
      const nextStartedAt = startedAt || new Date().toISOString();
      setStartedAt(nextStartedAt);
      await persistTourIfNeeded(nextProgress, nextStartedAt);
      if (
        placeStops.filter((stop) => !nextProgress[stop.id]?.visited).length === 0
      ) {
        setTourCompletedVisible(true);
      }
      setSelectedStop(null);
      setScanVisible(false);
    } catch {
      showError(
        'Verification Failed',
        'Unable to verify your location right now.'
      );
    }
  };

  const centerCoordinate = useMemo<[number, number]>(() => {
    return currentLocation || orderedPlaceStops[0]?.coordinate || [-118.3014, 34.063];
  }, [currentLocation, orderedPlaceStops]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopHeader title="My Tour" />
      <View style={styles.background}>
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
              onCameraChanged={() => {
                if (selectedStop) {
                  updateSelectedStopPosition(selectedStop).catch(() => {});
                }
              }}
              onPress={() => {
                setSelectedStop(null);
                setSelectedEvent(null);
              }}
            >
              <Mapbox.Camera
                ref={cameraRef}
                centerCoordinate={centerCoordinate}
                zoomLevel={12.6}
                pitch={0}
                heading={tourStarted ? 18 : 0}
                animationMode="easeTo"
                animationDuration={900}
              />

              <Mapbox.ShapeSource id="tourRouteLine" shape={routeLine}>
                <Mapbox.LineLayer id="tourRouteLineLayer" style={routeLineLayerStyle} />
              </Mapbox.ShapeSource>

              <Mapbox.ShapeSource
                id="tourRouteHitTargets"
                shape={routePoints}
                hitbox={{ width: 64, height: 64 }}
              >
                <Mapbox.CircleLayer id="tourRouteHitTargetLayer" style={markerHitLayerStyle} />
              </Mapbox.ShapeSource>

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
                    style={[
                      styles.markerTapArea,
                    ]}
                  >
                    {stop.type === 'place' && placeProgress[stop.id]?.visited ? (
                      <View style={styles.grayPin}>
                        <View style={styles.grayPinInner} />
                      </View>
                    ) : (
                      <BlueMapIcon width={42} height={42} />
                    )}
                  </TouchableOpacity>
                </Mapbox.MarkerView>
              ))}

              {currentLocation ? (
                <Mapbox.MarkerView
                  id="currentUserLocationMarker"
                  coordinate={[...currentLocation]}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.currentMapMarker}>
                    <View style={styles.grayPin}>
                      <View style={styles.grayPinInner} />
                    </View>
                  </View>
                </Mapbox.MarkerView>
              ) : null}
            </Mapbox.MapView>
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>
                {Config.MAPBOX_TOKEN ? 'Loading map...' : 'Mapbox token missing'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.distancePill}>
          <Text style={styles.distancePillText}>
            {routeDistanceKm > 0 ? `${routeDistanceKm.toFixed(1)} km route` : 'Route loading'}
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.currentLocationBtn} onPress={handleCurrentLocation}>
          <View style={styles.currentLocationOuter}>
            <View style={styles.currentLocationInner} />
          </View>
        </TouchableOpacity>

        {selectedStop && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[
              styles.detailCard,
              styles.detailCardPosition,
              { left: cardPosition.x, top: cardPosition.y },
            ]}
          >
            <Image
              source={{ uri: selectedStop.place?.imageUrl || currentRoute.image }}
              style={styles.cardImage}
            />

            <View style={styles.topRow}>
              <View style={styles.pill}>
                <ForkIcon width={8} height={8} />
                <Text style={styles.pillText}>Location</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  selectedStop.place && handleStopFavorite(selectedStop.place)
                }
              >
                {selectedStop.place && isFavorite(selectedStop.place.id) ? (
                  <RedHeartIcon width={13} height={11} />
                ) : (
                  <HeartIcon width={13} height={11} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.textBlock}>
              <Text style={styles.cardTitle}>{selectedStop.title}</Text>
              <Text style={styles.cardSubtitle}>
                {selectedStop.place?.description || selectedStop.place?.address || 'Favorite place'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <StarIcon width={9} height={9} />
                <Text style={styles.infoText}>{String(selectedStop.place?.rating || 0)}</Text>
              </View>
              <View style={styles.infoItem}>
                <LocationIcon width={8} height={8} />
                <Text style={styles.infoText}>{selectedStop.place?.city_name || routeDetails?.route.city_name}</Text>
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
                disabled={Boolean(placeProgress[selectedStop.id]?.visited)}
              >
                <Text style={styles.confirmText}>
                  {placeProgress[selectedStop.id]?.visited
                    ? 'Visited'
                    : 'Confirm Visit'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleDeleteStop(selectedStop.id)}>
                <DeleteWhiteIcon width={24} height={24} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.favoriteBtn} onPress={handleTourAction}>
            <Text style={[styles.btnText, { color: COLORS.TEXT_PRIMARY }]}>
              Action
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startTourBtn, tourStarted && styles.startTourBtnStarted]}
            onPress={handleStartTour}
          >
            <Text style={[styles.btnText, { color: COLORS.WHITE }]}>
              {tourStarted ? 'Tour Started' : canResumeTour ? 'Resume Tour' : 'Start a Tour'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScanVerifyModal
          visible={scanVisible}
          title={selectedStop?.title || 'this location'}
          onClose={() => setScanVisible(false)}
          onScanSuccess={handleVisitVerification}
        />

        <EventDetailModal
          visible={Boolean(selectedEvent)}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />

        {tourActionVisible ? (
          <View style={styles.actionOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.actionBackdrop}
              onPress={() => setTourActionVisible(false)}
            />
            <View style={styles.actionSheet}>
              <Text style={styles.actionTitle}>Tour Actions</Text>
              <TouchableOpacity
                style={styles.actionPrimaryBtn}
                onPress={handlePauseTour}
              >
                <Text style={styles.actionPrimaryText}>Pause Tour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionDangerBtn}
                onPress={() => {
                  handleCloseTour().catch(() => {
                    showError('Tour Close Failed', 'Unable to end this tour right now.');
                  });
                }}
              >
                <Text style={styles.actionDangerText}>End Tour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCancelBtn}
                onPress={() => setTourActionVisible(false)}
              >
                <Text style={styles.actionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {tourCompletedVisible ? (
          <View style={styles.completionOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.completionBackdrop}
              onPress={() => setTourCompletedVisible(false)}
            />
            <View style={styles.completionCard}>
              <Text style={styles.completionEmoji}>🎉</Text>
              <Text style={styles.completionTitle}>Tour Completed Successfully</Text>
              <Text style={styles.completionText}>
                Amazing! You&apos;ve successfully visited all locations and earned
                a total of {totalEarnedPoints} points. Ready for your next
                adventure?
              </Text>
              <View style={styles.completionActions}>
                <TouchableOpacity
                  style={styles.completionCancelBtn}
                  onPress={() => setTourCompletedVisible(false)}
                >
                  <Text style={styles.completionCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completionPrimaryBtn}
                  onPress={() => setTourCompletedVisible(false)}
                >
                  <Text style={styles.completionPrimaryText}>Back To My Tour</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default MyTourStart;

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
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
  distancePill: {
    position: 'absolute',
    top: 18,
    left: 24,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distancePillText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 12,
  },
  markerTapArea: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentMapMarker: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.92,
  },
  grayPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9AA3AF',
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grayPinInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
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
  detailCard: {
    padding: 8,
    width: 260,
    backgroundColor: COLORS.WHITE,
    borderWidth: 3,
    borderColor: COLORS.BUTTON_COLOR,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 10,
    zIndex: 100,
  },
  detailCardPosition: {
    position: 'absolute',
    zIndex: 100,
  },
  cardImage: {
    width: '100%',
    height: 108,
    borderRadius: 6,
  },
  topRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  textBlock: {
    marginTop: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  cardSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  divider: {
    marginTop: 8,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  infoRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },
  openText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_GREEN,
  },
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    marginRight: 8,
    backgroundColor: '#F46A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  rowButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    zIndex: 30,
  },
  favoriteBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  startTourBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTourBtnStarted: {
    opacity: 0.95,
  },
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 110,
    justifyContent: 'flex-end',
  },
  actionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  actionSheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 12,
  },
  actionTitle: {
    textAlign: 'center',
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    fontSize: 20,
    marginBottom: 4,
  },
  actionPrimaryBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryText: {
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: 16,
  },
  actionDangerBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FEECEC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F7B5B5',
  },
  actionDangerText: {
    color: '#D92D20',
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: 16,
  },
  actionCancelBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  actionCancelText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 16,
  },
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  completionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  completionCard: {
    width: '100%',
    backgroundColor: COLORS.WHITE,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  completionEmoji: {
    fontSize: 34,
  },
  completionTitle: {
    marginTop: 10,
    fontSize: 20,
    textAlign: 'center',
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  completionText: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  completionActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  completionCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  completionPrimaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  completionCancelText: {
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
  },
  completionPrimaryText: {
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    color: COLORS.WHITE,
    fontSize: 16,
  },
  btnText: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
