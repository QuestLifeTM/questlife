import { Redirect } from "expo-router";
import { Platform } from "react-native";

/** Local visual QA only. This route never grants a backend session. */
export default function PreviewRoute() {
  if (!__DEV__ || Platform.OS !== "web") return <Redirect href="/" />;
  const { WebPreview } = require("@/dev/web-preview") as typeof import("@/dev/web-preview");
  return <WebPreview />;
}
