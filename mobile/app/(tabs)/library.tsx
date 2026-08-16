import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { TrackRow } from "@/components/resonance/track-row";
import { ScreenContainer } from "@/components/screen-container";
import { useResonanceSession } from "@/lib/resonance/session";
import type { Track } from "@/lib/resonance/types";

export default function LibraryScreen() {
  const { api, status } = useResonanceSession();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (!api) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const response = await api.tracks(query, 1, 100);
        setTracks(response.items);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Could not load tracks.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, query],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 260);
    return () => clearTimeout(timer);
  }, [load]);

  if (status === "disconnected") return <Redirect href="/connect" />;
  if (status === "connected") return <Redirect href="/sign-in" />;

  return (
    <ScreenContainer style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={tracks}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.heading}>
              <View>
                <Text style={styles.eyebrow}>YOUR MUSIC</Text>
                <Text style={styles.title}>Library</Text>
                <Text style={styles.subtitle}>Everything in one place.</Text>
              </View>
              <View style={styles.count}>
                <Text style={styles.countValue}>{tracks.length}</Text>
                <Text style={styles.countLabel}>shown</Text>
              </View>
            </View>
            <View style={styles.search}>
              <MaterialIcons name="search" color="#5DE1B5" size={20} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search your library"
                placeholderTextColor="#70877C"
                style={styles.input}
                value={query}
              />
              {query ? (
                <MaterialIcons
                  name="close"
                  color="#70877C"
                  onPress={() => setQuery("")}
                  size={19}
                />
              ) : null}
            </View>
            {loading ? (
              <ActivityIndicator color="#5DE1B5" style={styles.loader} />
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && !error && tracks.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="queue-music" color="#5DE1B5" size={30} />
                </View>
                <Text style={styles.emptyText}>No matching tracks</Text>
                <Text style={styles.emptyHint}>
                  Try a different title, artist, or album.
                </Text>
              </View>
            ) : null}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor="#5DE1B5"
          />
        }
        renderItem={({ item }) => <TrackRow track={item} queue={tracks} />}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 168, paddingTop: 16 },
  heading: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  eyebrow: {
    color: "#5DE1B5",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  title: {
    color: "#ECF8F2",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 4,
  },
  subtitle: { color: "#82998D", fontSize: 14, marginTop: 4 },
  count: { alignItems: "flex-end", paddingBottom: 3 },
  countValue: {
    color: "#ECF8F2",
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  countLabel: { color: "#71887C", fontSize: 11, marginTop: 1 },
  search: {
    alignItems: "center",
    backgroundColor: "#14211D",
    borderColor: "#355847",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 20,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  input: {
    color: "#ECF8F2",
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
    paddingVertical: 10,
  },
  loader: { marginTop: 30 },
  error: {
    color: "#FF8995",
    marginHorizontal: 18,
    marginTop: 20,
    textAlign: "center",
  },
  empty: {
    alignItems: "center",
    backgroundColor: "#14211D",
    borderColor: "#20372E",
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 22,
    padding: 28,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#20372E",
    borderRadius: 20,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  emptyText: {
    color: "#ECF8F2",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyHint: {
    color: "#82998D",
    fontSize: 13,
    marginTop: 5,
    textAlign: "center",
  },
});
