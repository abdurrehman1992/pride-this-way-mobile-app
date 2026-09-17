import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { EyeIcon } from '../../constants/icons';
import EyeOffIcon from '../../assets/icons/eyeOff.svg';

type Props = { hidden: boolean; onPress: () => void; disabled?: boolean };

export default function PasswordVisibilityButton({ hidden, onPress, disabled = false }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
      accessibilityState={{ disabled }}
      style={styles.button}
    >
      {hidden ? <EyeIcon width={24} height={18} /> : <EyeOffIcon width={24} height={18} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
