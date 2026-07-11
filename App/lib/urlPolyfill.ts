import { Platform } from "react-native";
import { URL, URLSearchParams } from "react-native-url-polyfill";

function defineWritableGlobal(name: "URL" | "URLSearchParams", value: typeof URL | typeof URLSearchParams) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);

  if (!descriptor || descriptor.writable || descriptor.configurable) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
}

if (Platform.OS !== "web") {
  try {
    Object.defineProperty(globalThis, "REACT_NATIVE_URL_POLYFILL", {
      configurable: true,
      writable: true,
      value: "react-native-url-polyfill@3.0.0",
    });
    defineWritableGlobal("URL", URL);
    defineWritableGlobal("URLSearchParams", URLSearchParams);
  } catch {
    // Newer React Native runtimes can expose protected URL globals. In that case,
    // keep the native implementations instead of failing app registration.
  }
}
