import React, { useState } from "react";
import { View, TextInput, StyleSheet, Text, TouchableOpacity } from "react-native";
import { COLORS } from "../../constants/colors";
import { EyeIcon } from "../../constants/icons";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
interface Props {
  placeholder?: string;
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  error?: string | string[];
  editable?: boolean;
}
const CustomInput: React.FC<Props> = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  label,
  keyboardType,
  error,
  editable = true,
}) => {
  const [isHidden, setIsHidden] = useState(secureTextEntry);
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={COLORS.TEXT_PRIMARY}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isHidden}
          style={[styles.input, !editable && styles.inputDisabled]}
          autoCapitalize="none"
          keyboardType={keyboardType}
          editable={editable}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsHidden(!isHidden)}
            style={styles.icon}
          >
            {isHidden ? (
              <EyeIcon width={18} height={10} />
            ) : (
              <EyeIcon width={18} height={10} />
            )}
          </TouchableOpacity>
        )}
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
export default CustomInput;
const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  label: {
    marginBottom: 16,
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "none",
    borderColor: COLORS.BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height:47,
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Light,
  },
  inputDisabled: {
    color: COLORS.TEXT_SECONDARY,
  },
  icon: {
    paddingLeft: 10,
  },
  errorText: {
    color: COLORS.LOGOUT_TEXT,
    fontSize: FONT_SIZE.SMALL_TEXT,
    marginTop: 4,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
});
