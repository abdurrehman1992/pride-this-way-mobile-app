import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Keyboard,
    Platform
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { FilterIcon } from "../../constants/images";
import { MapIconMain } from "../../constants/icons";

import TopHeader from "../../components/Home/TopHeader";
import CustomSearchInput from "../../components/Home/CustomSearchInput";
import LocationModal from "../../components/modals/LocationModal";
import PreferenceModal from "../../components/modals/PreferenceModal";
import ForYouContent from "../../components/Home/ForYouContent";
import { useEffect } from "react";
import { KeyboardAvoidingView } from "react-native";



const ForYou = () => {
    const bottomHeight = useBottomTabBarHeight();

    const [isPreferencesSet, setIsPreferencesSet] = useState(false);

    const [modals, setModals] = useState({
        location: false,
        preference: false,
    });

    const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);

    const openModal = (key: keyof typeof modals) =>
        setModals((p) => ({ ...p, [key]: true }));

    const closeAllModals = () =>
        setModals({ location: false, preference: false });

    const goNextModal = (from: keyof typeof modals, to: keyof typeof modals) => {
        setModals((p) => ({ ...p, [from]: false, [to]: true }));
    };

    const togglePreference = (item: string) => {
        setSelectedPrefs((prev) =>
            prev.includes(item)
                ? prev.filter((i) => i !== item)
                : [...prev, item]
        );
    };

    const handleApply = () => {
        closeAllModals();
        setIsPreferencesSet(true);
    };

    const handleCancel = () => {
        closeAllModals();
        setSelectedPrefs([]);
        setIsPreferencesSet(false);
    };

    const [flexToggle, setFlexToggle] = useState(false);


    useEffect(() => {
        const keyboardShowListener = Keyboard.addListener("keyboardDidShow", () => {
            setFlexToggle(false);
        });

        const keyboardHideListener = Keyboard.addListener("keyboardDidHide", () => {
            setFlexToggle(true);
        });

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    return (
        
       // Source - https://stackoverflow.com/a/79665003
// Posted by Iulian T, modified by community. See post 'Timeline' for change history
// Retrieved 2026-05-14, License - CC BY-SA 4.0

<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
  style={
    flexToggle
      ? [{ flexGrow: 1 }, styles.container]
      : [{ flex: 1 }, styles.container]
  }
  enabled={!flexToggle}
>


            {/* HEADER */}
            <TopHeader title="Recommendations" />

            {/* BODY */}
            {isPreferencesSet ? (
                <ForYouContent />
            ) : (
                <View style={styles.centerContainer}>
                    <View style={styles.emptyStateWrapper}>
                        <MapIconMain width={190} height={121} />
                        <Text style={styles.noTours}>
                            Explore What’s Around You
                        </Text>
                        <Text style={styles.desc}>
                            Add your location and select your preferences to
                            discover personalized places.
                        </Text>
                        <TouchableOpacity
                            style={styles.btnContainer}
                            onPress={() => openModal("location")}
                        >
                            <Text style={styles.btn}>Add Location</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <LocationModal
                visible={modals.location}
                showActions={true}
                primaryLabel="Apply"
                secondaryLabel="Cancel"
                onClose={handleCancel}
                onSecondaryPress={handleCancel}
                onNext={() => goNextModal("location", "preference")}
            />

            <PreferenceModal
                visible={modals.preference}
                selectedPrefs={selectedPrefs}
                togglePreference={togglePreference}
                clearAll={() => setSelectedPrefs([])}
                onClose={handleCancel}
                onPrimary={handleApply}
                onSecondary={handleCancel}
                mode="forYou"
                showTwoButtons={true}
            />

        </KeyboardAvoidingView>
    );
};

export default ForYou;
const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: "#F9F9F9",
    },

    /* FULL SCREEN CENTERING AREA */
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },

    /* CONTENT BLOCK */
    emptyStateWrapper: {
        justifyContent: "center",
        alignItems: "center",
    },

    noTours: {
        marginTop: 30,
        fontSize: FONT_SIZE.LARGE_TEXT,
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        textAlign: "center",
    },

    desc: {
        marginTop: 14,
        textAlign: "center",
        fontSize: FONT_SIZE.TEXT,
        color: COLORS.TEXT_SECONDARY,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        width: 327,
        lineHeight: 22,
    },

    btnContainer: {
        marginTop: 28,
        backgroundColor: COLORS.BUTTON_COLOR,
        height: 50,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 52,
    },

    btn: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },
});