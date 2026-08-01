import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const environment = process.env.EXPO_PUBLIC_APP_ENV?.trim() || "development";

function removeSensitiveEventData(event: Sentry.ErrorEvent) {
  // Diagnostics must never contain account data, request payloads, app state,
  // screenshots, location, or user-entered content.
  event.user = undefined;
  event.request = undefined;
  event.breadcrumbs = undefined;
  event.extra = undefined;

  if (event.contexts) {
    const safeContexts = Object.fromEntries(
      ["app", "device", "os", "runtime"]
        .filter((key) => event.contexts?.[key])
        .map((key) => [key, event.contexts?.[key]]),
    );

    event.contexts = safeContexts;
  }

  return event;
}

export function initializeSentry(surface: "mobile" | "admin") {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    enableAutoSessionTracking: false,
    enableAutoPerformanceTracing: false,
    enableCaptureFailedRequests: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: removeSensitiveEventData,
  });

  Sentry.setTag("app_surface", surface);
}

export { Sentry };
