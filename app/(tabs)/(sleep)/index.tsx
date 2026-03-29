import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/utils/api";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Toast } from "@/components/Toast";
import { Moon, Trash2 } from "lucide-react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SleepLog {
  id: string;
  user_id: string;
  bedtime: string;
  wake_time?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  created_at: string;
}

interface ToastState {
  message: string;
  logId: string;
  log: SleepLog;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const hStr = h > 0 ? `${h}h ` : "";
  const mStr = m > 0 ? `${m}m ` : "";
  const sStr = `${s}s`;
  return `${hStr}${mStr}${sStr}`;
}

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: "60%" }]} />
    </Animated.View>
  );
}

function AnimatedListItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function SleepScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeLog = logs.find((l) => !l.wake_time) ?? null;

  const avgDuration = React.useMemo(() => {
    const withDuration = logs.filter((l) => l.duration_minutes != null && l.duration_minutes! > 0);
    if (withDuration.length === 0) return null;
    const total = withDuration.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0);
    return Math.round(total / withDuration.length);
  }, [logs]);

  const fetchLogs = useCallback(async () => {
    console.log("[Sleep] Fetching sleep logs");
    try {
      const data = await apiGet<{ logs: SleepLog[] }>("/api/sleep?limit=14");
      setLogs(data.logs ?? []);
      setError("");
    } catch (err: any) {
      console.error("[Sleep] Failed to fetch logs:", err);
      setError("Couldn't load sleep logs. Pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (activeLog) {
      const bedtime = new Date(activeLog.bedtime).getTime();
      const tick = () => {
        const now = Date.now();
        setElapsed(Math.floor((now - bedtime) / 1000));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeLog?.id]);

  const handleBedtime = async () => {
    console.log("[Sleep] Tapped 'Time for Bed' button");
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const newLog = await apiPost<SleepLog>("/api/sleep", {
        bedtime: new Date().toISOString(),
      });
      console.log("[Sleep] Created sleep log:", newLog.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLogs((prev) => [newLog, ...prev]);
    } catch (err: any) {
      console.error("[Sleep] Failed to create log:", err);
      setError("Couldn't log bedtime. Please try again.");
    }
  };

  const handleWakeUp = async () => {
    if (!activeLog) return;
    console.log("[Sleep] Tapped 'Wake Up' button for log:", activeLog.id);
    if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const updated = await apiPatch<SleepLog>(`/api/sleep/${activeLog.id}`, {
        wake_time: new Date().toISOString(),
      });
      console.log("[Sleep] Updated sleep log with wake time:", updated.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch (err: any) {
      console.error("[Sleep] Failed to update wake time:", err);
      setError("Couldn't log wake time. Please try again.");
    }
  };

  const handleDelete = (log: SleepLog) => {
    console.log("[Sleep] Deleting sleep log:", log.id);
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLogs((prev) => prev.filter((l) => l.id !== log.id));

    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setToast({ message: "Sleep log deleted", logId: log.id, log });

    deleteTimerRef.current = setTimeout(async () => {
      try {
        await apiDelete(`/api/sleep/${log.id}`);
        console.log("[Sleep] Confirmed delete for log:", log.id);
      } catch (err) {
        console.error("[Sleep] Failed to delete log:", err);
      }
      setToast(null);
    }, 4000);
  };

  const handleUndo = () => {
    if (!toast) return;
    console.log("[Sleep] Undo delete for log:", toast.logId);
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLogs((prev) => {
      const exists = prev.find((l) => l.id === toast.logId);
      if (exists) return prev;
      return [toast.log, ...prev].sort(
        (a, b) => new Date(b.bedtime).getTime() - new Date(a.bedtime).getTime()
      );
    });
    setToast(null);
  };

  const elapsedDisplay = formatElapsed(elapsed);
  const avgDisplay = avgDuration != null ? formatDuration(avgDuration) : null;

  const renderLog = ({ item, index }: { item: SleepLog; index: number }) => {
    const bedtimeStr = formatTime(item.bedtime);
    const dateStr = formatDate(item.bedtime);
    const wakeStr = item.wake_time ? formatTime(item.wake_time) : null;
    const durationStr = item.duration_minutes != null ? formatDuration(item.duration_minutes) : null;
    const isActive = !item.wake_time;

    return (
      <AnimatedListItem index={index}>
        <View style={styles.logCard}>
          <View style={styles.logLeft}>
            <Text style={styles.logDate}>{dateStr}</Text>
            <View style={styles.logTimeRow}>
              <Text style={styles.logTime}>{bedtimeStr}</Text>
              <Text style={styles.logArrow}>→</Text>
              <Text style={[styles.logTime, isActive && styles.logTimeActive]}>
                {wakeStr ?? "Still sleeping..."}
              </Text>
            </View>
          </View>
          <View style={styles.logRight}>
            {durationStr ? (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{durationStr}</Text>
              </View>
            ) : isActive ? (
              <Text style={styles.zzz}>💤</Text>
            ) : null}
            <AnimatedPressable
              onPress={() => handleDelete(item)}
              style={styles.deleteBtn}
              scaleValue={0.9}
            >
              <Trash2 size={16} color={COLORS.textTertiary} />
            </AnimatedPressable>
          </View>
        </View>
      </AnimatedListItem>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Stats row */}
      {avgDisplay && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Weekly Avg</Text>
            <Text style={styles.statValue}>{avgDisplay}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Logs</Text>
            <Text style={styles.statValue}>{logs.length}</Text>
          </View>
        </View>
      )}

      {/* Active session card */}
      {activeLog ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeEmoji}>😴</Text>
          <Text style={styles.activeTitle}>You're sleeping...</Text>
          <Text style={styles.activeElapsed}>{elapsedDisplay}</Text>
          <AnimatedPressable onPress={handleWakeUp} style={styles.wakeBtn} scaleValue={0.96}>
            <Text style={styles.wakeBtnText}>Wake Up! ☀️</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <AnimatedPressable onPress={handleBedtime} style={styles.bedtimeBtn} scaleValue={0.97}>
          <Text style={styles.bedtimeBtnText}>Time for Bed 🌙</Text>
        </AnimatedPressable>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {logs.length > 0 && (
        <Text style={styles.sectionTitle}>Sleep History</Text>
      )}
    </View>
  );

  const listEmpty = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🌙</Text>
      <Text style={styles.emptyTitle}>No sleep logged yet</Text>
      <Text style={styles.emptySubtitle}>Tap the button above to log your bedtime</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 100 }]}>
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLog}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      />
      {toast && (
        <Toast
          message={toast.message}
          onUndo={handleUndo}
          onDismiss={() => setToast(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  listHeader: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: "0 1px 4px rgba(108, 99, 255, 0.06)",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.primary,
  },
  activeCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 20px rgba(108, 99, 255, 0.3)",
  },
  activeEmoji: {
    fontSize: 48,
  },
  activeTitle: {
    fontSize: 20,
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFF",
  },
  activeElapsed: {
    fontSize: 32,
    fontFamily: "Nunito_800ExtraBold",
    color: "rgba(255,255,255,0.9)",
    fontVariant: ["tabular-nums"],
  },
  wakeBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  wakeBtnText: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
  },
  bedtimeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: "center",
    boxShadow: "0 4px 16px rgba(108, 99, 255, 0.25)",
  },
  bedtimeBtnText: {
    color: "#FFF",
    fontSize: 20,
    fontFamily: "Nunito_800ExtraBold",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
    marginTop: 8,
  },
  logCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: "0 1px 4px rgba(108, 99, 255, 0.05)",
  },
  logLeft: {
    flex: 1,
    gap: 4,
  },
  logDate: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  logTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logTime: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: COLORS.text,
  },
  logTimeActive: {
    color: COLORS.primary,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
  },
  logArrow: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  logRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  durationBadge: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: COLORS.primary,
  },
  zzz: {
    fontSize: 20,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
    textAlign: "center",
    maxWidth: 260,
  },
  errorBox: {
    backgroundColor: "rgba(244, 67, 54, 0.08)",
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
  },
  skeletonCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.border,
    width: "80%",
  },
});
