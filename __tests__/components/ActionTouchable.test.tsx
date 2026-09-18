import React from 'react';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import ActionTouchable from '../../src/components/common/ActionTouchable';
import CustomButton from '../../src/components/common/CustomButton';
import { showError } from '../../src/components/common/AppToast';

jest.mock('../../src/components/common/AppToast', () => ({
  showError: jest.fn(),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ActionTouchable', () => {
  let tree: renderer.ReactTestRenderer;
  afterEach(() => {
    act(() => tree?.unmount());
    jest.clearAllMocks();
  });

  it('shows an in-button loader and blocks repeat taps until the request finishes', async () => {
    let finish!: () => void;
    const request = new Promise<void>(resolve => {
      finish = resolve;
    });
    const onPress = jest.fn(() => request);
    act(() => {
      tree = renderer.create(<ActionTouchable onPress={onPress} />);
    });
    const press = tree.root.findByType(TouchableOpacity).props.onPress;
    let task!: Promise<void>;
    act(() => {
      task = press({});
      press({});
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType(TouchableOpacity).props.disabled).toBe(true);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    await act(async () => {
      finish();
      await task;
    });
    expect(tree.root.findByType(TouchableOpacity).props.disabled).toBe(false);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('adds loading to existing form buttons without requiring a separate loading flag', async () => {
    let finish!: () => void;
    const request = new Promise<void>((resolve) => { finish = resolve; });
    act(() => { tree = renderer.create(<CustomButton title="Save" onPress={() => request} />); });
    let task!: Promise<void>;
    act(() => { task = tree.root.findByType(TouchableOpacity).props.onPress({}); });
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(tree.root.findByType(TouchableOpacity).props.accessibilityState.busy).toBe(true);
    await act(async () => { finish(); await task; });
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('clears the loader after failure so the action can be retried', async () => {
    const onPress = jest
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(undefined);
    act(() => {
      tree = renderer.create(<ActionTouchable onPress={onPress} />);
    });
    await act(async () => {
      await tree.root.findByType(TouchableOpacity).props.onPress({});
    });
    expect(showError).toHaveBeenCalledWith('Action failed', 'Offline');
    expect(tree.root.findByType(TouchableOpacity).props.disabled).toBe(false);
    await act(async () => {
      await tree.root.findByType(TouchableOpacity).props.onPress({});
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('keeps synchronous navigation instant and respects external loading', () => {
    const onPress = jest.fn();
    act(() => {
      tree = renderer.create(<ActionTouchable onPress={onPress} />);
    });
    act(() => {
      tree.root.findByType(TouchableOpacity).props.onPress({});
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    act(() => {
      tree.update(<ActionTouchable onPress={onPress} loading />);
    });
    act(() => {
      tree.root.findByType(TouchableOpacity).props.onPress({});
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });
});
