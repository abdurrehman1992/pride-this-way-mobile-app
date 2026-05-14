import React, { useState, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform
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
import { showSuccess } from '../../components/common/AppToast';

const ChangePassword = ({ navigation }: any) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const handleCurrentPassword = (text: string) => {
        setCurrentPassword(text);
        setErrors(prev => ({
            ...prev,
            current: text.trim() ? '' : 'Current password is required'
        }));
    };

    const handleNewPassword = (text: string) => {
        setNewPassword(text);
        const err = validatePassword(text);
        setErrors(prev => ({
            ...prev,
            new: err.length ? err.join(', ') : ''
        }));
    };

    const handleConfirmPassword = (text: string) => {
        setConfirmPassword(text);
        setErrors(prev => ({
            ...prev,
            confirm: validateConfirmPassword(newPassword, text)
        }));
    };

    const isFormValid = useMemo(() => {
        return (
            currentPassword.trim() !== '' &&
            newPassword.trim() !== '' &&
            confirmPassword.trim() !== '' &&
            errors.current === '' &&
            errors.new === '' &&
            errors.confirm === '' &&
            newPassword === confirmPassword
        );
    }, [currentPassword, newPassword, confirmPassword, errors]);

    const handleChangePassword = () => {
        const currentErr = currentPassword.trim() ? '' : 'Current password is required';
        const newErr = validatePassword(newPassword).join(',');
        const confirmErr = validateConfirmPassword(newPassword, confirmPassword);

        setErrors({
            current: currentErr,
            new: newErr,
            confirm: confirmErr
        });

        if (!currentErr && !newErr && !confirmErr) {
            showSuccess("Password changed successfully");
            navigation.reset({
                index: 0,
                routes: [{ name: 'Profile' }],
            });
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
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
                        <CustomButton
                            title="Update Password"
                            Icon={SinupIcon}
                            onPress={handleChangePassword}
                            disabled={!isFormValid}
                        />
                    {/* </View> */}
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
    content: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
        justifyContent: 'space-between',
    },
    upperContent: {
        flex: 1, 
    },
    inputs: {
        marginTop: 40,
        gap: 15,
    },
});