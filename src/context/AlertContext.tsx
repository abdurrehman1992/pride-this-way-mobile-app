import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { setShowAlertFunction } from '../utils/CustomAlert';

export type AlertButton = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'cancel' | 'destructive' | 'default';
  dismissOnPress?: boolean;
};

export type AlertConfig = {
  title: string;
  message: string;
  buttons: AlertButton[];
  dismissible?: boolean;
};

type AlertContextType = {
  alert: AlertConfig | null;
  showAlert: (title: string, message: string, buttons: AlertButton[], options?: { dismissible?: boolean }) => void;
  hideAlert: () => void;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertConfig | null>(null);

  const showAlert = (title: string, message: string, buttons: AlertButton[], options?: { dismissible?: boolean }) => {
    setAlert({ title, message, buttons, dismissible: options?.dismissible });
  };

  const hideAlert = () => {
    setAlert(null);
  };

  // Connect the utility function to the context
  useEffect(() => {
    setShowAlertFunction(showAlert, hideAlert);
  }, []);

  return (
    <AlertContext.Provider value={{ alert, showAlert, hideAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};
