import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Screen, SoftButton } from "@/components/ui";
import { T } from "@/components/theme";
import * as Files from "@/lib/device-files";

const uri = `${Files.cacheDirectory}responsive-qa/draft.json`;
export function StorageCheck() {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Loading saved draft…");
  useEffect(() => { void Files.readAsStringAsync(uri).then((value) => { setDraft(value); setStatus("Restored after refresh"); }).catch(() => setStatus("No local test draft")); }, []);
  const save = async () => {
    try { await Files.writeAsStringAsync(uri, draft); setStatus(await Files.readAsStringAsync(uri) === draft ? "Saved and verified in IndexedDB" : "Verification failed"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Storage unavailable"); }
  };
  return <Screen bottomOverlay="none"><Text accessibilityRole="header" style={{ color: T.dark, fontSize: 24 }}>Local persistence check</Text><TextInput accessibilityLabel="Test draft" value={draft} onChangeText={setDraft} style={{ color: T.dark, padding: 16, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, borderRadius: 12 }} /><SoftButton label="Save test draft" onPress={() => void save()} /><Text accessibilityLiveRegion="polite" style={{ color: T.dark }}>{status}</Text></Screen>;
}
