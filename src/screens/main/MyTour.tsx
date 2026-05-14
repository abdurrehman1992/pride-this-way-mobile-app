import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
    CreatedTourLocationIcon,
    EarnedPointIcon,
    IconDelete,
    IconPlus,
    IconUp,
    MapIconMain,
    TourDateIcon,
    TourLocationIcon,
} from "../../constants/icons";
import TopHeader from "../../components/Home/TopHeader";
import CustomButton from "../../components/common/CustomButton";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { PLACES_ARROUND } from "../../constants/images";
import LocationModal from "../../components/modals/LocationModal";
import PreferenceModal from "../../components/modals/PreferenceModal";
import NameTourModal from "../../components/modals/NameTourModal";
import { MyTourStackParamList } from "../../types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { showError, showInfo, showSuccess } from "../../components/common/AppToast";
type NavigationProp = NativeStackNavigationProp<
    MyTourStackParamList,
    "AddLocations"
>;
const MyTour = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<NavigationProp>();
    const bottomHeight = useBottomTabBarHeight();
    const [modals, setModals] = useState({
        location: false,
        preference: false,
        name: false,
    });
    const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
    const [tourName, setTourName] = useState("");
    const [tours, setTours] = useState<any[]>([]);
    const [pendingLocation, setPendingLocation] = useState<string | null>(null);
    const openModal = (key: keyof typeof modals) =>
        setModals((prev) => ({
            ...prev,
            [key]: true,
        }));
    const closeModal = (key: keyof typeof modals) =>
        setModals((prev) => ({
            ...prev,
            [key]: false,
        }));
    const goNextModal = (
        from: keyof typeof modals,
        to: keyof typeof modals
    ) => {
        setModals((prev) => ({
            ...prev,
            [from]: false,
            [to]: true,
        }));
    };
    const togglePreference = useCallback((item: string) => {
        setSelectedPrefs((prev) =>
            prev.includes(item)
                ? prev.filter((i) => i !== item)
                : [...prev, item]
        );
    }, []);

    const clearPreferences = () => {
        setSelectedPrefs([]);
    };
    // When arriving from MyTourStart → AddLocations with a chosen location,
    // store it and jump straight to the name step.
    useEffect(() => {
        const incoming = route.params?.pendingLocation;
        if (!incoming) return;
        setPendingLocation(incoming);
        openModal("name");
    }, [route.params?.pendingLocation]);

    useEffect(() => {
        const selectedLocation = route.params?.selectedLocation;
        const tourId = route.params?.tourId;

        if (!selectedLocation || !tourId) {
            return;
        }

        setTours((prevTours) => {
            return prevTours.map((tour) => {
                if (tour.id !== tourId) {
                    return tour;
                }
                const existingLocations = tour.locations || [];
                if (existingLocations.includes(selectedLocation)) {
                    showInfo("Location already exists in this tour",)
                    return tour;
                }
                return {
                    ...tour,
                    locations: [...existingLocations, selectedLocation],
                    isOpen: true,
                };
            });
        });
    }, [route.params?.timestamp]);

    const handleConfirmTour = () => {
        const initialLocations = pendingLocation
            ? [pendingLocation]
            : ["Clifton Beach", "Boat Basin", "Frere Hall", "Dolmen Mall", "Defense Block H"];

        const newTour = {
            id: Date.now(),
            name: tourName || "City Explorer Tour",
            prefs: selectedPrefs,
            locations: initialLocations,
            isOpen: true,
        };

        setTours((prev) => [...prev, newTour]);
        setTourName("");
        setPendingLocation(null);
        closeModal("name");
    };
    const toggleTour = (id: number) => {
        setTours((prev) =>
            prev.map((tour) =>
                tour.id === id
                    ? {
                        ...tour,
                        isOpen: !tour.isOpen,
                    }
                    : tour
            )
        );
    };

    const deleteTour = (id: number) => {
        setTours((prev) => prev.filter((tour) => tour.id !== id));
    };

    const deleteLocation = (tourId: number, index: number) => {
        setTours((prev) =>
            prev.map((tour) =>
                tour.id === tourId
                    ? {
                        ...tour,
                        locations: tour.locations.filter(
                            (_: string, i: number) => i !== index
                        ),
                    }
                    : tour
            )
        );
        showError("Location Deleted successfully")
    };

    const renderEmptyState = () => (
        <View
            style={[
                styles.content,
                { paddingBottom: bottomHeight + 40 },
            ]}
        >
            <MapIconMain width={190} height={121.32} />

            <Text style={styles.noTours}>No Tours Yet</Text>

            <Text style={styles.desc}>
                You haven't planned any adventures. Create your first
                tour to start exploring the city.
            </Text>

            <TouchableOpacity
                style={styles.btnContainer}
                onPress={() => openModal("location")}
            >
                <Text style={styles.btn}>Start A Tour</Text>
            </TouchableOpacity>
        </View>
    );

    const renderTourCard = (tour: any) => (
        <TouchableOpacity
            key={tour.id}
            style={styles.tourCard}
            onPress={() => navigation.navigate("MyTourStart", { tourId: tour.id })}
        >
            <View style={styles.cardTop}>
                <Image
                    source={{ uri: PLACES_ARROUND }}
                    style={styles.imagePlaceholder}
                />
                <View style={styles.cardInfo}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.tourTitle}>
                            {tour.name}
                        </Text>

                        <View style={styles.iconRow}>
                            <TouchableOpacity
                                style={styles.topIcons}
                                onPress={() => deleteTour(tour.id)}
                            >
                                <IconDelete width={15} height={15} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.topIcons}
                                onPress={() => toggleTour(tour.id)}
                            >
                                <IconUp width={15} height={15} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.iconInfoRow}>
                        <View style={styles.iconTextGroup}>
                            <TourLocationIcon width={20} height={20} />
                            <Text style={styles.textInfo}>
                                Visit {tour.locations.length} Locations
                            </Text>
                        </View>

                        <View style={styles.iconTextGroup}>
                            <TourDateIcon width={20} height={20} />
                            <Text style={styles.textInfo}>
                                May 06, 2026
                            </Text>
                        </View>
                    </View>

                    <View style={styles.iconInfoRow}>
                        <View style={styles.iconTextGroup}>
                            <EarnedPointIcon width={20} height={20} />
                            <Text style={styles.textInfo}>
                                Earn{" "}
                                <Text style={styles.textGreen}>
                                    +75
                                </Text>{" "}
                                Points
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {tour.isOpen && (
                <View style={styles.cardBottom}>
                    <View style={styles.locationHeader}>
                        <Text style={styles.locationTitle}>
                            Locations
                        </Text>

                        <TouchableOpacity
                            style={styles.addLocBtn}
                            onPress={() =>
                                navigation.navigate(
                                    "AddLocations",
                                    {
                                        tourId: tour.id,
                                    }
                                )
                            }
                        >
                            <IconPlus width={11} height={11} />
                            <Text style={styles.addLocation}>
                                Add Locations
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {tour.locations.map(
                        (loc: string, index: number) => (
                            <View
                                key={index}
                                style={styles.locationRow}
                            >
                                <View style={styles.locationLeft}>
                                    <CreatedTourLocationIcon
                                        width={20}
                                        height={20}
                                    />

                                    <Text
                                        style={styles.locationText}
                                    >
                                        {loc}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() =>
                                        deleteLocation(
                                            tour.id,
                                            index
                                        )
                                    }
                                >
                                    <IconDelete
                                        width={16}
                                        height={16}
                                    />
                                </TouchableOpacity>
                            </View>
                        )
                    )}
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <TopHeader title="My Tour" />

            {tours.length <= 0 ? (
                renderEmptyState()
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        flexGrow: 1,
                    }}
                >
                    <View style={styles.tourList}>
                        {tours.map(renderTourCard)}
                    </View>

                    <View style={styles.bottomBtn}>
                        <CustomButton
                            title="Start A Tour"
                            onPress={() =>
                                openModal("location")
                            }
                        />
                    </View>
                </ScrollView>
            )}

            <LocationModal
                visible={modals.location}
                onClose={() => closeModal("location")}
                onNext={() =>
                    goNextModal("location", "preference")
                }
                showActions={false}
                primaryLabel="Next"
            />
            <PreferenceModal
                visible={modals.preference}
                selectedPrefs={selectedPrefs}
                togglePreference={togglePreference}
                clearAll={clearPreferences}
                onClose={() => closeModal("preference")}
                mode="myTour"
                showTwoButtons={true}
                secondaryLabel="Back"
                primaryLabel="Next"
                onSecondary={() => {
                    closeModal("preference");
                    openModal("location");
                }}
                onPrimary={() => {
                    closeModal("preference");
                    openModal("name");
                }}
            />

            {/* NAME TOUR MODAL */}

            <NameTourModal
                visible={modals.name}
                tourName={tourName}
                setTourName={setTourName}
                onClose={() => closeModal("name")}
                onConfirm={handleConfirmTour}
            />
        </View>
    );
};

export default MyTour;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9F9F9",
    },

    content: {
        flex: 1,
        marginTop: 149,
        justifyContent: "center",
        alignItems: "center",
    },

    noTours: {
        marginTop: 30,
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },

    desc: {
        marginTop: 14,
        width: 327,
        textAlign: "center",
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
    },

    btnContainer: {
        marginTop: 28,
        paddingHorizontal: 52,
        height: 50,
        borderRadius: 40,
        backgroundColor: COLORS.BUTTON_COLOR,
        justifyContent: "center",
        alignItems: "center",
    },

    btn: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },

    tourList: {
        flex: 1,
        paddingHorizontal: 23,
        paddingTop: 27,
    },

    bottomBtn: {
        width: "100%",
        paddingHorizontal: 23,
        paddingBottom: 26,
    },

    tourCard: {
        width: "100%",
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: COLORS.WHITE,
        overflow: "hidden",

        elevation: 2,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },

    cardTop: {
        flexDirection: "row",
        padding: 16,
        alignItems: "center",
    },

    imagePlaceholder: {
        width: 70,
        height: 70,
        borderRadius: 6.7,
    },

    cardInfo: {
        flex: 1,
        marginLeft: 12,
        gap: 5,
    },

    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    iconRow: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
    },

    tourTitle: {
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },

    iconInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: 12,
    },
    topIcons: { height: 20, width: 20, alignItems: 'center', justifyContent: 'center' },
    iconTextGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexShrink: 1,
    },

    textInfo: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
        flexShrink: 1,
    },

    textGreen: {
        color: COLORS.TEXT_GREEN,
    },

    cardBottom: {
        marginHorizontal: 16,
        marginBottom: 16,
        paddingHorizontal: 12,
        paddingVertical: 18,
        borderRadius: 12,
        backgroundColor: "#95D8EA20",
    },

    locationHeader: {
        marginBottom: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    locationTitle: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },

    addLocBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },

    addLocation: {
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.BUTTON_COLOR,
    },

    locationRow: {
        paddingVertical: 6,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    locationLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
    },

    locationText: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_PRIMARY,
    },
});

