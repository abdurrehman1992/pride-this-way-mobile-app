import React, { useState, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import CustomInput from '../../components/common/CustomInput';
import CustomButton from '../../components/common/CustomButton';
import { COLORS } from '../../constants/colors';
import { SinupIcon } from '../../constants/icons';
import {
    validatePassword,
    validateConfirmPassword
} from '../../utils/validation';
import { showError, showSuccess } from '../../components/common/AppToast';
import { changeCurrentUserPassword, logoutUser } from '../../services/authService';
import { useDispatch } from 'react-redux';
import { logout } from "../../Redux/slices/authSlice";

const ChangePassword = ({ navigation }: any) => {
    const dispatch = useDispatch();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const handleCurrentPassword = (text: string) => {
        setCurrentPassword(text);

        let currentErr = '';
        let newErr = errors.new;

        if (!text.trim()) {
            currentErr = 'Current password is required';
        } else if (newPassword && text === newPassword) {
            newErr = 'New password cannot be the same as your current password';
        } else if (newPassword && text !== newPassword && errors.new === 'New password cannot be the same as your current password') {
            // Clear the error on the new password field if they no longer match
            const validationErrors = validatePassword(newPassword);
            newErr = validationErrors.length ? validationErrors.join(', ') : '';
        }

        setErrors(prev => ({
            ...prev,
            current: currentErr,
            new: newErr
        }));
    };

    const handleNewPassword = (text: string) => {
        setNewPassword(text);

        let newErr = '';
        const validationErrors = validatePassword(text);

        if (validationErrors.length) {
            newErr = validationErrors.join(', ');
        } else if (currentPassword && text === currentPassword) {
            newErr = 'New password cannot be the same as your current password';
        }

        // Re-validate confirm password field in real-time when new password changes
        let confirmErr = errors.confirm;
        if (confirmPassword) {
            confirmErr = validateConfirmPassword(text, confirmPassword);
        }

        setErrors(prev => ({
            ...prev,
            new: newErr,
            confirm: confirmErr
        }));
    };

    const handleConfirmPassword = (text: string) => {
        setConfirmPassword(text);
        setErrors(prev => ({
            ...prev,
            confirm: validateConfirmPassword(newPassword, text)
        }));
    };
    const handleLogout = async () => {
        try {
            await logoutUser();
            dispatch(logout());
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unable to logout.";
            showError("Logout Failed", message);
        }
    };
    const isFormValid = useMemo(() => {
        return (
            currentPassword.trim() !== '' &&
            newPassword.trim() !== '' &&
            confirmPassword.trim() !== '' &&
            errors.current === '' &&
            errors.new === '' &&
            errors.confirm === '' &&
            newPassword === confirmPassword &&
            currentPassword !== newPassword
        );
    }, [currentPassword, newPassword, confirmPassword, errors]);

    const handleChangePassword = async () => {
        Keyboard.dismiss();
        const currentErr = currentPassword.trim() ? '' : 'Current password is required';
        // const
        let newErr = '';
        const validationErrors = validatePassword(newPassword);
        if (validationErrors.length) {
            newErr = validationErrors.join(',');
        } else if (currentPassword && newPassword === currentPassword) {
            newErr = 'New password cannot be the same as your current password';
        }

        const confirmErr = validateConfirmPassword(newPassword, confirmPassword);

        setErrors({
            current: currentErr,
            new: newErr,
            confirm: confirmErr
        });

        if (currentErr || newErr || confirmErr || loading) {
            return;
        }

        setLoading(true);
        try {
            await changeCurrentUserPassword({
                currentPassword,
                newPassword,
            });
            showSuccess("Password changed successfully","Please Login with new password");
            handleLogout()
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unable to change password.";
            showError("Change Password Failed", "Please verify your entered current password is correct?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.upperContent}>
                        <ForgeTopHeader title="Change Password" />
                        <View style={styles.inputs}>
                            <CustomInput
                                label="Current Password"
                                placeholder="Enter current password"
                                value={currentPassword}
                                onChangeText={handleCurrentPassword}
                                error={errors.current}
                                secureTextEntry
                            />
                            <CustomInput
                                label="New Password"
                                placeholder="Enter new password"
                                value={newPassword}
                                onChangeText={handleNewPassword}
                                error={errors.new}
                                secureTextEntry
                            />
                            <CustomInput
                                label="Confirm Password"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChangeText={handleConfirmPassword}
                                error={errors.confirm}
                                secureTextEntry
                            />
                        </View>
                    </View>
                    {loading ? (
                        <ActivityIndicator
                            size="large"
                            color={COLORS.BUTTON_COLOR}
                            style={styles.loader}
                        />
                    ) : (
                        <CustomButton
                            title="Update Password"
                            Icon={SinupIcon}
                            onPress={handleChangePassword}
                            disabled={!isFormValid}
                        />
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ChangePassword;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.BACKGROUND,
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 60,
        justifyContent: 'space-between',
    },
    upperContent: {
        flex: 1,
    },
    inputs: {
        marginTop: 40,
        gap: 15,
    },
    loader: {
        marginVertical: 20,
    },
});