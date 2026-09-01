import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Text,
} from "react-native";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";

interface Props {
  placeholder?: string;
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  error?: string | string[];
}

const ForgetPasswordInput: React.FC<Props> = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  label,
  keyboardType,
  error,
}) => {
  const isHidden = secureTextEntry;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputWrapper}>
        {!value && placeholder ? (
          <View pointerEvents="none" style={styles.placeholderOverlay}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.placeholder}
            >
              {placeholder}
            </Text>
          </View>
        ) : null}
        <TextInput
          placeholder=""
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isHidden}
          style={styles.input}
          autoCapitalize="none"
          keyboardType={keyboardType}
          multiline={false}
          numberOfLines={1}
          textAlignVertical="center"
        />
      </View>

      {Array.isArray(error) ? (
        error.map((err, index) => (
          <Text key={index} style={styles.errorText}>
            {err}
          </Text>
        ))
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
};

export default ForgetPasswordInput;
const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },

  label: {
    marginBottom: 16,
    color: COLORS.FORGOT_LABEL,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.PlusJakartaSans_Medium,
  },

  inputWrapper: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "none",
    borderColor: COLORS.FORGOT_BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },

  input: {
    flex: 1,
    height: 56,
    // Android adds a small default horizontal inset to TextInput. Explicitly
    // reset it so the caret aligns with the custom placeholder's left edge.
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZE.SMALL_TEXT,
    lineHeight: 20,
    fontFamily: FONT_FAMILY.PlusJakartaSans_Regular,
    includeFontPadding: false,
  },
  placeholderOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  placeholder: {
    color: COLORS.FORGOT_PLACEHOLDER,
    fontSize: FONT_SIZE.SMALL_TEXT,
    lineHeight: 20,
    fontFamily: FONT_FAMILY.PlusJakartaSans_Regular,
    includeFontPadding: false,
  },
  errorText: {
    color: COLORS.LOGOUT_TEXT,
    fontSize: FONT_SIZE.SMALL_TEXT,
    marginTop: 4,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
});
