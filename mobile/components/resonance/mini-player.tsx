import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useResonancePlayer } from "@/lib/resonance/player";

export function MiniPlayer() {
  const router = useRouter();
  const { currentTrack, isPlaying, toggle } = useResonancePlayer();
  if (!currentTrack) return null;

  return (
    <View style={styles.shell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open now playing for ${currentTrack.title}`}
        onPress={() => router.push("/now-playing")}
        style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
      >
        <View style={styles.artwork}>
          <MaterialIcons name="graphic-eq" color="#0B1210" size={20} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.nowPlaying}>NOW PLAYING</Text>
          <Text numberOfLines={1} style={styles.title}>
            {currentTrack.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {currentTrack.artist || "Unknown artist"}
          </Text>
        </View>
        <MaterialIcons name="keyboard-arrow-up" color="#719286" size={20} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        onPress={toggle}
        style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
      >
        <MaterialIcons
          name={isPlaying ? "pause" : "play-arrow"}
          color="#0B1210"
          size={26}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    backgroundColor: "#193128",
    borderColor: "#355847",
    borderRadius: 20,
    borderWidth: 1,
    bottom: 82,
    flexDirection: "row",
    left: 12,
    minHeight: 70,
    paddingVertical: 4,
    position: "absolute",
    right: 12,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    zIndex: 10,
  },
  copyButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
    paddingLeft: 10,
    paddingVertical: 7,
  },
  artwork: {
    alignItems: "center",
    backgroundColor: "#5DE1B5",
    borderRadius: 13,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  copy: { flex: 1, minWidth: 0 },
  nowPlaying: {
    color: "#5DE1B5",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  title: { color: "#ECF8F2", fontSize: 14, fontWeight: "800" },
  artist: { color: "#A3B5AC", fontSize: 12, marginTop: 2 },
  playButton: {
    alignItems: "center",
    backgroundColor: "#5DE1B5",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginRight: 10,
    width: 44,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
