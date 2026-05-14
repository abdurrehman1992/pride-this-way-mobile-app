import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../types/types";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { COLORS } from "../../constants/colors";
type NavigationProp = NativeStackNavigationProp<
    AuthStackParamList,
    "Login"
>;
interface Props {
    text: string;
    btnText: string;
    onpress?: () => void;
}
const AuthBottomNavigation = ({text,btnText, onpress}: Props) => {
    const navigation = useNavigation<NavigationProp>();

    return (
        <View style={styles.BottomText}>
            <Text style={styles.signInText}>{text}</Text>
            <TouchableOpacity onPress={onpress}>
                <Text style={styles.signInLink}>{btnText}</Text>
            </TouchableOpacity>
        </View>
    );
};

export default AuthBottomNavigation;
const styles = StyleSheet.create({
    signInText: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        textAlign: "center",

    },
    signInLink: {
        color: COLORS.BUTTON_COLOR,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        borderBottomColor: COLORS.BUTTON_COLOR,
        borderBottomWidth: 1,
        fontSize: FONT_SIZE.TEXT,
        lineHeight: FONT_SIZE.TEXT
    },
    BottomText: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 18,
        marginBottom: 32,
        gap:4
    },
})
