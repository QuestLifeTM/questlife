import * as Linking from "expo-linking";

export const LEGAL_URLS = {
  terms: "https://myquestlife.app/terms",
  privacy: "https://myquestlife.app/privacy",
} as const;

export function openLegalPage(page: keyof typeof LEGAL_URLS) {
  return Linking.openURL(LEGAL_URLS[page]);
}
