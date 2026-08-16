import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniPlayer } from "@/components/resonance/mini-player";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.shell}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#5DE1B5",
          tabBarInactiveTintColor: "#7D9186",
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: "#14211D",
            borderRadius: 24,
            borderTopWidth: 0,
            bottom: Math.max(insets.bottom, 10),
            elevation: 8,
            height: 62,
            left: 12,
            paddingBottom: 7,
            paddingTop: 7,
            position: "absolute",
            right: 12,
            shadowColor: "#000000",
            shadowOpacity: 0.28,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          },
          tabBarItemStyle: { borderRadius: 18, marginHorizontal: 3 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "800" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="home-filled" color={color} size={23} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="library-music" color={color} size={23} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="search" color={color} size={23} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="settings" color={color} size={23} />
            ),
          }}
        />
      </Tabs>
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: "#0B1210", flex: 1 },
});
