import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useResonancePlayer } from "@/lib/resonance/player";
import type { Track } from "@/lib/resonance/types";

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function TrackRow({ track, queue }: { track: Track; queue?: Track[] }) {
  const { currentTrack, isPlaying, playTrack } = useResonancePlayer();
  const active = currentTrack?.id === track.id;
  const title = track.title || track.file_name;
  const artist = track.artist || "Unknown artist";
  const album = track.album || "Unknown album";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play ${title} by ${artist}`}
      accessibilityHint="Opens this track in the player"
      onPress={() => void playTrack(track, queue)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.artwork, active && styles.artworkActive]}>
        <MaterialIcons
          name={active && isPlaying ? "graphic-eq" : "music-note"}
          size={22}
          color={active ? "#0B1210" : "#A3B5AC"}
        />
      </View>
      <View style={styles.copy}>
        <Text
          numberOfLines={1}
          style={[styles.title, active && styles.activeText]}
        >
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {artist}
        </Text>
        <Text numberOfLines={1} style={styles.album}>
          {album}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text style={styles.duration}>{formatDuration(track.duration_ms)}</Text>
        <MaterialIcons
          name={active ? "equalizer" : "play-arrow"}
          size={17}
          color={active ? "#5DE1B5" : "#607B6E"}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomColor: "#1D3028",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  rowPressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
  artwork: {
    alignItems: "center",
    backgroundColor: "#1A2A24",
    borderRadius: 14,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  artworkActive: { backgroundColor: "#5DE1B5" },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: { color: "#ECF8F2", fontSize: 15, fontWeight: "700" },
  activeText: { color: "#5DE1B5" },
  meta: { color: "#A3B5AC", fontSize: 13, marginTop: 1 },
  album: { color: "#61796C", fontSize: 12 },
  trailing: { alignItems: "flex-end", gap: 5, justifyContent: "center" },
  duration: { color: "#A3B5AC", fontSize: 12, fontVariant: ["tabular-nums"] },
});
