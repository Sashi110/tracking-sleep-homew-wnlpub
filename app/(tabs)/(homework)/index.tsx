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
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/utils/api";
import { COLORS, SUBJECT_COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Toast } from "@/components/Toast";
import { Plus, Trash2, Check, X } from "lucide-react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface HomeworkItem {
  id: string;
  user_id: string;
  subject: string;
  title: string;
  due_date: string;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
}

interface ToastState {
  message: string;
  itemId: string;
  item: HomeworkItem;
}

const SUBJECTS = ["Math", "Science", "English", "History", "Art", "Other"];

function formatDueDate(dateStr: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: "Overdue", overdue: true };
  if (diff === 0) return { label: "Due today", overdue: false };
  if (diff === 1) return { label: "Due tomorrow", overdue: false };
  if (diff <= 7) {
    const dayName = due.toLocaleDateString([], { weekday: "short" });
    return { label: `Due ${dayName}`, overdue: false };
  }
  const formatted = due.toLocaleDateString([], { month: "short", day: "numeric" });
  return { label: `Due ${formatted}`, overdue: false };
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
      <View style={[styles.skeletonLine, { width: "40%" }]} />
      <View style={styles.skeletonLine} />
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

export default function HomeworkScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [formSubject, setFormSubject] = useState("Math");
  const [formTitle, setFormTitle] = useState("");
  const [formDueDate, setFormDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchItems = useCallback(async () => {
    console.log("[Homework] Fetching homework items");
    try {
      const data = await apiGet<{ items: HomeworkItem[] }>("/api/homework");
      setItems(data.items ?? []);
      setError("");
    } catch (err: any) {
      console.error("[Homework] Failed to fetch items:", err);
      setError("Couldn't load homework. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const todoItems = items
    .filter((i) => !i.completed)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const doneItems = items
    .filter((i) => i.completed)
    .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime());

  const displayItems = tab === "todo" ? todoItems : doneItems;

  const handleToggleComplete = async (item: HomeworkItem) => {
    const newCompleted = !item.completed;
    console.log(`[Homework] Toggling item ${item.id} completed: ${newCompleted}`);
    if (Platform.OS === "ios" && newCompleted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, completed: newCompleted } : i));
    try {
      const updated = await apiPatch<HomeworkItem>(`/api/homework/${item.id}`, { completed: newCompleted });
      setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
    } catch (err: any) {
      console.error("[Homework] Failed to toggle complete:", err);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, completed: item.completed } : i));
    }
  };

  const handleDelete = (item: HomeworkItem) => {
    console.log("[Homework] Deleting item:", item.id);
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setToast({ message: "Homework deleted", itemId: item.id, item });

    deleteTimerRef.current = setTimeout(async () => {
      try {
        await apiDelete(`/api/homework/${item.id}`);
        console.log("[Homework] Confirmed delete:", item.id);
      } catch (err) {
        console.error("[Homework] Failed to delete:", err);
      }
      setToast(null);
    }, 4000);
  };

  const handleUndo = () => {
    if (!toast) return;
    console.log("[Homework] Undo delete:", toast.itemId);
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => {
      const exists = prev.find((i) => i.id === toast.itemId);
      if (exists) return prev;
      return [...prev, toast.item];
    });
    setToast(null);
  };

  const handleAddHomework = async () => {
    if (!formTitle.trim()) {
      setFormError("Please enter a title");
      return;
    }
    setFormError("");
    setFormSubmitting(true);
    const dueDateStr = formDueDate.toISOString().split("T")[0];
    console.log(`[Homework] Adding homework: ${formSubject} - ${formTitle} due ${dueDateStr}`);
    try {
      const newItem = await apiPost<HomeworkItem>("/api/homework", {
        subject: formSubject,
        title: formTitle.trim(),
        due_date: dueDateStr,
      });
      console.log("[Homework] Created homework item:", newItem.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems((prev) => [newItem, ...prev]);
      setShowForm(false);
      setFormTitle("");
      setFormSubject("Math");
      setFormDueDate(new Date());
      setTab("todo");
    } catch (err: any) {
      console.error("[Homework] Failed to add homework:", err);
      setFormError("Couldn't add homework. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const renderItem = ({ item, index }: { item: HomeworkItem; index: number }) => {
    const subjectColor = SUBJECT_COLORS[item.subject] ?? COLORS.other;
    const { label: dueDateLabel, overdue } = formatDueDate(item.due_date);
    const isCompleted = item.completed;

    return (
      <AnimatedListItem index={index}>
        <View style={styles.hwCard}>
          <AnimatedPressable
            onPress={() => handleToggleComplete(item)}
            style={[styles.checkbox, isCompleted && styles.checkboxDone]}
            scaleValue={0.85}
          >
            {isCompleted && <Check size={14} color="#FFF" strokeWidth={3} />}
          </AnimatedPressable>
          <View style={styles.hwContent}>
            <View style={styles.hwTopRow}>
              <View style={[styles.subjectBadge, { backgroundColor: subjectColor + "20" }]}>
                <Text style={[styles.subjectText, { color: subjectColor }]}>{item.subject}</Text>
              </View>
              <Text style={[styles.dueDateText, overdue && styles.dueDateOverdue, isCompleted && styles.dueDateDone]}>
                {dueDateLabel}
              </Text>
            </View>
            <Text style={[styles.hwTitle, isCompleted && styles.hwTitleDone]} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
          <AnimatedPressable onPress={() => handleDelete(item)} style={styles.deleteBtn} scaleValue={0.9}>
            <Trash2 size={16} color={COLORS.textTertiary} />
          </AnimatedPressable>
        </View>
      </AnimatedListItem>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {/* Segmented control */}
      <View style={styles.segmented}>
        <AnimatedPressable
          onPress={() => {
            console.log("[Homework] Tab: To Do");
            setTab("todo");
          }}
          style={[styles.segBtn, tab === "todo" && styles.segBtnActive]}
          scaleValue={0.97}
        >
          <Text style={[styles.segBtnText, tab === "todo" && styles.segBtnTextActive]}>
            To Do ({todoItems.length})
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => {
            console.log("[Homework] Tab: Done");
            setTab("done");
          }}
          style={[styles.segBtn, tab === "done" && styles.segBtnActive]}
          scaleValue={0.97}
        >
          <Text style={[styles.segBtnText, tab === "done" && styles.segBtnTextActive]}>
            Done ({doneItems.length})
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );

  const emptyLabel = tab === "todo" ? "No homework! 🎉" : "Nothing done yet 📝";
  const emptySub = tab === "todo" ? "Tap + to add your first assignment" : "Complete some homework to see it here";

  const listEmpty = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{tab === "todo" ? "🎉" : "📝"}</Text>
      <Text style={styles.emptyTitle}>{emptyLabel}</Text>
      <Text style={styles.emptySubtitle}>{emptySub}</Text>
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
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <AnimatedPressable
        onPress={() => {
          console.log("[Homework] Tapped Add Homework FAB");
          setShowForm(true);
        }}
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        scaleValue={0.93}
      >
        <Plus size={28} color="#FFF" strokeWidth={2.5} />
      </AnimatedPressable>

      {toast && (
        <Toast message={toast.message} onUndo={handleUndo} onDismiss={() => setToast(null)} />
      )}

      {/* Add Homework Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Homework 📚</Text>
            <Pressable onPress={() => setShowForm(false)} style={styles.modalClose}>
              <X size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
                <View style={styles.subjectChips}>
                  {SUBJECTS.map((s) => {
                    const color = SUBJECT_COLORS[s] ?? COLORS.other;
                    const isSelected = formSubject === s;
                    return (
                      <AnimatedPressable
                        key={s}
                        onPress={() => {
                          console.log(`[Homework] Selected subject: ${s}`);
                          setFormSubject(s);
                        }}
                        style={[
                          styles.subjectChip,
                          { borderColor: color },
                          isSelected && { backgroundColor: color },
                        ]}
                        scaleValue={0.93}
                      >
                        <Text style={[styles.subjectChipText, { color: isSelected ? "#FFF" : color }]}>
                          {s}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Chapter 5 worksheet"
                placeholderTextColor={COLORS.textTertiary}
                value={formTitle}
                onChangeText={setFormTitle}
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Due Date</Text>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={formDueDate}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    if (date) {
                      console.log(`[Homework] Due date selected: ${date.toISOString()}`);
                      setFormDueDate(date);
                    }
                  }}
                  accentColor={COLORS.primary}
                  style={styles.datePicker}
                />
              ) : (
                <>
                  <AnimatedPressable
                    onPress={() => setShowDatePicker(true)}
                    style={styles.datePickerBtn}
                  >
                    <Text style={styles.datePickerBtnText}>
                      {formDueDate.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                    </Text>
                  </AnimatedPressable>
                  {showDatePicker && (
                    <DateTimePicker
                      value={formDueDate}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={(_, date) => {
                        setShowDatePicker(false);
                        if (date) {
                          console.log(`[Homework] Due date selected: ${date.toISOString()}`);
                          setFormDueDate(date);
                        }
                      }}
                    />
                  )}
                </>
              )}
            </View>

            {formError ? (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <AnimatedPressable
              onPress={handleAddHomework}
              disabled={formSubmitting}
              style={styles.formSubmitBtn}
              scaleValue={0.97}
            >
              {formSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.formSubmitText}>Add Homework ✅</Text>
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
  segmented: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  segBtnActive: {
    backgroundColor: COLORS.surface,
    boxShadow: "0 1px 4px rgba(108, 99, 255, 0.1)",
  },
  segBtnText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  segBtnTextActive: {
    color: COLORS.primary,
    fontFamily: "Nunito_700Bold",
  },
  hwCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: "0 1px 4px rgba(108, 99, 255, 0.05)",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  checkboxDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  hwContent: {
    flex: 1,
    gap: 4,
  },
  hwTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  subjectBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subjectText: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
  },
  dueDateText: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  dueDateOverdue: {
    color: COLORS.danger,
  },
  dueDateDone: {
    color: COLORS.textTertiary,
  },
  hwTitle: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: COLORS.text,
  },
  hwTitleDone: {
    textDecorationLine: "line-through",
    color: COLORS.textTertiary,
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
  subjectScroll: {
    marginHorizontal: -4,
  },
  subjectChips: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
  },
  subjectChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  subjectChipText: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
  datePicker: {
    marginLeft: -8,
  },
  datePickerBtn: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  datePickerBtnText: {
    fontSize: 15,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.text,
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
