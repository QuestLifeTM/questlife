import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

export function configurePushPresentation() {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
}

export async function registerPushDevice(requestPermission = false) {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("questlife", { name: "QuestLife", importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await supabase.rpc("register_notification_device", { p_token: token, p_platform: Platform.OS, p_permission_status: "granted", p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC" });
  return token;
}

export async function requestPushPermission() {
  return registerPushDevice(true);
}

export async function unregisterPushDevice(token: string | null) {
  if (token) await supabase.rpc("unregister_notification_device", { p_token: token });
}
