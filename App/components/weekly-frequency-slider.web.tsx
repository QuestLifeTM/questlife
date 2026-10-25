import { T } from "@/components/theme";

export function WeeklyFrequencySlider({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return <div style={{ width: "100%", color: T.dark, fontFamily: "Rubik, sans-serif" }}>
    <label htmlFor="quest-frequency" style={{ display: "block", textAlign: "center", fontSize: 19, marginBottom: 32 }}>Every <strong style={{ color: T.blue, fontSize: 36 }}>{value}</strong> {value === 1 ? "day" : "days"} a week</label>
    <input id="quest-frequency" type="range" min={1} max={7} step={1} value={value} aria-label="Days per week you try something completely new" aria-valuetext={`${value} days per week`} onChange={(event) => onChange(Number(event.target.value))} style={{ display: "block", width: "100%", height: 44, accentColor: T.blue, cursor: "pointer" }} />
    <div style={{ display: "flex", justifyContent: "space-between", color: T.muted, fontSize: 12, marginTop: 8 }}><span>1 day</span><span>7 days</span></div>
  </div>;
}
