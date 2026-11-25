// Start these cues after Modal.onShow, not when `visible` changes: iOS can
// spend the first 600–800ms presenting over the closing End Quest sheet.
export const completionCues = {
  enter: 720,
  compact: 1850,
  bannerGone: 2150,
  summary: 2480,
  actions: 2780,
  xp: 3110,
  time: 3910,
  photos: 4710,
  headerDelay: 390,
  headerDuration: 210,
  countDuration: 560,
  end: 6100,
} as const;

export function completionProgress(time: number, start: number, duration: number) {
  "worklet";
  return Math.max(0, Math.min(1, (time - start) / duration));
}
