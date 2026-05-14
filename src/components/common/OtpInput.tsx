import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

const { width } = Dimensions.get('window');

interface Props {
  length?: number;
  value: string;
  onChange: (code: string) => void;
}

const OtpInput: React.FC<Props> = ({ length = 6, value, onChange }) => {
  const inputs = useRef<Array<TextInput | null>>([]);

  const boxSize = Math.min(52, (width - 48 - (length - 1) * 10) / length);

  const handleChange = (text: string, index: number) => {
    const digit = text.slice(-1);
    const newCode = value.split('');
    newCode[index] = digit;

    const updated = newCode.join('').slice(0, length);
    onChange(updated);

    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    const key = e.nativeEvent.key;

    if (key === 'Backspace') {
      const newCode = value.split('');

      if (newCode[index]) {
        newCode[index] = '';
        onChange(newCode.join(''));

        if (index > 0) {
          inputs.current[index - 1]?.focus();
        }

        return;
      }

      if (index > 0) {
        newCode[index - 1] = '';
        onChange(newCode.join(''));
        inputs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          ref={ref => (inputs.current[index] = ref)}
          value={value[index] || ''}
          onChangeText={text => handleChange(text, index)}
          onKeyPress={e => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={1}
          //   placeholder="•"
          placeholderTextColor={COLORS.FORGOT_PLACEHOLDER}
          style={[
            styles.box,
            {
              width: boxSize,
              height: boxSize + 10,
            },
          ]}
        />
      ))}
    </View>
  );
};

export default OtpInput;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 10, // modern spacing (React Native 0.71+)
    marginTop: 56,
    paddingHorizontal: 16,
  },

  box: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.OTP_BORDER,
    textAlign: 'center',

    fontSize: FONT_SIZE.OTP_TEXT,
    fontFamily: FONT_FAMILY.PlusJakartaSans_Regular,
    color: COLORS.TEXT_PRIMARY,

    includeFontPadding: false, // 🔥 FIX ANDROID TEXT ALIGNMENT
    textAlignVertical: 'center',
  },
});
