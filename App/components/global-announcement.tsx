import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";

import { T } from "@/components/theme";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppAnnouncement,
  dismissAppAnnouncement,
  getActiveAppAnnouncement,
  subscribeToAppAnnouncements,
} from "@/services/announcements/announcementService";
import { supabase } from "@/lib/supabase";

export function GlobalAnnouncement() {
  const { isConfigured, session } = useAuth();
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isConfigured || !session) {
      setAnnouncement(null);
      return;
    }

    getActiveAppAnnouncement()
      .then((nextAnnouncement) => {
        if (active) setAnnouncement(nextAnnouncement);
      })
      .catch(() => {
        // A failed announcement fetch should never interrupt the app itself.
      });

    const channel = subscribeToAppAnnouncements((nextAnnouncement) => {
      if (active) {
        setError(null);
        setAnnouncement(nextAnnouncement);
      }
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isConfigured, session?.user.id]);

  async function dismiss() {
    if (!announcement || dismissing) return;
    setDismissing(true);
    setError(null);
    try {
      await dismissAppAnnouncement(announcement.id);
      setAnnouncement(null);
    } catch {
      setError("Could not dismiss this announcement. Please try again.");
    } finally {
      setDismissing(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={dismiss} transparent visible={Boolean(announcement)}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(5, 10, 18, 0.62)" }}>
        <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "rgba(77,168,255,0.38)", backgroundColor: T.white, padding: 24, gap: 16, shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf4ff" }}>
            <Text style={{ fontSize: 20 }}>✦</Text>
          </View>
          <View style={{ gap: 7 }}>
            <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>{announcement?.title}</Text>
            <Text style={{ color: T.muted, fontSize: 16, fontWeight: "600", lineHeight: 23 }}>{announcement?.body}</Text>
          </View>
          {error ? <Text style={{ color: "#dc2626", fontWeight: "800" }}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss announcement" disabled={dismissing} onPress={dismiss} style={({ pressed }) => ({ minHeight: 50, borderRadius: 25, backgroundColor: T.blue, alignItems: "center", justifyContent: "center", opacity: dismissing ? 0.7 : pressed ? 0.88 : 1 })}>
            {dismissing ? <ActivityIndicator color={T.white} /> : <Text style={{ color: T.white, fontSize: 16, fontWeight: "900" }}>Got it</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
