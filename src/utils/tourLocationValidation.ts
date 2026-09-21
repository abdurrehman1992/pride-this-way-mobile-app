import { showInfo } from '../components/common/AppToast';
import { checkInternetConnection } from './networkStatus';

export const hasTourLocation = (count: number): boolean => {
  if (count > 0) return true;
  showInfo('Please select at least one location');
  return false;
};

export const canAddTourLocation = async (): Promise<boolean> => {
  if (await checkInternetConnection()) return true;
  showInfo('No internet connection', 'Your internet is off. Please connect and try again.');
  return false;
};

export const canSaveTour = async (): Promise<boolean> => {
  if (await checkInternetConnection()) return true;
  showInfo('No internet connection', 'Your internet is off. Please connect and try again.');
  return false;
};
