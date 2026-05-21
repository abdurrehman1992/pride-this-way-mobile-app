import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../constants/fonts";

export const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.success]}>
      <Text style={styles.title}>{text1}</Text>

      {text2 ? (
        <Text style={styles.message}>{text2}</Text>
      ) : null}
    </View>
  ),

  error: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.success]}>
      <Text style={styles.title}>{text1}</Text>

      {text2 ? (
        <Text style={styles.message}>{text2}</Text>
      ) : null}
    </View>
  ),

  info: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.success]}>
      <Text style={styles.title}>{text1}</Text>

      {text2 ? (
        <Text style={styles.message}>{text2}</Text>
      ) : null}
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    width: "90%",
    borderRightWidth:10,
    borderRightColor:COLORS.BUTTON_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignSelf: "center",
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  title: {
    // color: COLORS.WHITE,
    color:COLORS.TEXT_PRIMARY,

    fontSize: FONT_SIZE.TEXT,

    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },

  message: {
    // color: COLORS.WHITE,
    color:COLORS.TEXT_PRIMARY,


    fontSize: FONT_SIZE.SMALL_TEXT,

    fontFamily: FONT_FAMILY.InterTight_Regular,

    marginTop: 3,
  },

  success: {
    backgroundColor:'rgba(29, 130, 221, 0.65)'
  },
});