import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY_EMAIL = "remember_email";
const KEY_FLAG = "remember_flag";
export const saveRememberEmail = async (email: string) => {
  await AsyncStorage.setItem(KEY_EMAIL, email);
  await AsyncStorage.setItem(KEY_FLAG, "true");
};
export const clearRememberEmail = async () => {
  await AsyncStorage.removeItem(KEY_EMAIL);
  await AsyncStorage.setItem(KEY_FLAG, "false");
};
export const getRememberEmail = async () => {
  return await AsyncStorage.getItem(KEY_EMAIL);
};