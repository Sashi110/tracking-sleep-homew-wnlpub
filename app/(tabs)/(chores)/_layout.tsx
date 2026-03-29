import { Stack } from "expo-router";

export default function ChoresLayout() {
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
      <Stack.Screen name="index" options={{ title: "Chores ✨" }} />
    </Stack>
  );
}
