import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { TrackRow } from "@/components/resonance/track-row";
import { ScreenContainer } from "@/components/screen-container";
import { useResonanceSession } from "@/lib/resonance/session";
import type { ResonanceStats, Track } from "@/lib/resonance/types";

export default function HomeScreen() {
  const router = useRouter();
  const { api, status, user } = useResonanceSession();
  const [stats, setStats] = useState<ResonanceStats | null>(null);
  const [recent, setRecent] = useState<Track[]>([]);
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
        const [nextStats, nextRecent] = await Promise.all([
          api.stats(),
          api.recentlyPlayed(),
        ]);
        setStats(nextStats);
        setRecent(nextRecent);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load your library.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "booting")
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator color="#5DE1B5" />
      </ScreenContainer>
    );
  if (status === "disconnected") return <Redirect href="/connect" />;
  if (status === "connected") return <Redirect href="/sign-in" />;

  return (
    <ScreenContainer
      containerClassName="bg-background"
      style={styles.container}
    >
      <FlatList
        contentContainerStyle={styles.content}
        data={recent}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>RESONANCE</Text>
                <Text style={styles.greeting}>
                  Good listening, {user?.username ?? "friend"}.
                </Text>
                <Text style={styles.subheading}>
                  Your music, ready when you are.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Open settings"
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [
                  styles.settings,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="settings" color="#ECF8F2" size={22} />
              </Pressable>
            </View>
            <View style={styles.statCard}>
              <View>
                <Text style={styles.statKicker}>YOUR LIBRARY</Text>
                <Text style={styles.statValue}>
                  {stats?.total_tracks ?? "—"}
                </Text>
                <Text style={styles.statLabel}>tracks ready to play</Text>
              </View>
              <View style={styles.statIcon}>
                <MaterialIcons name="library-music" color="#0B1210" size={30} />
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push("/library")}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.actionIcon, styles.actionIconGreen]}>
                  <MaterialIcons name="queue-music" color="#0B1210" size={19} />
                </View>
                <Text style={styles.actionText}>Browse library</Text>
                <MaterialIcons name="chevron-right" color="#7F9B8D" size={19} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/search")}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.actionIcon, styles.actionIconSlate]}>
                  <MaterialIcons name="search" color="#ECF8F2" size={19} />
                </View>
                <Text style={styles.actionText}>Find something</Text>
                <MaterialIcons name="chevron-right" color="#7F9B8D" size={19} />
              </Pressable>
            </View>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>Recently played</Text>
                <Text style={styles.sectionSubtitle}>
                  Pick up where you left off
                </Text>
              </View>
              <Pressable onPress={() => router.push("/library")}>
                <Text style={styles.link}>See all</Text>
              </Pressable>
            </View>
            {loading ? (
              <ActivityIndicator color="#5DE1B5" style={styles.loader} />
            ) : null}
            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void load()}>
                  <Text style={styles.retry}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
            {!loading && !error && recent.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="history" color="#5DE1B5" size={30} />
                <Text style={styles.emptyTitle}>No listening history yet</Text>
                <Text style={styles.emptyCopy}>
                  Pick a track from your library to begin.
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
        renderItem={({ item }) => <TrackRow track={item} queue={recent} />}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  container: { flex: 1 },
  content: { paddingBottom: 168, paddingTop: 6 },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  headerCopy: { flex: 1, paddingRight: 18 },
  eyebrow: {
    color: "#5DE1B5",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  greeting: {
    color: "#ECF8F2",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 6,
  },
  subheading: { color: "#82998D", fontSize: 14, marginTop: 7 },
  settings: {
    alignItems: "center",
    backgroundColor: "#14211D",
    borderColor: "#294238",
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  statCard: {
    alignItems: "center",
    backgroundColor: "#5DE1B5",
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 18,
    marginTop: 25,
    padding: 20,
  },
  statKicker: {
    color: "#1C4B3B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  statValue: {
    color: "#0B1210",
    fontSize: 35,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    marginTop: 2,
  },
  statLabel: {
    color: "#1C4B3B",
    fontSize: 13,
    fontWeight: "700",
    marginTop: -2,
  },
  statIcon: {
    alignItems: "center",
    backgroundColor: "rgba(11,18,16,0.12)",
    borderRadius: 23,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  actions: { gap: 10, marginHorizontal: 18, marginTop: 12 },
  actionCard: {
    alignItems: "center",
    backgroundColor: "#14211D",
    borderColor: "#20372E",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: 12,
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 34,
    justifyContent: "center",
    marginRight: 11,
    width: 34,
  },
  actionIconGreen: { backgroundColor: "#5DE1B5" },
  actionIconSlate: { backgroundColor: "#294238" },
  actionText: { color: "#ECF8F2", flex: 1, fontSize: 14, fontWeight: "800" },
  sectionHeading: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    marginTop: 30,
    paddingHorizontal: 18,
  },
  sectionTitle: { color: "#ECF8F2", fontSize: 20, fontWeight: "900" },
  sectionSubtitle: { color: "#71887C", fontSize: 12, marginTop: 3 },
  link: { color: "#5DE1B5", fontSize: 14, fontWeight: "800", paddingBottom: 2 },
  loader: { marginTop: 28 },
  errorCard: {
    backgroundColor: "#3A1C25",
    borderColor: "#70333F",
    borderRadius: 15,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 14,
  },
  errorText: { color: "#FFB4BE", fontSize: 14, lineHeight: 20 },
  retry: { color: "#ECF8F2", fontSize: 14, fontWeight: "800", marginTop: 8 },
  empty: {
    alignItems: "center",
    backgroundColor: "#14211D",
    borderColor: "#20372E",
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 24,
  },
  emptyTitle: {
    color: "#ECF8F2",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  emptyCopy: {
    color: "#A3B5AC",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
