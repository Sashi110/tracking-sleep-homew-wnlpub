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
  TextInput,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/utils/api";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Toast } from "@/components/Toast";
import { Plus, X, Pencil, Trash2 } from "lucide-react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Chore {
  id: string;
  user_id: string;
  title: string;
  emoji: string;
  frequency: "daily" | "weekly";
  completed_today: boolean;
  last_completed_at?: string | null;
  created_at: string;
}

interface ToastState {
  message: string;
  choreId: string;
  chore: Chore;
}

const CHORE_EMOJIS = ["🛏️", "🦷", "🧹", "🍽️", "🐕", "🌱", "🚿", "🧺", "🗑️", "📚", "🧼", "🪴", "🐱", "🧽", "🪣"];

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
      <View style={styles.skeletonEmoji} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: "40%" }]} />
      </View>
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

function ChoreCard({
  chore,
  index,
  onToggle,
  onEdit,
  onDelete,
}: {
  chore: Chore;
  index: number;
  onToggle: (chore: Chore) => void;
  onEdit: (chore: Chore) => void;
  onDelete: (chore: Chore) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const isCompleted = chore.completed_today;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 60, bounciness: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }),
    ]).start();
    onToggle(chore);
  };

  const freqLabel = chore.frequency === "daily" ? "Daily" : "Weekly";

  return (
    <AnimatedListItem index={index}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={handlePress}
          onLongPress={() => {
            console.log(`[Chores] Long press on chore: ${chore.id}`);
            if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          style={[styles.choreCard, isCompleted && styles.choreCardDone]}
        >
          <View style={styles.choreEmojiWrap}>
            <Text style={styles.choreEmoji}>{chore.emoji}</Text>
            {isCompleted && (
              <View style={styles.checkOverlay}>
                <Text style={styles.checkOverlayText}>✓</Text>
              </View>
            )}
          </View>
          <View style={styles.choreContent}>
            <Text style={[styles.choreTitle, isCompleted && styles.choreTitleDone]} numberOfLines={1}>
              {chore.title}
            </Text>
            <View style={styles.choreFreqRow}>
              <View style={[styles.freqBadge, isCompleted && styles.freqBadgeDone]}>
                <Text style={[styles.freqText, isCompleted && styles.freqTextDone]}>{freqLabel}</Text>
              </View>
              {isCompleted && <Text style={styles.doneLabel}>Done! 🎉</Text>}
            </View>
          </View>
          <View style={styles.choreActions}>
            <AnimatedPressable
              onPress={() => {
                console.log(`[Chores] Edit chore: ${chore.id}`);
                onEdit(chore);
              }}
              style={styles.actionBtn}
              scaleValue={0.85}
            >
              <Pencil size={16} color={COLORS.textTertiary} />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => onDelete(chore)}
              style={styles.actionBtn}
              scaleValue={0.85}
            >
              <Trash2 size={16} color={COLORS.textTertiary} />
            </AnimatedPressable>
          </View>
        </Pressable>
      </Animated.View>
    </AnimatedListItem>
  );
}

export default function ChoresScreen() {
  const insets = useSafeAreaInsets();
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [formEmoji, setFormEmoji] = useState("🛏️");
  const [formTitle, setFormTitle] = useState("");
  const [formFrequency, setFormFrequency] = useState<"daily" | "weekly">("daily");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;

  const completedCount = chores.filter((c) => c.completed_today).length;
  const totalCount = chores.length;

  const progressPercent = totalCount > 0 ? completedCount / totalCount : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  const fetchChores = useCallback(async () => {
    console.log("[Chores] Fetching chores");
    try {
      const data = await apiGet<{ chores: Chore[] }>("/api/chores");
      setChores(data.chores ?? []);
      setError("");
    } catch (err: any) {
      console.error("[Chores] Failed to fetch chores:", err);
      setError("Couldn't load chores. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChores();
  }, [fetchChores]);

  const handleToggle = async (chore: Chore) => {
    const newCompleted = !chore.completed_today;
    console.log(`[Chores] Toggling chore ${chore.id} completed: ${newCompleted}`);
    if (Platform.OS === "ios" && newCompleted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChores((prev) => prev.map((c) => c.id === chore.id ? { ...c, completed_today: newCompleted } : c));
    try {
      const updated = await apiPatch<Chore>(`/api/chores/${chore.id}`, { completed_today: newCompleted });
      setChores((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    } catch (err: any) {
      console.error("[Chores] Failed to toggle chore:", err);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setChores((prev) => prev.map((c) => c.id === chore.id ? { ...c, completed_today: chore.completed_today } : c));
    }
  };

  const handleDelete = (chore: Chore) => {
    console.log("[Chores] Deleting chore:", chore.id);
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChores((prev) => prev.filter((c) => c.id !== chore.id));

    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setToast({ message: "Chore deleted", choreId: chore.id, chore });

    deleteTimerRef.current = setTimeout(async () => {
      try {
        await apiDelete(`/api/chores/${chore.id}`);
        console.log("[Chores] Confirmed delete:", chore.id);
      } catch (err) {
        console.error("[Chores] Failed to delete chore:", err);
      }
      setToast(null);
    }, 4000);
  };

  const handleUndo = () => {
    if (!toast) return;
    console.log("[Chores] Undo delete:", toast.choreId);
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChores((prev) => {
      const exists = prev.find((c) => c.id === toast.choreId);
      if (exists) return prev;
      return [...prev, toast.chore];
    });
    setToast(null);
  };

  const openAddForm = () => {
    console.log("[Chores] Tapped Add Chore FAB");
    setEditingChore(null);
    setFormEmoji("🛏️");
    setFormTitle("");
    setFormFrequency("daily");
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (chore: Chore) => {
    setEditingChore(chore);
    setFormEmoji(chore.emoji);
    setFormTitle(chore.title);
    setFormFrequency(chore.frequency);
    setFormError("");
    setShowForm(true);
  };

  const handleSubmitForm = async () => {
    if (!formTitle.trim()) {
      setFormError("Please enter a chore name");
      return;
    }
    setFormError("");
    setFormSubmitting(true);

    try {
      if (editingChore) {
        console.log(`[Chores] Updating chore: ${editingChore.id}`);
        const updated = await apiPatch<Chore>(`/api/chores/${editingChore.id}`, {
          title: formTitle.trim(),
          emoji: formEmoji,
          frequency: formFrequency,
        });
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setChores((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      } else {
        console.log(`[Chores] Adding chore: ${formEmoji} ${formTitle}`);
        const newChore = await apiPost<Chore>("/api/chores", {
          title: formTitle.trim(),
          emoji: formEmoji,
          frequency: formFrequency,
        });
        console.log("[Chores] Created chore:", newChore.id);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setChores((prev) => [...prev, newChore]);
      }
      setShowForm(false);
    } catch (err: any) {
      console.error("[Chores] Failed to save chore:", err);
      setFormError("Couldn't save chore. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const completedCountDisplay = completedCount;
  const totalCountDisplay = totalCount;

  const listHeader = (
    <View style={styles.listHeader}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {totalCount > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressLabel}>Today's Progress</Text>
            <Text style={styles.progressCount}>
              {completedCountDisplay}
              <Text style={styles.progressCountTotal}>/{totalCountDisplay}</Text>
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressSub}>
            {completedCount === totalCount && totalCount > 0
              ? "All done! Amazing work! 🌟"
              : `${totalCount - completedCount} chore${totalCount - completedCount !== 1 ? "s" : ""} left`}
          </Text>
        </View>
      )}
    </View>
  );

  const listEmpty = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>✨</Text>
      <Text style={styles.emptyTitle}>No chores yet! 🎉</Text>
      <Text style={styles.emptySubtitle}>Add your first chore to get started</Text>
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
        data={chores}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ChoreCard
            chore={item}
            index={index}
            onToggle={handleToggle}
            onEdit={openEditForm}
            onDelete={handleDelete}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <AnimatedPressable
        onPress={openAddForm}
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        scaleValue={0.93}
      >
        <Plus size={28} color="#FFF" strokeWidth={2.5} />
      </AnimatedPressable>

      {toast && (
        <Toast message={toast.message} onUndo={handleUndo} onDismiss={() => setToast(null)} />
      )}

      {/* Add/Edit Chore Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingChore ? "Edit Chore ✏️" : "Add Chore ✨"}</Text>
            <Pressable onPress={() => setShowForm(false)} style={styles.modalClose}>
              <X size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Pick an Emoji</Text>
              <View style={styles.emojiGrid}>
                {CHORE_EMOJIS.map((emoji) => (
                  <AnimatedPressable
                    key={emoji}
                    onPress={() => {
                      console.log(`[Chores] Selected emoji: ${emoji}`);
                      setFormEmoji(emoji);
                    }}
                    style={[styles.emojiBtn, formEmoji === emoji && styles.emojiBtnActive]}
                    scaleValue={0.88}
                  >
                    <Text style={styles.emojiOption}>{emoji}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Chore Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Make my bed"
                placeholderTextColor={COLORS.textTertiary}
                value={formTitle}
                onChangeText={setFormTitle}
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Frequency</Text>
              <View style={styles.freqToggle}>
                <AnimatedPressable
                  onPress={() => {
                    console.log("[Chores] Frequency: daily");
                    setFormFrequency("daily");
                  }}
                  style={[styles.freqBtn, formFrequency === "daily" && styles.freqBtnActive]}
                  scaleValue={0.96}
                >
                  <Text style={[styles.freqBtnText, formFrequency === "daily" && styles.freqBtnTextActive]}>
                    Daily
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => {
                    console.log("[Chores] Frequency: weekly");
                    setFormFrequency("weekly");
                  }}
                  style={[styles.freqBtn, formFrequency === "weekly" && styles.freqBtnActive]}
                  scaleValue={0.96}
                >
                  <Text style={[styles.freqBtnText, formFrequency === "weekly" && styles.freqBtnTextActive]}>
                    Weekly
                  </Text>
                </AnimatedPressable>
              </View>
            </View>

            {formError ? (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <AnimatedPressable
              onPress={handleSubmitForm}
              disabled={formSubmitting}
              style={styles.formSubmitBtn}
              scaleValue={0.97}
            >
              {formSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.formSubmitText}>
                  {editingChore ? "Save Changes ✅" : "Add Chore ✅"}
                </Text>
              )}
            </AnimatedPressable>
          </ScrollView>
        </View>
      </Modal>
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
  progressCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: "0 2px 8px rgba(108, 99, 255, 0.08)",
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: COLORS.text,
  },
  progressCount: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.primary,
  },
  progressCountTotal: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  progressTrack: {
    height: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressSub: {
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  choreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: "0 1px 4px rgba(108, 99, 255, 0.05)",
  },
  choreCardDone: {
    backgroundColor: "rgba(76, 175, 80, 0.06)",
    borderColor: "rgba(76, 175, 80, 0.2)",
  },
  choreEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  choreEmoji: {
    fontSize: 28,
  },
  checkOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOverlayText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
  },
  choreContent: {
    flex: 1,
    gap: 6,
  },
  choreTitle: {
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
    color: COLORS.text,
  },
  choreTitleDone: {
    textDecorationLine: "line-through",
    color: COLORS.textTertiary,
  },
  choreFreqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  freqBadge: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  freqBadgeDone: {
    backgroundColor: "rgba(76, 175, 80, 0.12)",
  },
  freqText: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    color: COLORS.primary,
  },
  freqTextDone: {
    color: COLORS.success,
  },
  doneLabel: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.success,
  },
  choreActions: {
    flexDirection: "row",
    gap: 4,
  },
  actionBtn: {
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
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(108, 99, 255, 0.35)",
  },
  skeletonCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  skeletonEmoji: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.border,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.border,
    width: "80%",
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formGroup: {
    marginTop: 20,
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  formInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  emojiBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  emojiOption: {
    fontSize: 26,
  },
  freqToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  freqBtnActive: {
    backgroundColor: COLORS.surface,
    boxShadow: "0 1px 4px rgba(108, 99, 255, 0.1)",
  },
  freqBtnText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  freqBtnTextActive: {
    color: COLORS.primary,
    fontFamily: "Nunito_700Bold",
  },
  formErrorBox: {
    marginTop: 12,
    backgroundColor: "rgba(244, 67, 54, 0.08)",
    borderRadius: 10,
    padding: 12,
  },
  formErrorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
  },
  formSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  formSubmitText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Nunito_800ExtraBold",
  },
});
