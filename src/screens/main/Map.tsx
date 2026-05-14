import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
} from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import Mapbox, { type FillLayerStyle, type LineLayerStyle } from "@rnmapbox/maps";
import Config from "react-native-config";
import type { FeatureCollection, LineString, Polygon } from "geojson";
import TopHeader from "../../components/Home/TopHeader";
import CustomSearchInput from "../../components/Home/CustomSearchInput";
import { COLORS } from "../../constants/colors";
import { FilterIcon } from "../../constants/images";
import { BlueMapIcon, DropdownIcon, SelectedLocationIcon } from "../../constants/icons";
import { FONT_FAMILY } from "../../constants/fonts";

// ─── Seamless edge color ──────────────────────────────────────────────────────
// Bridges the screen background into the globe's ocean blue so the globe rim
// fades cleanly into the page (no hard ring between sphere and screen).
const BG_MATCH = "#7AB4DC";

const MAP_STOPS = [
    { id: "los-angeles", title: "Los Angeles", coordinate: [-118.2437,  34.0522] },
    { id: "new-york",    title: "New York",    coordinate: [ -74.006,   40.7128] },
    { id: "london",      title: "London",      coordinate: [  -0.1276,  51.5072] },
    { id: "cairo",       title: "Cairo",       coordinate: [  31.2357,  30.0444] },
    { id: "dubai",       title: "Dubai",       coordinate: [  55.2708,  25.2048] },
    { id: "mumbai",      title: "Mumbai",      coordinate: [  72.8777,  19.076 ] },
    { id: "nairobi",     title: "Nairobi",     coordinate: [  36.8219,  -1.2921] },
    { id: "rio",         title: "Rio",         coordinate: [ -43.1729, -22.9068] },
] as const;

const routeLineLayerStyle: LineLayerStyle = {
    lineColor:     COLORS.WHITE,
    lineWidth:     3,
    lineOpacity:   0.9,
    lineDasharray: [2, 1.4],
    lineCap:       "round",
    lineJoin:      "round",
};

const roadCasingStyle: LineLayerStyle = {
    lineColor:   "#FFFFFF",
    lineWidth:   ["interpolate", ["linear"], ["zoom"], 5, 0.5, 12, 2, 16, 6],
    lineOpacity: 0.9,
    lineCap:     "round",
    lineJoin:    "round",
};

const roadFillStyle: LineLayerStyle = {
    lineColor:   "#0000FF",
    lineWidth:   ["interpolate", ["linear"], ["zoom"], 5, 0.3, 12, 1.4, 16, 4],
    lineOpacity: 1,
    lineCap:     "round",
    lineJoin:    "round",
};

// ─── Pride rainbow longitude bands ───────────────────────────────────────────
// Vertical stripes painted below the water layer so only land shows color.
// Colors and band edges tuned to match the reference screenshot
// (Americas = warm reds/oranges, Africa/Europe = yellow→green, Asia = teal→blue).
const PRIDE_BANDS: { color: string; minLon: number; maxLon: number }[] = [
    { color: "#D85B2B", minLon: -180, maxLon: -120 }, // red-orange  (Pacific NW / Alaska)
    { color: "#E8772E", minLon: -120, maxLon:  -60 }, // orange      (N. America)
    { color: "#F0A93C", minLon:  -60, maxLon:  -20 }, // amber       (Atlantic / Greenland / S. America east)
    { color: "#F0DC4A", minLon:  -20, maxLon:   20 }, // yellow      (W. Europe / Sahara)
    { color: "#9CC73C", minLon:   20, maxLon:   60 }, // yellow-green(E. Europe / central Africa / Middle East)
    { color: "#4FA85E", minLon:   60, maxLon:  100 }, // green       (Central Asia / India)
    { color: "#3F8FA3", minLon:  100, maxLon:  140 }, // teal        (E. Asia)
    { color: "#3F6CA7", minLon:  140, maxLon:  180 }, // blue        (Far east / Pacific)
];

const prideStripes: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: PRIDE_BANDS.map((b) => ({
        type: "Feature",
        properties: { color: b.color },
        geometry: {
            type:        "Polygon",
            coordinates: [[
                [b.minLon, -90],
                [b.maxLon, -90],
                [b.maxLon,  90],
                [b.minLon,  90],
                [b.minLon, -90],
            ]],
        },
    })),
};

const prideFillStyle: FillLayerStyle = {
    fillColor:   ["get", "color"],
    fillOpacity: 1,
};

// Ocean / lake / river fill — overrides the pale Light-style default with a
// richer, more saturated blue so the rainbow land reads against the water.
const waterFillStyle: FillLayerStyle = {
    fillColor:   "#1E88E5",
    fillOpacity: 1,
};

// All three atmosphere tones = BG_MATCH so the canvas around the globe is
// the exact same color as the screen bg. No lighter halo, no visible ring
// where the globe canvas meets the page.
const atmosphereStyle = {
    color:         BG_MATCH,
    highColor:     BG_MATCH,
    horizonBlend:  0,
    spaceColor:    BG_MATCH,
    starIntensity: 0,
};

const Map = () => {
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!Config.MAPBOX_TOKEN) return undefined;

        Mapbox.setAccessToken(Config.MAPBOX_TOKEN)
            .then(() => { if (isMounted) setMapReady(true);  })
            .catch(() => { if (isMounted) setMapReady(false); });

        return () => { isMounted = false; };
    }, []);

    const routeLine = useMemo<FeatureCollection<LineString>>(
        () => ({
            type: "FeatureCollection",
            features: [{
                type:       "Feature",
                properties: {},
                geometry: {
                    type:        "LineString",
                    coordinates: MAP_STOPS.map((s) => [...s.coordinate]),
                },
            }],
        }),
        []
    );

    return (
        <View style={styles.container}>
            <TopHeader title="Map" />

            <View style={styles.search}>
                <CustomSearchInput rightIcon={<Image source={FilterIcon} />} />
            </View>

            <View style={styles.globe}>
                <View style={styles.topSection}>
                    <TouchableOpacity style={styles.dropdown}>
                        <Text style={styles.dropdownText}>California, USA</Text>
                        <DropdownIcon width={11} height={6} />
                    </TouchableOpacity>
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
                            pitchEnabled
                            scrollEnabled
                            zoomEnabled
                            surfaceView={false}
                        >
                            <Mapbox.Camera
                                centerCoordinate={[-18, 18]}
                                zoomLevel={0.8}
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
                                <Mapbox.LineLayer
                                    id="mapRouteLineLayer"
                                    style={routeLineLayerStyle}
                                />
                            </Mapbox.ShapeSource>
                            {MAP_STOPS.map((stop) => (
                                <Mapbox.MarkerView
                                    key={stop.id}
                                    id={stop.id}
                                    coordinate={[...stop.coordinate]}
                                    anchor={{ x: 0.5, y: 1 }}
                                >
                                    <View style={styles.markerTapArea}>
                                        <BlueMapIcon width={40} height={40} />
                                    </View>
                                </Mapbox.MarkerView>
                            ))}
                        </Mapbox.MapView>
                    ) : (
                        <View style={styles.mapFallback}>
                            <Text style={styles.mapFallbackText}>
                                {Config.MAPBOX_TOKEN ? "Loading map..." : "Mapbox token missing"}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

export default Map;

const styles = StyleSheet.create({
    container: {
        flex:            1,
        backgroundColor: BG_MATCH, // fallback while image loads
    },
    search: {
        marginHorizontal: 24,
    },
    globe: {
        flex: 1,
    },
    topSection: {
        marginTop:         20,
        paddingHorizontal: 24,
        alignItems:        "flex-start",
        zIndex:            10,
    },
    dropdown: {
        flexDirection: "row",
        gap:               10,
        paddingHorizontal: 16,
        alignItems:        "center",
        justifyContent:    "center",
        backgroundColor:   COLORS.WHITE,
        height:            32,
        width:             134,
        borderRadius:      16,
        elevation:         3,
        shadowColor:       "#000",
        shadowOffset:      { width: 0, height: 2 },
        shadowOpacity:     0.1,
        shadowRadius:      4,
    },
    dropdownText: {
        fontSize:   12,
        color:      COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },
    globeContainer: {
        flex:              1,
        justifyContent:    "center",
        alignItems:        "center",
        paddingHorizontal: 16,
        paddingVertical:   24,
        overflow:          "hidden",
        // Same BG_MATCH on both platforms — no MapBackground image is rendered,
        // so any difference vs the screen bg would show as a seam at the
        // globeContainer edge.
        backgroundColor:   BG_MATCH,
    },
    map: {
        width:  "120%",
        height: "120%",
    },
    mapFallback: {
        flex:           1,
        alignItems:     "center",
        justifyContent: "center",
    },
    mapFallbackText: {
        color:      COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        fontSize:   13,
    },
    markerTapArea: {
        width:          48,
        height:         48,
        alignItems:     "center",
        justifyContent: "center",
    },
});