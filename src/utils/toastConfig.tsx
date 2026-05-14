import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../constants/fonts";

export const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.success]}>
      <Text style={styles.title}>{text1}</Text>
      {text2 ? <Text style={styles.message}>{text2}</Text> : null}
    </View>
  ),

  error: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.error]}>
      <Text style={styles.title}>{text1}</Text>
      {text2 ? <Text style={styles.message}>{text2}</Text> : null}
    </View>
  ),

  info: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.info]}>
      <Text style={styles.title}>{text1}</Text>
      {text2 ? <Text style={styles.message}>{text2}</Text> : null}
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    width: "90%",
    padding: 14,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 10,
    elevation: 3,
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
    marginTop: 2,
  },

  success: {
    backgroundColor: COLORS.BUTTON_COLOR,
  },

  error: {
    backgroundColor: COLORS.LOGOUT_TEXT,
  },

  info: {
    backgroundColor: COLORS.PILL_COLOR,
  },
});