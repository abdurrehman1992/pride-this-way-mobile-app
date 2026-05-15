import React, { useState, useMemo, useEffect, useRef } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ScrollView,
    Keyboard,
    Platform,
    ActivityIndicator,
    Alert,
    Animated,
    PanResponder,
    KeyboardAvoidingView
} from "react-native";

import {
    requestLocationPermission,
    getCurrentPosition,
    getAddressFromCoords,
} from "../../utils/location";

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

const LocationModal: React.FC<Props> = ({
    visible,
    onClose,
    onNext,
    title = "Select Your Location",
    locations = DEFAULT_LOCATION_LIST,
    searchValue,
    onSearchChange,
    loadingSuggestions = false,
}) => {
    const [internalSearch, setInternalSearch] = useState("");
    const [selected, setSelected] = useState("");
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const search = searchValue ?? internalSearch;

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
        if (!search.trim()) return locations;
        return locations.filter((item) =>
            item.toLowerCase().includes(search.toLowerCase())
        );
    }, [locations, search]);

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
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            Alert.alert(
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

            const addr = await getAddressFromCoords(
                pos.coords.latitude,
                pos.coords.longitude
            );

            if (onSearchChange) {
                onSearchChange(addr);
            } else {
                setInternalSearch(addr);
            }
            setSelected(addr);
        } catch (error) {
            console.log("LOCATION ERROR:", error);
            Alert.alert("Error", "Unable to fetch location");
        } finally {
            setLoadingLocation(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={closeWithAnimation}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
                style={styles.overlay}
            >

                <TouchableOpacity
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
                        <TouchableOpacity onPress={closeWithAnimation}>
                            <ModalCloseIcon width={38} height={12} />
                        </TouchableOpacity>
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
                    </View>

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
                        {loadingSuggestions ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator color={COLORS.BUTTON_COLOR} />
                            </View>
                        ) : filteredLocations.length > 0 ? (
                            <>
                                {filteredLocations.map((item, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.locationItem}
                                        onPress={() => handleSelect(item)}
                                    >
                                        <SelectedLocationIcon width={36} height={36} />
                                        <Text style={styles.locationText}>{item}</Text>
                                    </TouchableOpacity>
                                ))}

                                <TouchableOpacity
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
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>
                                    No location found
                                </Text>

                                <TouchableOpacity
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
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    {/* BUTTON */}
                    <TouchableOpacity
                        style={[
                            styles.primaryBtnFull,
                            (!selected && !search) && styles.primaryBtnDisabled,
                        ]}
                        disabled={!selected && !search}
                        onPress={() => onNext(selected || search)}
                    >
                        <Text style={styles.primaryText}>Next</Text>
                    </TouchableOpacity>

                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default LocationModal;
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    bottomSheet: {
        backgroundColor: COLORS.WHITE,
        paddingHorizontal: 24,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === "ios" ? 40 : 20,
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
        justifyContent: "flex-end",
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
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_PRIMARY,
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
