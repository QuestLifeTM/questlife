import React, { Component, ReactNode } from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import Svg, { Circle as SvgCircle, Polyline as SvgPolyline } from "react-native-svg";

type Coordinate = { latitude: number; longitude: number };
type Region = Coordinate & { latitudeDelta?: number; longitudeDelta?: number };
type Padding = { top: number; bottom: number; left: number; right: number };
type LayerProps = { coordinate?: Coordinate; center?: Coordinate; radius?: number; fillColor?: string; coordinates?: Coordinate[]; strokeColor?: string; strokeWidth?: number; children?: ReactNode; [key: string]: unknown };
export function Marker(_props: LayerProps) { return null; }
export function Polyline(_props: LayerProps) { return null; }
export function Circle(_props: LayerProps) { return null; }
type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; initialRegion?: Region; pointerEvents?: "none" | "auto"; mapPadding?: Padding; onMapReady?: () => void; onPanDrag?: () => void; [key: string]: unknown };
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
const project = (point: Coordinate, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const lat = clamp(point.latitude, -85.0511, 85.0511) * Math.PI / 180;
  return { x: (point.longitude + 180) / 360 * scale, y: (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * scale };
};
const unproject = (x: number, y: number, zoom: number): Coordinate => {
  const scale = 256 * 2 ** zoom;
  return { longitude: ((x / scale * 360 + 180) % 360 + 360) % 360 - 180, latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI };
};

/** Browser Mercator map. Loads only visible tiles; recording is independent of tiles. */
export default class RouteMap extends Component<Props, { center: Coordinate; zoom: number; width: number; height: number; tileError: boolean }> {
  state = { center: this.props.initialRegion ?? { latitude: 0, longitude: 0 }, zoom: 16, width: 390, height: 500, tileError: false };
  private laidOut = false;
  private drag: { x: number; y: number; center: Coordinate } | null = null;
  animateToRegion(region: Region, _duration?: number) {
    const zoom = region.longitudeDelta ? clamp(Math.round(Math.log2(this.state.width * 360 / (256 * region.longitudeDelta))), 2, 19) : this.state.zoom;
    this.setState({ center: region, zoom });
  }
  animateCamera(camera: { center?: Coordinate; zoom?: number }, _options?: unknown) {
    this.setState({ center: camera.center ?? this.state.center, zoom: camera.zoom ?? this.state.zoom });
  }
  fitToCoordinates(points: Coordinate[], options?: { edgePadding?: Padding; animated?: boolean }) {
    if (!points.length) return;
    const p = options?.edgePadding ?? { top: 30, bottom: 30, left: 30, right: 30 };
    const projected = points.map(point => project(point, 0));
    const xs = projected.map(point => point.x), ys = projected.map(point => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.max(50, this.state.width - p.left - p.right), height = Math.max(50, this.state.height - p.top - p.bottom);
    const zoom = clamp(Math.floor(Math.log2(Math.min(width / Math.max(0.001, maxX - minX), height / Math.max(0.001, maxY - minY)))), 2, 18);
    this.setState({ center: unproject((minX + maxX) / 2, (minY + maxY) / 2, 0), zoom });
  }
  private zoomBy = (amount: number) => {
    this.props.onPanDrag?.();
    this.setState(({ zoom }) => ({ zoom: clamp(zoom + amount, 2, 19) }));
  };
  render() {
    const { center, zoom, width, height } = this.state;
    const middle = project(center, zoom);
    const padding = this.props.mapPadding;
    const offsetY = padding ? (padding.top - padding.bottom) / 2 : 0;
    const left = middle.x - width / 2, top = middle.y - height / 2 - offsetY;
    const count = 2 ** zoom;
    const layers = React.Children.toArray(this.props.children).filter(React.isValidElement) as React.ReactElement<LayerProps>[];
    const pixels = (point: Coordinate) => { const p = project(point, zoom); let dx = p.x - middle.x; const world = 256 * count; if (dx > world / 2) dx -= world; if (dx < -world / 2) dx += world; return { x: dx + width / 2, y: p.y - top }; };
    const template = process.env.EXPO_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    const tiles: ReactNode[] = [];
    for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) {
      for (let y = Math.max(0, Math.floor(top / 256)); y <= Math.min(count - 1, Math.floor((top + height) / 256)); y++) {
        const url = template.replace("{z}", String(zoom)).replace("{x}", String((x % count + count) % count)).replace("{y}", String(y));
        tiles.push(<img key={`${zoom}/${x}/${y}`} src={url} alt="" draggable={false} referrerPolicy="strict-origin-when-cross-origin" onError={() => { if (!this.state.tileError) this.setState({ tileError: true }); }} style={{ position: "absolute", left: x * 256 - left, top: y * 256 - top, width: 256, height: 256, pointerEvents: "none" }} />);
      }
    }
    return <View style={[{ backgroundColor: "#e7ece5", overflow: "hidden" }, this.props.style]} onLayout={({ nativeEvent: { layout } }) => {
      if (layout.width === this.state.width && layout.height === this.state.height && this.laidOut) return;
      this.setState({ width: layout.width, height: layout.height }, () => {
        if (!this.laidOut) { this.laidOut = true; if (this.props.initialRegion) this.animateToRegion(this.props.initialRegion); this.props.onMapReady?.(); }
      });
    }}>
      <div role="region" aria-label="Quest route map. Use arrow keys to pan and plus or minus to zoom." tabIndex={this.props.pointerEvents === "none" ? -1 : 0} style={{ position: "absolute", inset: 0, overflow: "hidden", touchAction: "none", pointerEvents: this.props.pointerEvents === "none" ? "none" : "auto" }}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); this.drag = { x: event.clientX, y: event.clientY, center }; }}
        onPointerMove={event => { if (!this.drag) return; this.props.onPanDrag?.(); const start = project(this.drag.center, zoom); this.setState({ center: unproject(start.x - event.clientX + this.drag.x, start.y - event.clientY + this.drag.y, zoom) }); }}
        onPointerUp={() => { this.drag = null; }} onPointerCancel={() => { this.drag = null; }}
        onKeyDown={event => {
          if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); this.zoomBy(event.key === "-" ? -1 : 1); }
          const delta = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[event.key];
          if (delta) { event.preventDefault(); this.props.onPanDrag?.(); this.setState({ center: unproject(middle.x + delta[0], middle.y + delta[1], zoom) }); }
        }}>
        {tiles}
        <Svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {layers.map(({ props }, index) => {
            if (props.coordinates) return <SvgPolyline key={index} points={props.coordinates.map(point => { const p = pixels(point); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke={props.strokeColor ?? "#247acb"} strokeWidth={props.strokeWidth ?? 5} strokeLinecap="round" strokeLinejoin="round" />;
            const coordinate = props.coordinate ?? props.center;
            if (!coordinate) return null;
            const p = pixels(coordinate);
            const radius = props.radius ? props.radius / (156543.034 * Math.cos(center.latitude * Math.PI / 180) / 2 ** zoom) : 7;
            return <SvgCircle key={index} cx={p.x} cy={p.y} r={radius} fill={props.fillColor ?? "#247acb"} stroke={props.strokeColor ?? "white"} strokeWidth={props.strokeWidth ?? 2} />;
          })}
        </Svg>
      </div>
      {this.props.pointerEvents !== "none" ? <div style={{ position: "absolute", right: 12, top: 104, display: "flex", flexDirection: "column" }}>
        {[1, -1].map(delta => <button key={delta} aria-label={delta > 0 ? "Zoom in" : "Zoom out"} onClick={() => this.zoomBy(delta)} style={{ width: 44, height: 44, fontSize: 22, background: "white", color: "#24322a", border: "1px solid #aebbb3" }}>{delta > 0 ? "+" : "−"}</button>)}
      </div> : null}
      <div style={{ position: "absolute", right: 0, bottom: padding?.bottom ?? 0, fontSize: 11, padding: "3px 6px", background: "#fffffff0", color: "#24322a" }}>
        {this.state.tileError ? "Map unavailable · route still recording. " : ""}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      </div>
    </View>;
  }
}
