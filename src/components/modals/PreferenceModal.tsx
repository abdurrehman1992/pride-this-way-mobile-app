import React, { useRef, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    PanResponder,
    ScrollView,
    Platform,
    Pressable,
} from "react-native";

import {
    AddPreferenceIcon,
    PreferenceIcon,
} from "../../constants/icons";

import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";

type ModalMode = "forYou" | "myTour";

interface Props {
    visible: boolean;
    selectedPrefs: string[];
    togglePreference: (item: string) => void;
    clearAll: () => void;
    onClose: () => void;
    preferences?: string[];
    mode?: ModalMode;
    onPrimary?: () => void;
    onSecondary?: () => void;
    primaryLabel?: string;
    secondaryLabel?: string;
    showTwoButtons?: boolean;
}

const PreferenceModal: React.FC<Props> = ({
    visible,
    selectedPrefs,
    togglePreference,
    clearAll,
    onClose,
    preferences = ["Food", "Adventure", "History", "Shopping"],
    mode = "myTour",
    onPrimary,
    onSecondary,
    primaryLabel,
    secondaryLabel,
    showTwoButtons = true,
}) => {

    const panY = useRef(new Animated.Value(1000)).current;

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
    }, [panY, visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) panY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 150) onClose();
                else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const primaryText =
        primaryLabel || (mode === "forYou" ? "Apply" : "Next");

    const secondaryText =
        secondaryLabel || (mode === "forYou" ? "Cancel" : "Back");

    return (
        <Modal visible={visible} transparent animationType="fade">

            <View style={styles.overlay}>

                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <Animated.View
                    style={[
                        styles.bottomSheet,
                        { transform: [{ translateY: panY }] },
                    ]}
                >

                    {/* DRAG HANDLE */}
                    <View {...panResponder.panHandlers} style={styles.dragHandle}>
                        <View style={styles.handleBar} />
                    </View>

                    {/* HEADER */}
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            Select Preferences
                        </Text>

                        <TouchableOpacity onPress={clearAll}>
                            <Text style={styles.clearText}>
                                Clear All
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* LIST */}
                    <ScrollView style={styles.scrollArea}>
                        {preferences.map((item, i) => {
                            const isLast = i === preferences.length - 1;

                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.prefItem,
                                        isLast && styles.noBorder,
                                    ]}
                                    onPress={() => togglePreference(item)}
                                >
                                    <View style={styles.prefRow}>
                                        {selectedPrefs.includes(item)
                                            ? <AddPreferenceIcon />
                                            : <PreferenceIcon />
                                        }

                                        <Text style={styles.prefText}>
                                            {item}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* BUTTONS */}
                    {showTwoButtons && (
                        <View style={styles.rowButtons}>

                            <TouchableOpacity
                                style={styles.secondaryBtnSmall}
                                onPress={onSecondary}
                            >
                                <Text style={styles.secondaryText}>
                                    {secondaryText}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.primaryBtnSmall}
                                onPress={onPrimary}
                            >
                                <Text style={styles.primaryText}>
                                    {primaryText}
                                </Text>
                            </TouchableOpacity>

                        </View>
                    )}

                </Animated.View>

            </View>
        </Modal>
    );
};

export default PreferenceModal;
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },

    bottomSheet: {
        backgroundColor: "#fff",
        paddingHorizontal: 24,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === "ios" ? 40 : 20,
    },

    dragHandle: {
        alignItems: "center",
        paddingTop: 12,
    },

    handleBar: {
        width: 52,
        height: 6,
        borderRadius: 999,
        backgroundColor: "#D0D0D0",
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
        marginBottom: 10,
    },

    title: {
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
    },

    clearText: {
        color: COLORS.CLEAR_ALL,
        fontSize:FONT_SIZE.TEXT,
        fontFamily:FONT_FAMILY.InterTight_Medium,
        textDecorationLine: "underline",
    },

    prefItem: {
        borderBottomWidth: 1,
        borderColor: "#eee",
    },

    noBorder: {
        borderBottomWidth: 0,
    },

    prefRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 15,
    },

    prefText: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },

    rowButtons: {
        flexDirection: "row",
        gap: 12,
        marginTop: 16

    },
    scrollArea: {
        maxHeight: 300,
    },

    secondaryBtnSmall: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
    },

    primaryBtnSmall: {
        flex: 1,
        height: 50,
        backgroundColor: COLORS.BUTTON_COLOR,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
    },

    secondaryText: {
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        fontSize: FONT_SIZE.TEXT
    },

    primaryText: {
        color: COLORS.WHITE,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        fontSize: FONT_SIZE.TEXT,
    },
});
