import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Arrow } from '../../constants/icons';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
interface Props {
  onPress: () => void;
  title: string;
  Icon: React.ComponentType<any>;
}
const TabsButtons: React.FC<Props> = ({ onPress, title, Icon }) => {
  return (
    <TouchableOpacity
      style={styles.drawerLinks}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.item}>
        <Icon width={36} height={36} />

        <Text style={styles.itemText} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Arrow width={14} />
    </TouchableOpacity>
  );
};

export default TabsButtons;

const styles = StyleSheet.create({
  drawerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
  },

  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minWidth: 0,
  },

  itemText: {
    flex: 1,
    flexShrink: 1,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_PRIMARY,
  },
});
