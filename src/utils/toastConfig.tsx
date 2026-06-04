import React from "react";
import { View, Text, StyleSheet } from "react-native";

import { COLORS } from "../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../constants/fonts";

export const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.success]}>
      <View style={styles.rightLine} />
      <Text style={styles.title}>{text1}</Text>
      {text2 ? (
        <Text style={styles.message}>{text2}</Text>
      ) : null}
    </View>
  ),
  error: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.success]}>
      <View style={styles.rightLine} />
      <Text style={styles.title}>{text1}</Text>
      {text2 ? (
        <Text style={styles.message}>{text2}</Text>
      ) : null}
    </View>
  ),

  info: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.success]}>

      <View style={styles.rightLine} />

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
    paddingVertical: 14,
    paddingHorizontal: 16,

    borderRadius: 18,

    alignSelf: "center",

    // marginBottom: 10,

    overflow: "hidden",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",

    position: "relative",
  },

  // BLUE RIGHT LINE
  rightLine: {
    position: "absolute",

    top: 7,
    bottom: 7,
    right: 5,

    width: 5,

    borderRadius: 10,

    backgroundColor: COLORS.BUTTON_COLOR,
  },

  title: {
    color: COLORS.WHITE,

    fontSize: FONT_SIZE.TEXT,

    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },

  message: {
    color: COLORS.WHITE,

    fontSize: FONT_SIZE.SMALL_TEXT,

    fontFamily: FONT_FAMILY.InterTight_Light,

    marginTop: 3,

    paddingRight: 14,
  },

  success: {
    backgroundColor: "rgba(29, 130, 221, 0.95)",
  },
});