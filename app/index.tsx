import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tile } from '@/components/Tile';

// ─── Game logic ────────────────────────────────────────────────────────────

function generateSolvedBoard(size: number): number[] {
  const board: number[] = [];
  for (let i = 1; i < size * size; i++) board.push(i);
  board.push(0);
  return board;
}

function getValidMoves(emptyIndex: number, size: number): number[] {
  const moves: number[] = [];
  const row = Math.floor(emptyIndex / size);
  const col = emptyIndex % size;
  if (row > 0) moves.push(emptyIndex - size);
  if (row < size - 1) moves.push(emptyIndex + size);
  if (col > 0) moves.push(emptyIndex - 1);
  if (col < size - 1) moves.push(emptyIndex + 1);
  return moves;
}

function shuffleBoard(size: number): number[] {
  const board = generateSolvedBoard(size);
  let emptyIndex = size * size - 1;
  let lastEmptyIndex = -1;
  for (let i = 0; i < 300; i++) {
    const validMoves = getValidMoves(emptyIndex, size).filter(
      (m) => m !== lastEmptyIndex,
    );
    if (validMoves.length === 0) break;
    const randomMove =
      validMoves[Math.floor(Math.random() * validMoves.length)];
    [board[emptyIndex], board[randomMove]] = [
      board[randomMove],
      board[emptyIndex],
    ];
    lastEmptyIndex = emptyIndex;
    emptyIndex = randomMove;
  }
  return board;
}

function isWinState(tiles: number[]): boolean {
  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] !== i + 1) return false;
  }
  return tiles[tiles.length - 1] === 0;
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60).toString().padStart(2, '0');
  const s = (t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Layout constants ──────────────────────────────────────────────────────

const GAP = 8;
const BOARD_PADDING = 12;

// ─── Screen ────────────────────────────────────────────────────────────────

export default function GameScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [gridSize, setGridSize] = useState(4);
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [gameId, setGameId] = useState(0);
  const [btnColor, setBtnColor] = useState({ r: 100, g: 116, b: 139 });

  const colorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Win overlay animation
  const winOpacity = useSharedValue(0);
  const winScale = useSharedValue(0.85);
  const winOverlayStyle = useAnimatedStyle(() => ({
    opacity: winOpacity.value,
    transform: [{ scale: winScale.value }],
  }));

  // Rainbow restart button
  useEffect(() => {
    colorIntervalRef.current = setInterval(() => {
      setBtnColor({
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
      });
    }, 800);
    return () => {
      if (colorIntervalRef.current) clearInterval(colorIntervalRef.current);
    };
  }, []);

  const initGame = useCallback(
    (size: number) => {
      setGridSize(size);
      setTiles(shuffleBoard(size));
      setMoves(0);
      setTime(0);
      setIsPlaying(false);
      setIsWon(false);
      setGameId((id) => id + 1);
      winOpacity.value = 0;
      winScale.value = 0.85;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    initGame(4);
  }, [initGame]);

  // Timer
  useEffect(() => {
    if (!isPlaying || isWon) return;
    const interval = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isPlaying, isWon]);

  const handleTilePress = useCallback(
    (index: number) => {
      if (isWon) return;

      const emptyIndex = tiles.indexOf(0);
      if (index === emptyIndex) return;

      const clickedRow = Math.floor(index / gridSize);
      const clickedCol = index % gridSize;
      const emptyRow = Math.floor(emptyIndex / gridSize);
      const emptyCol = emptyIndex % gridSize;

      const newTiles = [...tiles];

      if (clickedRow === emptyRow) {
        // Same row — shift all tiles between clicked and empty
        if (clickedCol < emptyCol) {
          for (let col = emptyCol; col > clickedCol; col--) {
            newTiles[clickedRow * gridSize + col] =
              newTiles[clickedRow * gridSize + col - 1];
          }
        } else {
          for (let col = emptyCol; col < clickedCol; col++) {
            newTiles[clickedRow * gridSize + col] =
              newTiles[clickedRow * gridSize + col + 1];
          }
        }
        newTiles[index] = 0;
      } else if (clickedCol === emptyCol) {
        // Same column — shift all tiles between clicked and empty
        if (clickedRow < emptyRow) {
          for (let row = emptyRow; row > clickedRow; row--) {
            newTiles[row * gridSize + clickedCol] =
              newTiles[(row - 1) * gridSize + clickedCol];
          }
        } else {
          for (let row = emptyRow; row < clickedRow; row++) {
            newTiles[row * gridSize + clickedCol] =
              newTiles[(row + 1) * gridSize + clickedCol];
          }
        }
        newTiles[index] = 0;
      } else {
        return; // Not in same row or column — ignore
      }

      if (!isPlaying) setIsPlaying(true);
      setTiles(newTiles);
      setMoves((m) => m + 1);

      if (isWinState(newTiles)) {
        setIsWon(true);
        setIsPlaying(false);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        winOpacity.value = withTiming(1, { duration: 300 });
        winScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }
    },
    [tiles, gridSize, isPlaying, isWon, winOpacity, winScale],
  );

  // ─── Board sizing ────────────────────────────────────────────────────────

  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomInset = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  // Estimate vertical space consumed by header, stats, and footer
  const headerH = 80;
  const statsH = 76;
  const footerH = 80;
  const verticalChrome =
    topInset + 16 + headerH + 16 + statsH + 16 + footerH + bottomInset + 16;

  const maxBoardH = screenHeight - verticalChrome;
  const maxBoardW = screenWidth - 48;
  const boardSize = Math.min(maxBoardW, maxBoardH, 420);

  const tileSize =
    (boardSize - BOARD_PADDING * 2 - (gridSize + 1) * GAP) / gridSize;

  // Rainbow button contrast
  const btnLuma =
    btnColor.r * 0.299 + btnColor.g * 0.587 + btnColor.b * 0.114;
  const btnTextColor = btnLuma > 128 ? '#000000' : '#ffffff';

  if (tiles.length === 0) return null;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <View style={styles.titleBlock}>
          <Text style={styles.titleLine1} numberOfLines={1} adjustsFontSizeToFit>
            Ozzie &amp; Grady's
          </Text>
          <Text style={styles.titleLine2}>Sliding Puzzle</Text>
        </View>

        <View style={styles.sizeRow}>
          {[3, 4, 5].map((size) => (
            <TouchableOpacity
              key={size}
              onPress={() => initGame(size)}
              style={[styles.sizeBtn, gridSize === size && styles.sizeBtnOn]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sizeBtnText,
                  gridSize === size && styles.sizeBtnTextOn,
                ]}
              >
                {size}×{size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TIME</Text>
          <Text style={styles.statValue}>{formatTime(time)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MOVES</Text>
          <Text style={styles.statValue}>{moves}</Text>
        </View>
      </View>

      {/* ── Board ── */}
      <View
        style={[
          styles.board,
          { width: boardSize, height: boardSize },
        ]}
      >
        {/* Slot background layer */}
        {Array.from({ length: gridSize * gridSize }).map((_, i) => {
          const slotRow = Math.floor(i / gridSize);
          const slotCol = i % gridSize;
          const slotX = BOARD_PADDING + slotCol * (tileSize + GAP) + GAP;
          const slotY = BOARD_PADDING + slotRow * (tileSize + GAP) + GAP;
          const empty = tiles[i] === 0;
          return (
            <View
              key={`slot-${i}`}
              style={[
                {
                  position: 'absolute',
                  left: slotX,
                  top: slotY,
                  width: tileSize,
                  height: tileSize,
                  borderRadius: 12,
                },
                empty ? styles.emptySlot : styles.filledSlot,
              ]}
            />
          );
        })}

        {/* Animated tile layer */}
        {tiles.map((value, index) => {
          if (value === 0) return null;
          return (
            <Tile
              key={value}
              value={value}
              index={index}
              gameId={gameId}
              gridSize={gridSize}
              tileSize={tileSize}
              gap={GAP}
              boardPadding={BOARD_PADDING}
              onPress={handleTilePress}
              isWon={isWon}
            />
          );
        })}

        {/* Win overlay */}
        {isWon && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.winOverlay, winOverlayStyle]}
          >
            <View style={styles.trophyRing}>
              <Ionicons name="trophy" size={36} color="#ffffff" />
            </View>
            <Text style={styles.winTitle}>Puzzle Solved!</Text>
            <Text style={styles.winSub}>
              {moves} moves · {formatTime(time)}
            </Text>
            <TouchableOpacity
              style={styles.playAgainBtn}
              onPress={() => initGame(gridSize)}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={18} color="#6366f1" />
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* ── Footer / Restart ── */}
      <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
        <TouchableOpacity
          style={[
            styles.restartBtn,
            {
              backgroundColor: `rgb(${btnColor.r},${btnColor.g},${btnColor.b})`,
            },
          ]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            initGame(gridSize);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={20} color={btnTextColor} />
          <Text style={[styles.restartText, { color: btnTextColor }]}>
            Restart Game
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#020617',
  },

  // Header
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  titleBlock: {
    flex: 1,
    marginRight: 12,
  },
  titleLine1: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#f8fafc',
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.4,
  },
  titleLine2: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  sizeRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 4,
    gap: 4,
  },
  sizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sizeBtnOn: {
    backgroundColor: '#6366f1',
  },
  sizeBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
  },
  sizeBtnTextOn: {
    color: '#ffffff',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 14,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#94a3b8',
    letterSpacing: 1.5,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#f8fafc',
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },

  // Board
  board: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  filledSlot: {
    backgroundColor: 'rgba(2,6,23,0.45)',
  },
  emptySlot: {
    borderWidth: 2,
    borderColor: '#1e293b',
    borderStyle: 'dashed',
  },

  // Win overlay
  winOverlay: {
    backgroundColor: 'rgba(2,6,23,0.88)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  trophyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 14,
  },
  winTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#f8fafc',
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  winSub: {
    fontSize: 15,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
  },
  playAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  playAgainText: {
    color: '#020617',
    fontWeight: '800' as const,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },

  // Footer
  footer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  restartText: {
    fontSize: 16,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
  },
});
