import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Mapbox, { type FillLayerStyle, type LineLayerStyle } from '@rnmapbox/maps';
import Config from 'react-native-config';
import type { FeatureCollection, LineString, Polygon } from 'geojson';
import TopHeader from '../../components/Home/TopHeader';
import CustomSearchInput from '../../components/Home/CustomSearchInput';
import LocationModal from '../../components/modals/LocationModal';
import { COLORS } from '../../constants/colors';
import { FilterIcon } from '../../constants/images';
import {
  BlueMapIcon,
  DropdownIcon,
} from '../../constants/icons';
import { FONT_FAMILY } from '../../constants/fonts';

const BG_MATCH = '#7AB4DC';
const INITIAL_CAMERA_CENTER: [number, number] = [-18, 18];
const INITIAL_CAMERA_ZOOM = 0.8;

type MapStop = {
  id: string;
  title: string;
  subtitle: string;
  coordinate: [number, number];
};

type MapRegion = {
  id: string;
  label: string;
  centerCoordinate: [number, number];
  zoomLevel: number;
  stops: MapStop[];
};

const MAP_REGIONS: MapRegion[] = [
  {
    id: 'california',
    label: 'California, USA',
    centerCoordinate: [-118.2437, 34.0522],
    zoomLevel: 7.4,
    stops: [
      {
        id: 'santa-monica',
        title: 'Santa Monica Pier',
        subtitle: 'Beach food and sunset spots',
        coordinate: [-118.4965, 34.0094],
      },
      {
        id: 'griffith',
        title: 'Griffith Observatory',
        subtitle: 'City views and skyline photos',
        coordinate: [-118.3004, 34.1184],
      },
      {
        id: 'arts-district',
        title: 'Arts District',
        subtitle: 'Coffee, murals, and galleries',
        coordinate: [-118.235, 34.0447],
      },
    ],
  },
  {
    id: 'new-york',
    label: 'New York, USA',
    centerCoordinate: [-74.006, 40.7128],
    zoomLevel: 8.2,
    stops: [
      {
        id: 'times-square',
        title: 'Times Square',
        subtitle: 'Lights, shows, and street energy',
        coordinate: [-73.9851, 40.758],
      },
      {
        id: 'brooklyn-bridge',
        title: 'Brooklyn Bridge',
        subtitle: 'Walkable route with skyline views',
        coordinate: [-73.9969, 40.7061],
      },
      {
        id: 'central-park',
        title: 'Central Park',
        subtitle: 'Open green space in the city',
        coordinate: [-73.9654, 40.7829],
      },
    ],
  },
  {
    id: 'london',
    label: 'London, UK',
    centerCoordinate: [-0.1276, 51.5072],
    zoomLevel: 8.6,
    stops: [
      {
        id: 'camden',
        title: 'Camden Market',
        subtitle: 'Food stalls and creative shops',
        coordinate: [-0.1425, 51.5416],
      },
      {
        id: 'tower-bridge',
        title: 'Tower Bridge',
        subtitle: 'River walk and iconic views',
        coordinate: [-0.0754, 51.5055],
      },
      {
        id: 'soho',
        title: 'Soho',
        subtitle: 'Nightlife, cafes, and culture',
        coordinate: [-0.1337, 51.5136],
      },
    ],
  },
  {
    id: 'dubai',
    label: 'Dubai, UAE',
    centerCoordinate: [55.2708, 25.2048],
    zoomLevel: 8.4,
    stops: [
      {
        id: 'burj-khalifa',
        title: 'Burj Khalifa',
        subtitle: 'Skyline views and downtown vibe',
        coordinate: [55.2744, 25.1972],
      },
      {
        id: 'bluewaters',
        title: 'Bluewaters Island',
        subtitle: 'Waterfront dining and walks',
        coordinate: [55.1181, 25.0804],
      },
      {
        id: 'al-seef',
        title: 'Al Seef',
        subtitle: 'Old Dubai style and creek views',
        coordinate: [55.2946, 25.2632],
      },
    ],
  },
  {
    id: 'chicago',
    label: 'Chicago, USA',
    centerCoordinate: [-87.6298, 41.8781],
    zoomLevel: 8.4,
    stops: [
      {
        id: 'millennium-park',
        title: 'Millennium Park',
        subtitle: 'Public art and downtown energy',
        coordinate: [-87.6226, 41.8826],
      },
      {
        id: 'navy-pier',
        title: 'Navy Pier',
        subtitle: 'Lakefront views and attractions',
        coordinate: [-87.6079, 41.8917],
      },
      {
        id: 'west-loop',
        title: 'West Loop',
        subtitle: 'Restaurants and city nightlife',
        coordinate: [-87.6477, 41.8827],
      },
    ],
  },
  {
    id: 'austin',
    label: 'Austin, USA',
    centerCoordinate: [-97.7431, 30.2672],
    zoomLevel: 8.6,
    stops: [
      {
        id: 'south-congress',
        title: 'South Congress',
        subtitle: 'Shops, music, and local food',
        coordinate: [-97.7494, 30.2493],
      },
      {
        id: 'zilker-park',
        title: 'Zilker Park',
        subtitle: 'Green space and outdoor hangouts',
        coordinate: [-97.7729, 30.2669],
      },
      {
        id: 'rainey-street',
        title: 'Rainey Street',
        subtitle: 'Bars, patios, and live music',
        coordinate: [-97.7388, 30.2584],
      },
    ],
  },
];

const LOCATION_REGION_MAP: Record<string, string> = {
  'San Diego, CA': 'california',
  'San Jose, CA': 'california',
  'Fresno, CA': 'california',
  'Los Angeles, CA': 'california',
  'San Francisco, CA': 'california',
  'New York, NY': 'new-york',
  'Chicago, IL': 'chicago',
  'Austin, TX': 'austin',
};

const routeLineLayerStyle: LineLayerStyle = {
  lineColor: COLORS.WHITE,
  lineWidth: 3,
  lineOpacity: 0.9,
  lineDasharray: [2, 1.4],
  lineCap: 'round',
  lineJoin: 'round',
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

const PRIDE_BANDS: { color: string; minLon: number; maxLon: number }[] = [
  { color: '#D85B2B', minLon: -180, maxLon: -120 },
  { color: '#E8772E', minLon: -120, maxLon: -60 },
  { color: '#F0A93C', minLon: -60, maxLon: -20 },
  { color: '#F0DC4A', minLon: -20, maxLon: 20 },
  { color: '#9CC73C', minLon: 20, maxLon: 60 },
  { color: '#4FA85E', minLon: 60, maxLon: 100 },
  { color: '#3F8FA3', minLon: 100, maxLon: 140 },
  { color: '#3F6CA7', minLon: 140, maxLon: 180 },
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
  fillColor: '#1E88E5',
  fillOpacity: 1,
};

const atmosphereStyle = {
  color: BG_MATCH,
  highColor: BG_MATCH,
  horizonBlend: 0,
  spaceColor: BG_MATCH,
  starIntensity: 0,
};

const Map = () => {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState(MAP_REGIONS[0].id);
  const [, setSelectedStopId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);

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

  const selectedRegion =
    MAP_REGIONS.find((region) => region.id === selectedRegionId) ?? MAP_REGIONS[0];

  const filteredStops = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return selectedRegion.stops;
    }

    return selectedRegion.stops.filter(
      (stop) =>
        stop.title.toLowerCase().includes(query) ||
        stop.subtitle.toLowerCase().includes(query)
    );
  }, [searchText, selectedRegion]);

  const routeLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features:
        filteredStops.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: filteredStops.map((stop) => [...stop.coordinate]),
                },
              },
            ]
          : [],
    }),
    [filteredStops]
  );

  const focusRegion = useCallback((region: MapRegion) => {
    cameraRef.current?.setCamera({
      centerCoordinate: region.centerCoordinate,
      zoomLevel: region.zoomLevel,
      pitch: 0,
      heading: 0,
      animationDuration: 1400,
      animationMode: 'flyTo',
    });
  }, []);

  const handleSelectRegion = useCallback(
    (region: MapRegion) => {
      setSelectedRegionId(region.id);
      setSelectedStopId(null);
      setSearchText('');
      setIsDropdownOpen(false);
      focusRegion(region);
    },
    [focusRegion]
  );

  const handleMarkerPress = useCallback((stop: MapStop) => {
    setSelectedStopId(stop.id);
    setIsDropdownOpen(false);
    cameraRef.current?.setCamera({
      centerCoordinate: stop.coordinate,
      zoomLevel: 15.2,
      pitch: 0,
      heading: 0,
      animationDuration: 1400,
      animationMode: 'flyTo',
    });
  }, []);

  const handleLocationSelect = useCallback(
    (location: string) => {
      const regionId = LOCATION_REGION_MAP[location];
      const mappedRegion =
        MAP_REGIONS.find((region) => region.id === regionId) ?? selectedRegion;

      setIsLocationModalVisible(false);
      setSelectedRegionId(mappedRegion.id);
      setSelectedStopId(null);
      setSearchText('');
      setIsDropdownOpen(false);
      focusRegion(mappedRegion);
    },
    [focusRegion, selectedRegion]
  );

  const handleResetView = useCallback(() => {
    setSelectedStopId(null);
    setSearchText('');
    setIsDropdownOpen(false);
    cameraRef.current?.setCamera({
      centerCoordinate: INITIAL_CAMERA_CENTER,
      zoomLevel: INITIAL_CAMERA_ZOOM,
      pitch: 0,
      heading: 0,
      animationDuration: 1400,
      animationMode: 'flyTo',
    });
  }, []);

  return (
    <View style={styles.container}>
      <TopHeader title="Map" />

      <View style={styles.search}>
        <CustomSearchInput
          value={searchText}
          onChangeText={setSearchText}
          rightIcon={<Image source={FilterIcon} />}
          onPressRightIcon={() => setIsLocationModalVisible(true)}
        />
      </View>

      <View style={styles.globe}>
        <View style={styles.topSection}>
          <TouchableOpacity
            style={styles.dropdown}
            activeOpacity={0.85}
            onPress={() => setIsDropdownOpen((prev) => !prev)}
          >
            <Text style={styles.dropdownText}>{selectedRegion.label}</Text>
            <DropdownIcon width={11} height={6} />
          </TouchableOpacity>

          {isDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.dropdownMenuContent}
              >
                {MAP_REGIONS.map((region) => (
                  <TouchableOpacity
                    key={region.id}
                    activeOpacity={0.85}
                    style={[
                      styles.dropdownItem,
                      region.id === selectedRegionId && styles.dropdownItemActive,
                    ]}
                    onPress={() => handleSelectRegion(region)}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        region.id === selectedRegionId && styles.dropdownItemTextActive,
                      ]}
                    >
                      {region.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={styles.globeContainer}>
          {Config.MAPBOX_TOKEN && mapReady ? (
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
              onPress={() => setSelectedStopId(null)}
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
              <Mapbox.ShapeSource id="mapRouteLine" shape={routeLine}>
                <Mapbox.LineLayer id="mapRouteLineLayer" style={routeLineLayerStyle} />
              </Mapbox.ShapeSource>
              {filteredStops.map((stop) => (
                <Mapbox.MarkerView
                  key={stop.id}
                  id={stop.id}
                  coordinate={[...stop.coordinate]}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleMarkerPress(stop)}
                    style={styles.markerTapArea}
                  >
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

        <View style={styles.bottomPanel}>
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>Explore {selectedRegion.label}</Text>
            <Text style={styles.hintSubtitle}>
              Tap a pin to zoom into that place. Use the dropdown to switch cities.
            </Text>
          </View>

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={() => focusRegion(selectedRegion)}
            >
              <Text style={styles.secondaryButtonText}>Focus Region</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={handleResetView}
            >
              <Text style={styles.primaryButtonText}>Back to Globe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <LocationModal
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        onNext={handleLocationSelect}
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
  search: {
    marginHorizontal: 24,
  },
  globe: {
    flex: 1,
  },
  topSection: {
    marginTop: 20,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
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
    minWidth: 150,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownText: {
    fontSize: 12,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  dropdownMenu: {
    marginTop: 10,
    width: 184,
    maxHeight: 176,
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    paddingVertical: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  dropdownMenuContent: {
    paddingHorizontal: 8,
  },
  dropdownItem: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: '#E7F4FF',
  },
  dropdownItemText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: 13,
  },
  dropdownItemTextActive: {
    color: COLORS.BUTTON_COLOR,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  globeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: 'hidden',
    backgroundColor: BG_MATCH,
  },
  map: {
    width: '120%',
    height: '100%',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 13,
  },
  markerTapArea: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPanel: {
    paddingHorizontal: 24,
    paddingBottom: 22,
    gap: 14,
  },
  hintCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  hintTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    fontSize: 18,
  },
  hintSubtitle: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: 13,
    lineHeight: 18,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 14,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 14,
  },
});
