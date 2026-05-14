import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import ForgetPasswordInput from "../../../components/common/ForgetPasswordInput";
import CustomButton from "../../../components/common/CustomButton";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../../types/types";
import ForgeTopHeader from "../../../components/common/ForgeTopHeader";
import {
    validateEmail,
    validatePhone,
} from "../../../utils/validation";
import { showSuccess } from "../../../components/common/AppToast";
type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "EnterCode">;
const ForgetPassword = () => {
    const navigation = useNavigation<NavigationProp>();
    const [identifier, setIdentifier] = useState("");
    const [error, setError] = useState("");
    const isEmail = (text: string) => /[a-zA-Z]/.test(text);
    const shouldValidateEmail = (text: string) => text.includes("@");
    const handleChange = (text: string) => {
        setIdentifier(text);
        if (!text.trim()) {
            setError("Field is required");
            return;
        }
        let validationError = "";
        if (isEmail(text)) {
            if (!shouldValidateEmail(text)) {
                setError("");
                return;
            }
            validationError = validateEmail(text);
        } else {
            validationError = validatePhone(text);
        }

        setError(validationError);
    };
    const handleForget = () => {
        if (!identifier.trim()) {
            setError("Field is required");
            return;
        }
        let validationError = "";
        if (isEmail(identifier)) {
            validationError = validateEmail(identifier);
        } else {
            validationError = validatePhone(identifier);
        }
        if (validationError) {
            setError(validationError);
            return;
        }
        showSuccess("We have sent verification code to you")
        navigation.navigate("EnterCode");
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
                    {/* Header + Input */}
                    <View>
                        <ForgeTopHeader title="Forgot Password" />

                        <View style={{ marginTop: 49 }}>
                            <ForgetPasswordInput
                                label="Email or Phone Number"
                                placeholder="Enter your registered email or phone number"
                                value={identifier}
                                onChangeText={handleChange}
                                error={error}
                                keyboardType="email-address" // ✅ best universal keyboard
                            />
                        </View>
                    </View>
                    <View style={styles.buttonContainer}>
                        <CustomButton
                            title="Send Verification Code"
                            onPress={handleForget}
                            disabled={!identifier || !!error}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
export default ForgetPassword;

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
    buttonContainer: {
        marginTop: 20,
    },
});