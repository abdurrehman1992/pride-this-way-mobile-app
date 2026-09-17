import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { showError } from './AppToast';

type Props = Omit<TouchableOpacityProps, 'onPress'> & {
  onPress?: (event: GestureResponderEvent) => unknown;
  loading?: boolean;
  loaderColor?: string;
};

// Keep the original children mounted so an in-button loader never changes
// the button's size or the surrounding layout. Synchronous taps stay instant.
export default function ActionTouchable({
  onPress,
  loading = false,
  disabled,
  children,
  style,
  loaderColor,
  accessibilityState,
  ...props
}: Props) {
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const busy = loading || pending;
  const flatStyle = StyleSheet.flatten(style);
  const backgroundColor = flatStyle?.backgroundColor || COLORS.WHITE;
  const color =
    loaderColor ||
    (backgroundColor === COLORS.BUTTON_COLOR
      ? COLORS.WHITE
      : COLORS.BUTTON_COLOR);

  const handlePress = async (event: GestureResponderEvent) => {
    if (locked.current || disabled || loading) return;
    locked.current = true;
    try {
      const result = onPress?.(event);
      if (
        result &&
        typeof (result as PromiseLike<unknown>).then === 'function'
      ) {
        setPending(true);
        await result;
      }
    } catch (error) {
      showError(
        'Action failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  };

  return (
    <TouchableOpacity
      {...props}
      style={style}
      onPress={handlePress}
      disabled={disabled || busy}
      accessibilityState={{
        ...accessibilityState,
        disabled: Boolean(disabled || busy),
        busy,
      }}
    >
      {children}
      {busy && (
        <View
          pointerEvents="none"
          style={[
            styles.loader,
            {
              backgroundColor,
              borderRadius: flatStyle?.borderRadius || 0,
            },
          ]}
        >
          <ActivityIndicator color={color} size="small" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loader: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
