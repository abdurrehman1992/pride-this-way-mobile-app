import ActionTouchable from "./ActionTouchable";
import React from "react";
import {
  Text,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";

interface Props {
  title: string;
  onPress?: () => void | Promise<unknown>;
  Icon?: React.ComponentType<{ height: number; width: number }>; // ⭐ OPTIONAL
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}
const CustomButton: React.FC<Props> = ({
  title,
  onPress,
  Icon,
  disabled,
  loading,
  style,
}) => {
  const isDisabled = Boolean(disabled || loading);

  return (
    <ActionTouchable
      disabled={isDisabled}
      loading={loading}
      loaderColor={COLORS.WHITE}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.button,
        isDisabled ? styles.buttonDisabled : styles.buttonActive,
        style,
      ]}
    >
      {Icon && <Icon height={16} width={18.1} />}

      <Text style={[styles.text, isDisabled && styles.textDisabled]}>
        {title}
      </Text>
    </ActionTouchable>
  );
};

export default CustomButton;
const styles = StyleSheet.create({
  button: {
    marginTop: 14,
    height: 50,
    borderRadius: 40,
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6
  },
  buttonActive: {
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  buttonDisabled: {
    backgroundColor: COLORS.BUTTON_DISABLED,
  },
  text: {
    fontSize: FONT_SIZE.TEXT,
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  textDisabled: {
    color: COLORS.WHITE,
  },
});
