import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  const [isHidden, setIsHidden] = useState(secureTextEntry);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputWrapper}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={COLORS.FORGOT_PLACEHOLDER}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isHidden}
          style={styles.input}
          autoCapitalize="none"
          keyboardType={keyboardType}
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
    height: 48,
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.PlusJakartaSans_Regular,
  },
  errorText: {
    color: COLORS.LOGOUT_TEXT,
    fontSize: FONT_SIZE.SMALL_TEXT,
    marginTop: 4,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
});