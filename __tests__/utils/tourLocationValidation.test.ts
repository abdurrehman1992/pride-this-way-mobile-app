import {
  canAddTourLocation,
  canSaveTour,
  hasTourLocation,
} from '../../src/utils/tourLocationValidation';
import { checkInternetConnection } from '../../src/utils/networkStatus';
import { showInfo } from '../../src/components/common/AppToast';

jest.mock('../../src/utils/networkStatus', () => ({ checkInternetConnection: jest.fn() }));
jest.mock('../../src/components/common/AppToast', () => ({ showInfo: jest.fn() }));

const checkConnection = checkInternetConnection as jest.MockedFunction<typeof checkInternetConnection>;

afterEach(() => jest.clearAllMocks());

it('rejects an empty tour with the requested toast', () => {
  expect(hasTourLocation(0)).toBe(false);
  expect(showInfo).toHaveBeenCalledWith('Please select at least one location');
});

it('allows a tour with at least one location without a warning', () => {
  expect(hasTourLocation(1)).toBe(true);
  expect(showInfo).not.toHaveBeenCalled();
});

it('blocks adding locations offline and displays only the offline toast', async () => {
  checkConnection.mockResolvedValue(false);
  expect(await canAddTourLocation()).toBe(false);
  expect(showInfo).toHaveBeenCalledTimes(1);
  expect(showInfo).toHaveBeenCalledWith('No internet connection', 'Your internet is off. Please connect and try again.');
});

it('rechecks connectivity on retry and permits adding when internet returns', async () => {
  checkConnection.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  expect(await canAddTourLocation()).toBe(false);
  expect(await canAddTourLocation()).toBe(true);
  expect(checkConnection).toHaveBeenCalledTimes(2);
  expect(showInfo).toHaveBeenCalledTimes(1);
});

it('does not start saving a tour while offline', async () => {
  checkConnection.mockResolvedValue(false);
  expect(await canSaveTour()).toBe(false);
  expect(showInfo).toHaveBeenCalledWith(
    'No internet connection',
    'Your internet is off. Please connect and try again.'
  );
});
