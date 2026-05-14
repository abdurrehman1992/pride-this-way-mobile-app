import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import React from 'react'
import { BackIocn } from "../../constants/icons";
import { useNavigation } from "@react-navigation/native";
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';
interface Props{
    title:string
}
const ForgeTopHeader :React.FC<Props> =({title})=> {
    const navigation=useNavigation();
    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <BackIocn width={43} height={43} />
            </TouchableOpacity>

            <Text style={styles.upperText}>{title}</Text>
        </View>
    )
}

export default ForgeTopHeader
const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        left: 0,
    },
    upperText: {
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY
    }
})