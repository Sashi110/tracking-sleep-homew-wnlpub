import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS } from '@/constants/Colors';

interface ToastProps {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onUndo, onDismiss, duration = 4000 }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.message}>{message}</Text>
      {onUndo && (
        <Pressable onPress={onUndo} style={styles.undoBtn}>
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
    boxShadow: '0 4px 16px rgba(26, 26, 46, 0.3)',
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    flex: 1,
  },
  undoBtn: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  undoText: {
    color: COLORS.primary,
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
  },
});
