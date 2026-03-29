import { Stack } from "expo-router";

export default function SleepLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: "transparent" },
        headerBlurEffect: "none",
        headerLargeTitle: true,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Sleep 🌙" }} />
    </Stack>
  );
}
