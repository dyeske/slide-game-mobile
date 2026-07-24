import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface TileProps {
  value: number;
  index: number;
  gameId: number;
  gridSize: number;
  tileSize: number;
  gap: number;
  boardPadding: number;
  onPress: (index: number) => void;
  isWon: boolean;
}

export function Tile({
  value,
  index,
  gameId,
  gridSize,
  tileSize,
  gap,
  boardPadding,
  onPress,
  isWon,
}: TileProps) {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const targetX = boardPadding + col * (tileSize + gap) + gap;
  const targetY = boardPadding + row * (tileSize + gap) + gap;

  const translateX = useSharedValue(targetX);
  const translateY = useSharedValue(targetY);
  const prevGameId = useRef(gameId);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const isNewGame = prevGameId.current !== gameId;
    prevGameId.current = gameId;

    if (isFirstRender.current || isNewGame) {
      isFirstRender.current = false;
      translateX.value = targetX;
      translateY.value = targetY;
      return;
    }

    translateX.value = withSpring(targetX, {
      damping: 18,
      stiffness: 350,
      mass: 0.8,
    });
    translateY.value = withSpring(targetY, {
      damping: 18,
      stiffness: 350,
      mass: 0.8,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, gameId]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const fontSize = gridSize === 3 ? 28 : gridSize === 4 ? 22 : 16;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(index);
  };

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: tileSize,
          height: tileSize,
          borderRadius: 12,
          backgroundColor: isWon ? '#6366f1' : '#1e293b',
          borderBottomColor: isWon ? '#4338ca' : '#020617',
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={[styles.text, { fontSize }]}>{value}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  touchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '800',
    color: '#e2e8f0',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
});
