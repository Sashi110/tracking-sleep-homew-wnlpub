import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import FloatingTabBar from "@/components/FloatingTabBar";
import { Stack } from "expo-router";
import { Moon, BookOpen, CheckCircle2 } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";

const TABS = [
  { name: "sleep", route: "/(tabs)/(sleep)" as const, label: "Sleep", icon: Moon },
  { name: "homework", route: "/(tabs)/(homework)" as const, label: "Homework", icon: BookOpen },
  { name: "chores", route: "/(tabs)/(chores)" as const, label: "Chores", icon: CheckCircle2 },
];

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const activeIndex = React.useMemo(() => {
    if (pathname.includes("homework")) return 1;
    if (pathname.includes("chores")) return 2;
    return 0;
  }, [pathname]);

  return (
    <SafeAreaView style={styles.tabBarSafe} edges={["bottom"]}>
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => {
          const isActive = activeIndex === index;
          const IconComp = tab.icon;
          return (
            <Pressable
              key={tab.name}
              style={styles.tabItem}
              onPress={() => {
                console.log(`[Nav] Tab pressed: ${tab.label}`);
                router.push(tab.route);
              }}
            >
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <IconComp
                  size={22}
                  color={isActive ? COLORS.primary : COLORS.textTertiary}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="(sleep)" />
        <Stack.Screen name="(homework)" />
        <Stack.Screen name="(chores)" />
      </Stack>
      <CustomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarSafe: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tabBar: {
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  tabIconWrap: {
    width: 44,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: COLORS.primaryMuted,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textTertiary,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontFamily: "Nunito_700Bold",
  },
});
