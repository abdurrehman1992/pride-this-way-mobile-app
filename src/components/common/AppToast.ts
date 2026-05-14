import Toast from "react-native-toast-message";

type ToastType = "success" | "error" | "info";

interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export const showToast = ({
  type,
  title,
  message,
  duration = 2000,
}: ToastOptions) => {
  Toast.show({
    type,
    text1: title,
    text2: message || "",
    position: "top",
    visibilityTime: duration,
    autoHide: true,
    topOffset: 60,
  });
};

export const showSuccess = (title: string, message?: string) =>
  showToast({ type: "success", title, message });

export const showError = (title: string, message?: string) =>
  showToast({ type: "error", title, message });

export const showInfo = (title: string, message?: string) =>
  showToast({ type: "info", title, message });