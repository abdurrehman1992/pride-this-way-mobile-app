import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import ForgeTopHeader from '../../../components/common/ForgeTopHeader';
import CustomButton from '../../../components/common/CustomButton';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../../types/types';
import OtpInput from '../../../components/common/OtpInput';
import { COLORS } from '../../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../../constants/fonts';

type NavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'CreateNewPassword'
>;

const EnterCode = () => {
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const navigation = useNavigation<NavigationProp>();
  const OTP_LENGTH = 6;
  const isOtpComplete = code.length === OTP_LENGTH;
  const canResend = secondsLeft === 0;

  useEffect(() => {
    if (secondsLeft === 0) return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleVerifyCode = () => {
    if (!isOtpComplete) return;
    navigation.navigate('CreateNewPassword');
  };

  const handleResendCode = () => {
    if (!canResend) return;

    setCode('');
    setSecondsLeft(30);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <ForgeTopHeader title="Enter Code" />
            <OtpInput value={code} onChange={setCode} />

            <View style={styles.messageWrapper}>
              <Text style={styles.text}>
                Didn’t receive the code? You can request a new one
                {canResend ? '.' : ` in ${secondsLeft} seconds.`}
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                disabled={!canResend}
                onPress={handleResendCode}
              >
                <Text
                  style={[
                    styles.linkText,
                    !canResend && styles.linkTextDisabled,
                  ]}
                >
                  Resend Code
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomSection}>
            <CustomButton
              title="Verify"
              onPress={handleVerifyCode}
              disabled={!isOtpComplete}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EnterCode;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 19,
    paddingBottom: 24,
  },
  topSection: {
    flex: 1,
  },
  bottomSection: {
    marginTop: 20,
  },
  messageWrapper: {
    marginTop: 32,
    alignItems: 'center',
  },
  text: {
    color: COLORS.FORGOT_PLACEHOLDER,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.PlusJakartaSans_Regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    marginTop: 4,
    color: COLORS.BUTTON_COLOR,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    textDecorationLine: 'underline',
  },
  linkTextDisabled: {
    color: COLORS.FORGOT_PLACEHOLDER,
  },
});
