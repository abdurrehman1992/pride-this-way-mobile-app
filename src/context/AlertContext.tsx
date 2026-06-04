import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { setShowAlertFunction } from '../utils/CustomAlert';

export type AlertButton = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'cancel' | 'destructive' | 'default';
};

export type AlertConfig = {
  title: string;
  message: string;
  buttons: AlertButton[];
};

type AlertContextType = {
  alert: AlertConfig | null;
  showAlert: (title: string, message: string, buttons: AlertButton[]) => void;
  hideAlert: () => void;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertConfig | null>(null);

  const showAlert = (title: string, message: string, buttons: AlertButton[]) => {
    setAlert({ title, message, buttons });
  };

  const hideAlert = () => {
    setAlert(null);
  };

  // Connect the utility function to the context
  useEffect(() => {
    setShowAlertFunction(showAlert);
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
