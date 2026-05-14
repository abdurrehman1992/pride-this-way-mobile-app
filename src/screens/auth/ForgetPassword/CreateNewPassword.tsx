import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrossIcon, SinupIcon } from '../../../constants/icons';
import ForgeTopHeader from '../../../components/common/ForgeTopHeader';
import CustomInput from '../../../components/common/CustomInput';
import CustomButton from '../../../components/common/CustomButton';
import { DoneModalIcon } from '../../../constants/images';
import { COLORS } from '../../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../../constants/fonts';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../../types/types";
import { validatePassword, validateConfirmPassword } from "../../../utils/validation";
type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Login">;

const CreateNewPassword = () => {
  const navigation = useNavigation<NavigationProp>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState({
    password: [] as string[],
    confirmPassword: "",
  });
  const isFormValid = useMemo(() => {
    return (
      validatePassword(password).length === 0 &&
      validateConfirmPassword(password, confirmPassword) === ""
    );
  }, [password, confirmPassword]);

  const handleSubmit = () => {
    const passErrors = validatePassword(password);
    const confirmErr = validateConfirmPassword(password, confirmPassword);

    setErrors({
      password: passErrors,
      confirmPassword: confirmErr,
    });

    if (passErrors.length === 0 && !confirmErr) {
      setShowModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <ForgeTopHeader title="Create New Password" />
            <View style={styles.form}>
              <CustomInput
                label="New Password"
                placeholder="****************"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((prev) => ({
                    ...prev,
                    password: validatePassword(text),
                  }));
                }}
                error={errors.password.length > 0 ? errors.password.join(". ") : ""}
              />

              <CustomInput
                label="Confirm Password"
                placeholder="****************"
                secureTextEntry
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setErrors((prev) => ({
                    ...prev,
                    confirmPassword: validateConfirmPassword(password, text),
                  }));
                }}
                error={errors.confirmPassword}
              />
            </View>
          </View>

          <View style={{marginBottom:20}}>
            <CustomButton
              title="Update Password"
              Icon={SinupIcon}
              onPress={handleSubmit}
              disabled={!isFormValid}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.floatingImageWrapper}>
              <Image source={DoneModalIcon} style={styles.floatingImage} />
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowModal(false)}
            >
              <CrossIcon width={12} height={12} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Password Reset Successful</Text>
            <Text style={styles.modalDesc}>
              Your password has been updated successfully.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowModal(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Login" }],
                });
              }}
            >
              <Text style={styles.buttonText}>Go To Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CreateNewPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingTop: 19,
    paddingBottom: 16,
  },
  form: {
    marginTop: 50,
    gap: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    textAlign: "center",
    marginTop: 32
  },
  modalDesc: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
    marginTop: 10
  },
  modalBox: {
    marginHorizontal: 32,
    backgroundColor: COLORS.WHITE,
    padding: 24,
    borderRadius: 19,
    alignItems: "center",
    position: "relative",
  },
  floatingImageWrapper: {
    position: "absolute",
    top: -40,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  floatingImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  modalClose: {
    position: "absolute",
    right: 20,
    top: 20,
    zIndex: 20,
  },
  modalButton: {
    marginTop: 20,
    backgroundColor: COLORS.BUTTON_COLOR,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
    width: 267
  },
  buttonText: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    color: COLORS.WHITE
  }
});