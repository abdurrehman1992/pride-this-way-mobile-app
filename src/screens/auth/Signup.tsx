import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ImageBackground,
  Text,
  ScrollView,
  Keyboard,
} from "react-native";

import { COLORS } from "../../constants/colors";
import { FONT_SIZE, FONT_FAMILY } from "../../constants/fonts";
import CustomInput from "../../components/common/CustomInput";
import CustomButton from "../../components/common/CustomButton";
import AuthBottomNavigation from "../../components/common/AuthBottomNavigation";
import { useNavigation } from "@react-navigation/native";
import { BackGroundImage } from "../../constants/images";
import { SinupIcon } from "../../constants/icons";

import {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
} from "../../utils/validation";

const Signup: React.FC = () => {
  const navigation = useNavigation<any>();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const [errors, setErrors] = useState({
    name: "",
    email: "",
    phone: "",
    password: [] as string[],
    confirmPassword: "",
  });

  const isFormValid = useMemo(() => {
    return (
      validateName(fullName) === "" &&
      validateEmail(email) === "" &&
      validatePhone(phone) === "" &&
      validatePassword(password).length === 0 &&
      validateConfirmPassword(password, confirmPassword) === ""
    );
  }, [fullName, email, phone, password, confirmPassword]);

  const handleSignup = async () => {
    navigation.navigate("Login");
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={BackGroundImage}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: keyboardHeight,
          }}
        >
          <View>
            <View style={styles.signupText}>
              <Text style={styles.title}>Sign Up</Text>
              <Text style={styles.subTitle}>
                Join to discover places, save favorites, & earn rewards.
              </Text>
            </View>
          </View>
          <View style={styles.form}>
            <CustomInput
              label="Full Name"
              placeholder="Enter Full Name"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setErrors((prev) => ({
                  ...prev,
                  name: validateName(text),
                }));
              }}
              error={errors.name}
            />

            <CustomInput
              label="Email Address"
              placeholder="Enter Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors((prev) => ({
                  ...prev,
                  email: validateEmail(text),
                }));
              }}
              error={errors.email}
              keyboardType="email-address"
            />

            <CustomInput
              label="Phone Number"
              placeholder="Enter Phone Number"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setErrors((prev) => ({
                  ...prev,
                  phone: validatePhone(text),
                }));
              }}
              keyboardType="phone-pad"
              error={errors.phone}
            />

            <CustomInput
              label="Password"
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
              error={
                errors.password.length > 0
                  ? errors.password.join(", ")
                  : ""
              }
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

            <CustomButton
              title="Sign Up"
              Icon={SinupIcon}
              onPress={handleSignup}
              disabled={!isFormValid}
            />

            <AuthBottomNavigation
              text="Already have an account?"
              btnText="Sign in"
              onpress={() => navigation.navigate("Login")}
            />
          </View>
        </ScrollView>

      </View>
    </View>
  );
};

export default Signup;

const styles = StyleSheet.create({

  container: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    height: "76.5%",
    width: "100%",
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  signupText: {
    paddingHorizontal: 24,
    marginTop: 36,
    marginBottom: 34,
    gap: 8
  },
  title: {
    fontSize: FONT_SIZE.TITLE,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },
  subTitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
  form: {
    paddingHorizontal: 24,
  },
  signInText: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    textAlign: "center",
    marginVertical: 16,
  },
  signInLink: {
    color: COLORS.BUTTON_COLOR,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    borderBottomColor: COLORS.BUTTON_COLOR,
    borderBottomWidth: 1,
    fontSize: FONT_SIZE.TEXT,
    lineHeight: FONT_SIZE.TEXT
  },
  BottomText: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
