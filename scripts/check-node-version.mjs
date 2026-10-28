const supportedMajors = new Set([22, 24, 26]);
const currentMajor = Number.parseInt(process.versions.node.split(".")[0], 10);

if (!supportedMajors.has(currentMajor)) {
  console.error(
    [
      `Unsupported Node.js version: ${process.version}.`,
      "QuestLife's Expo/Metro toolchain supports Node 22, 24, or 26 (not odd-numbered releases).",
      "Run `nvm use` from the repository root (the checked-in .nvmrc selects Node 24), then start the app again.",
    ].join("\n"),
  );
  process.exit(1);
}
