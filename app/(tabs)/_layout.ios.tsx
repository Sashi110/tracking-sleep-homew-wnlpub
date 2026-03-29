import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(sleep)">
        <Icon sf="moon.fill" />
        <Label>Sleep</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(homework)">
        <Icon sf="book.fill" />
        <Label>Homework</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(chores)">
        <Icon sf="checkmark.circle.fill" />
        <Label>Chores</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
