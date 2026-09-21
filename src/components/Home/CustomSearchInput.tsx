import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { CrossIcon, SearchIcon } from "../../constants/icons";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";

type Props = {
  rightIcon?: React.ReactNode;
  onPressRightIcon?: () => void;
  placeholder?: string;
  value?: string;
  showRightIconBg?: boolean;
  rightIconBgColor?: string;
  onChangeText?: (text: string) => void;
  onClear?: () => void;
};
const CustomSearchInput: React.FC<Props> = ({
  rightIcon,
  onPressRightIcon,
  placeholder = "Search places, food, events.",
  value,
  onChangeText,
  showRightIconBg = true,
  rightIconBgColor,
  onClear,
}) => {
  const hasText = Boolean(value && value.trim().length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <SearchIcon width={19.11} height={19.11} />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#4F585F"
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          clearButtonMode="never"
        />
      </View>

      {hasText && onClear ? (
        <TouchableOpacity
          onPress={onClear}
          activeOpacity={0.7}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={styles.clearButton}
        >
          <CrossIcon width={12} height={12} />
        </TouchableOpacity>
      ) : rightIcon ? (
        <TouchableOpacity
          onPress={onPressRightIcon}
          activeOpacity={0.7}
          style={[
            showRightIconBg ? styles.filterBtn : styles.noBgBtn,
            showRightIconBg && rightIconBgColor
              ? { backgroundColor: rightIconBgColor }
              : null,
          ]}
        >
          {rightIcon}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
export default CustomSearchInput;
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    borderRadius: 100,
    paddingHorizontal: 16,
    height: 49,
    marginVertical:21,
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    paddingVertical: 0,
    paddingRight: 8,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 38,
    backgroundColor: COLORS.FILTER_ICON_COLOR,
    justifyContent: "center",
    alignItems: "center",
    overflow:'hidden'
  },
  noBgBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    marginLeft: 4,
  },
});