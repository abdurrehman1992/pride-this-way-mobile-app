import { toastConfig } from '../../utils/toastConfig';
import { checkInternetConnection } from '../../utils/networkStatus';
import ActionTouchable from "../common/ActionTouchable";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    Keyboard,
    Platform,
    ActivityIndicator,
    Animated,
    PanResponder,
    KeyboardAvoidingView,
    StatusBar,
} from "react-native";

import {
    requestLocationPermission,
    getCurrentPosition,
    getAddressFromCoords,
} from "../../utils/location";
import { suggestLocations } from "../../services/aiService";
import { searchLocationSuggestions } from "../../services/myTourService";
import { CustomAlert } from "../../utils/CustomAlert";

import {
    ModalCloseIcon,
    SelectLocationInput,
    SelectedLocationIcon,
    CurrentLocationIcon,
} from "../../constants/icons";

import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";

interface Props {
    visible: boolean;
    onClose: () => void;
    onNext: (location: string) => void;
    title?: string;
    locations?: string[];
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    loadingSuggestions?: boolean;
    showActions?: boolean;
    primaryLabel?: string;
    secondaryLabel?: string;
    onSecondaryPress?: () => void;
    cityOnlyResults?: boolean;
}
const DEFAULT_LOCATION_LIST = [
    "San Diego, CA",
    "San Jose, CA",
    "Fresno, CA",
    "Los Angeles, CA",
    "San Francisco, CA",
    "New York, NY",
    "Chicago, IL",
    "Austin, TX",
];

// Tour recommendations require a real city, not a neighborhood or housing
// scheme. Keep the final guard here as well as in the search service so stale
// or cached suggestions can never reach the selectable list.
const isCityOnlyLabel = (value: string) => {
    const parts = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    if (parts.length < 3) return false;

    const firstPart = parts[0].toLowerCase();
    const areaWords = [
        'bahria',
        'dha',
        'defence',
        'model town',
        'phase ',
        'township',
        'colony',
        'society',
        'housing',
        'sector ',
        'block ',
        'village',
        'neighborhood',
        'district',
    ];

    return !areaWords.some((word) => firstPart.includes(word));
};

const LocationModal: React.FC<Props> = ({
    visible,
    onClose,
    onNext,
    title = "Select Your Location",
    locations,
    searchValue,
    onSearchChange,
    loadingSuggestions,
    cityOnlyResults = false,
}) => {
    const [internalSearch, setInternalSearch] = useState("");
    const [selected, setSelected] = useState("");
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [locationToast, setLocationToast] = useState<{
        title: string; message: string;
    } | null>(null);

    useEffect(() => {
        if (!visible) {
            setLocationToast(null);
            return;
        }
        if (!locationToast) return;
        const timer = setTimeout(() => setLocationToast(null), 3500);
        return () => clearTimeout(timer);
    }, [visible, locationToast]);

    const showLocationToast = (toastTitle: string, message: string) => {
        setLocationToast({ title: toastTitle, message });
    };

    const requireLocationInternet = async () => {
        if (await checkInternetConnection()) return true;
        showLocationToast('No internet connection', 'Your internet is off. Please connect and try again.');
        return false;
    };
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [aiCities, setAiCities] = useState<string[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const didInitializeOpenRef = useRef(false);
    const search = searchValue ?? internalSearch;
    const useExternal = locations !== undefined;

    const panY = useRef(new Animated.Value(1000)).current;
    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
        const keyboardShowListener = Keyboard.addListener(showEvent, () => {
            setKeyboardVisible(true);
        });
        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardVisible(false);
        });

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    useEffect(() => {
        if (visible) {
            Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 10,
            }).start();
        } else {
            panY.setValue(1000);
        }
    }, [visible, panY]);

    // Set the initial selection only once per modal opening. Previously this
    // re-ran after every typed character and treated the query (e.g. "lahore")
    // as a completed selection, which hides the suggestion list below.
    useEffect(() => {
        if (!visible) {
            didInitializeOpenRef.current = false;
            return;
        }
        if (didInitializeOpenRef.current) return;

        didInitializeOpenRef.current = true;
        if (useExternal) {
            setInternalSearch(searchValue || '');
            setSelected(searchValue || '');
        } else {
            setInternalSearch('');
            setSelected('');
        }
    }, [visible, useExternal, searchValue]);

    useEffect(() => {
        if (useExternal || !visible) return;
        let cancelled = false;

        setAiLoading(true);
        const handle = setTimeout(async () => {
            try {
                if (search.trim()) {
                    // Use the same strict city-only geocoder as tour creation.
                    // The AI autocomplete can return neighborhoods/areas.
                    const results = await searchLocationSuggestions(search);
                    if (!cancelled) setAiCities(results.map((item) => item.label));
                } else {
                    const cities = await suggestLocations('');
                    if (!cancelled) setAiCities(cities);
                }
            } catch (err) {
                console.warn("[LocationModal] suggestLocations failed", err);
                if (!cancelled) setAiCities(DEFAULT_LOCATION_LIST);
            } finally {
                if (!cancelled) setAiLoading(false);
            }
        }, search.trim() ? 400 : 0);

        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [search, visible, useExternal]);

    const closeWithAnimation = () => {
        Animated.timing(panY, {
            toValue: 1000,
            duration: 300,
            useNativeDriver: true,
        }).start(() => onClose());
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) panY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 150) closeWithAnimation();
                else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const sheetHeight =
        isKeyboardVisible
            ? Platform.OS === "ios"
                ? "90%"
                : "92%"
            : Platform.OS === "ios"
                ? "65%"
                : "70%";

    const filteredLocations = useMemo(() => {
        if (useExternal) {
            const rawList = locations as string[];
            const list = cityOnlyResults ? rawList.filter(isCityOnlyLabel) : rawList;
            if (!search.trim()) return list;
            return list.filter((item) =>
                item.toLowerCase().includes(search.toLowerCase())
            );
        }
        return cityOnlyResults ? aiCities.filter(isCityOnlyLabel) : aiCities;
    }, [locations, search, useExternal, aiCities, cityOnlyResults]);

    const showLoadingSuggestions = useExternal
        ? !!loadingSuggestions
        : aiLoading;

    const normalizeLocationString = (address: string) => {
        const parts = address
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);

        if (parts.length === 0) return "";

        const country = parts[parts.length - 1];

        const cleanPart = (part: string) =>
            part
                .replace(/\b(City|Tehsil|District|Division|Province|Region|State|County|Municipality|Union Council)\b/gi, "")
                .replace(/\s+/g, " ")
                .trim();

        const cleaned = parts.map(cleanPart).filter(Boolean);
        if (cleaned.length === 1) return cleaned[0];

        for (let i = cleaned.length - 2; i >= 0; i -= 1) {
            const part = cleaned[i];
            if (/^\d{3,}$/.test(part)) continue;
            if (/^(Punjab|Sindh|Balochistan|Khyber Pakhtunkhwa|KP|Gilgit|Azad Kashmir|Islamabad)$/i.test(part)) continue;
            return `${part}, ${country}`;
        }

        return `${cleaned[0]}, ${country}`;
    };

    const handleSelect = (item: string) => {
        if (onSearchChange) {
            onSearchChange(item);
        } else {
            setInternalSearch(item);
        }
        setSelected(item);
        Keyboard.dismiss();
    };

    const getCurrentLocation = async () => {
        if (!(await requireLocationInternet())) return;
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            CustomAlert.alert(
                "Permission Required",
                "Please allow location access in your device settings."
            );
            return;
        }

        setLoadingLocation(true);

        try {
            let pos;
            try {
                pos = await getCurrentPosition({
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 15000,
                });
            } catch {
                pos = await getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 10000,
                });
            }

            if (!(await requireLocationInternet())) return;
            const addr = await getAddressFromCoords(
                pos.coords.latitude,
                pos.coords.longitude
            );
            // Connectivity can disappear while GPS or reverse geocoding is running.
            if (!(await requireLocationInternet())) return;
            // The shared geocoder falls back to coordinates. This location
            // picker accepts an address only; leave its selection untouched.
            if (/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(addr)) {
                showLocationToast('Location unavailable', 'Unable to find your address. Please try again.');
                return;
            }
            const normalizedAddress = normalizeLocationString(addr);

            if (onSearchChange) {
                onSearchChange(normalizedAddress);
            } else {
                setInternalSearch(normalizedAddress);
            }
            setSelected(normalizedAddress);
            // console.log("Current location :", normalizedAddress)
        } catch {
            if (!(await requireLocationInternet())) return;
            showLocationToast('Location unavailable', 'Unable to fetch your location. Please try again.');
        } finally {
            setLoadingLocation(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent={Platform.OS === 'android'}
            animationType="fade"
            onRequestClose={closeWithAnimation}
        >
            {visible && Platform.OS === 'android' ? (
                <StatusBar
                    translucent
                    backgroundColor="transparent"
                    barStyle="light-content"
                />
            ) : null}
            <KeyboardAvoidingView
                // Android's height behavior can leave the transparent modal
                // viewport shortened after the keyboard is dismissed. That
                // moves the sheet upward and exposes the tab bar underneath.
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}
                style={styles.overlay}
            >

                <ActionTouchable
                    activeOpacity={1}
                    style={StyleSheet.absoluteFill}
                    onPress={closeWithAnimation}
                />

                <Animated.View
                    style={[
                        styles.bottomSheet,
                        isKeyboardVisible && styles.bottomSheetKeyboard,
                        {
                            height: sheetHeight,
                            transform: [{ translateY: panY }],
                        },
                    ]}
                >
                    <View {...panResponder.panHandlers} style={styles.dragHandle}>
                        <ActionTouchable onPress={closeWithAnimation}>
                            <ModalCloseIcon width={38} height={12} />
                        </ActionTouchable>
                    </View>

                    <Text style={[styles.title, isKeyboardVisible && styles.titleKeyboard]}>
                        {title}
                    </Text>
                    <View style={styles.inputBox}>
                        <SelectLocationInput width={25} height={25} />
                        <TextInput
                            style={styles.input}
                            placeholderTextColor={COLORS.TEXT_PRIMARY}
                            value={search}
                            onChangeText={(value) => {
                                if (onSearchChange) {
                                    onSearchChange(value);
                                } else {
                                    setInternalSearch(value);
                                }
                                setSelected("");
                            }}
                            placeholder="Search location..."
                        />
                        {!!search && (
                            <ActionTouchable
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (onSearchChange) {
                                        onSearchChange("");
                                    } else {
                                        setInternalSearch("");
                                    }

                                    setSelected("");
                                }}
                            >
                                <View style={styles.clearButton}>
                                    <Text style={styles.clearText}>✕</Text>
                                </View>
                            </ActionTouchable>
                        )}
                    </View>
                    <ActionTouchable
                        style={styles.currentLocation}
                        onPress={getCurrentLocation}
                        disabled={loadingLocation}
                    >
                        {loadingLocation ? (
                            <ActivityIndicator color={COLORS.BUTTON_COLOR} />
                        ) : (
                            <CurrentLocationIcon width={36} height={36} />
                        )}

                        <Text style={styles.secondaryText}>
                            Use My Current Location
                        </Text>
                    </ActionTouchable>

                    <ScrollView
                        style={styles.locationList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={[
                            styles.scrollContent,
                            !isKeyboardVisible &&
                            filteredLocations.length <= 3 &&
                            styles.scrollContentBottom,
                        ]}
                    >
                        {showLoadingSuggestions ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator color={COLORS.BUTTON_COLOR} />
                            </View>
                        ) : filteredLocations.length > 0 && !selected ? ( // Added "&& !selected" here
                            <>
                                {filteredLocations.map((item, i) => (
                                    <ActionTouchable
                                        key={i}
                                        style={styles.locationItem}
                                        onPress={() => handleSelect(item)}
                                    >
                                        <SelectedLocationIcon width={36} height={36} />
                                        <Text
                                            style={styles.locationText}
                                            numberOfLines={2}
                                            ellipsizeMode="tail"
                                        >
                                            {item}
                                        </Text>
                                    </ActionTouchable>
                                ))}
                            </>
                        ) : (
                            // Only show "No location found" if the user hasn't selected an item yet
                            !selected && (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>
                                        No location found
                                    </Text>
                                </View>
                            )
                        )}
                    </ScrollView>

                    <ActionTouchable
                        style={[
                            styles.primaryBtnFull,
                            (!selected || !selected.trim()) && styles.primaryBtnDisabled,
                        ]}
                        disabled={!selected || !selected.trim()}
                        onPress={() => {
                            const value = selected?.trim();
                            if (!value) {
                                CustomAlert.alert(
                                    'Please select a location',
                                    'Choose a location first before continuing.'
                                );
                                return;
                            }

                            return onNext(value);
                        }}
                    >
                        <Text style={styles.primaryText}>Next</Text>
                    </ActionTouchable>

                </Animated.View>
                {visible && locationToast && (
                    <View
                        pointerEvents="none"
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                        style={styles.locationToast}
                    >
                        {toastConfig.info({ text1: locationToast.title, text2: locationToast.message })}
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default LocationModal;
const styles = StyleSheet.create({
    // Render inside the native modal, above its elevated bottom sheet.
    locationToast: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 100,
        zIndex: 1000,
        elevation: 30,
    },
    overlay: {
        flex: 1,
        width: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    bottomSheet: {
        backgroundColor: COLORS.WHITE,
        paddingHorizontal: 24,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === "ios" ? 40 : 20,
        zIndex: 100,
        elevation: 24,
    },
    clearButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#E5E5E5",
        alignItems: "center",
        justifyContent: "center",
    },

    clearText: {
        fontSize: 11,
        color: "#666",
        fontWeight: "700",
    },
    bottomSheetKeyboard: {
        paddingBottom: Platform.OS === "ios" ? 16 : 14,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    locationList: {
        flex: 1,
        minHeight: 0,
    },
    scrollContentBottom: {
        flexGrow: 1,
        justifyContent: "flex-start",
    },
    locationItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 56,
        paddingHorizontal: 4,
    },
    currentLocation: {
        height: 56,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor: COLORS.CURRENT_LOCATION_BTN,
        flexDirection: "row",
        paddingHorizontal: 10,
        gap: 10,
        marginTop: 10,
    },
    dragHandle: {
        alignItems: "center",
        paddingTop: 12,
    },
    title: {
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        marginVertical: 20,
        color: COLORS.TEXT_PRIMARY,
    },
    titleKeyboard: {
        marginTop: 16,
        marginBottom: 14,
    },
    inputBox: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.MODAL_INPUT_COLOR,
        borderRadius: 100,
        paddingHorizontal: 16,
        height: 49,
        gap: 10,
        marginBottom: 12,
    },
    input: {
        flex: 1,
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
    },
    locationText: {
        flex: 1,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_PRIMARY,
        lineHeight: 24,
    },
    primaryBtnFull: {
        width: "100%",
        height: 50,
        backgroundColor: COLORS.BUTTON_COLOR,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    primaryBtnDisabled: {
        opacity: 0.5,
    },
    secondaryText: {
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        fontSize: FONT_SIZE.TEXT,
    },
    primaryText: {
        color: COLORS.WHITE,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        fontSize: FONT_SIZE.TEXT,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 20,
    },
    emptyText: {
        color: "#999",
        fontFamily: FONT_FAMILY.InterTight_Regular,
        textAlign: 'center'
    },
});
