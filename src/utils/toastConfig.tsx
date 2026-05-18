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
    marginBottom: 8,
    elevation: 3,
    borderWidth: 1,
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
    backgroundColor: "rgba(24, 116, 233, 0.68)",
    borderColor: "rgba(255,255,255,0.24)",
  },

  error: {
    backgroundColor: "rgba(240, 68, 56, 0.68)",
    borderColor: "rgba(255,255,255,0.24)",
  },

  info: {
    backgroundColor: "rgba(15, 23, 42, 0.62)",
    borderColor: "rgba(255,255,255,0.18)",
  },
});
