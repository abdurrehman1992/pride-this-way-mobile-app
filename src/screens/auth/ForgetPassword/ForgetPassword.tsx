import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Keyboard,
    StatusBar,
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
} from "../../../utils/validation";
import { showError, showSuccess } from "../../../components/common/AppToast";
import { sendResetPasswordEmail } from "../../../services/authService";
type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "EnterCode">;
const ForgetPassword = () => {
    const navigation = useNavigation<NavigationProp>();
    const [identifier, setIdentifier] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const handleChange = (text: string) => {
        setIdentifier(text);
        if (!text.trim()) {
            setError("Field is required");
            return;
        }
        if (!text.includes("@")) {
            setError("Use your registered email address");
            return;
        }

        setError(validateEmail(text));
    };
    const handleForget = async () => {
        Keyboard.dismiss();
        if (!identifier.trim()) {
            setError("Field is required");
            return;
        }

        if (!identifier.includes("@")) {
            setError("Use your registered email address");
            return;
        }

        const validationError = validateEmail(identifier);

        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        try {
            await sendResetPasswordEmail(identifier);
            showSuccess(
                "Reset Email Sent",
                "Check your inbox to create a new password."
            );
            navigation.navigate("Login");
        } catch (resetError) {
            const message =
                resetError instanceof Error
                    ? resetError.message
                    : "Unable to send reset email.";
            showError("Reset Failed", message);
        } finally {
            setLoading(false);
        }
    };
    return (
        <>
            <StatusBar
                translucent
                backgroundColor="transparent"
                barStyle="light-content"
            />
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    style={styles.keyboardAvoidingView}
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

                            <View style={styles.inputWrapper}>
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
                            {loading ? (
                                <ActivityIndicator
                                    size="large"
                                    color="#0286FF"
                                    style={styles.loader}
                                />
                            ) : (
                                <CustomButton
                                    title="Send Verification Code"
                                    onPress={handleForget}
                                    disabled={!identifier || !!error}
                                />
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
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
    keyboardAvoidingView: {
        flex: 1,
    },
    inputWrapper: {
        marginTop: 49,
    },
    buttonContainer: {
        marginTop: 20,
    },
    loader: {
        marginVertical: 20,
    },
});
