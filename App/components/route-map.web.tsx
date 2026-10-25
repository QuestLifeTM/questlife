import React, { Component, ReactNode } from "react";
import { Linking, Pressable, Text, View, StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Polyline as SvgPolyline } from "react-native-svg";
import { T } from "@/components/theme";

type Coordinate = { latitude: number; longitude: number };
type LayerProps = { coordinate?: Coordinate; coordinates?: Coordinate[]; strokeColor?: string; strokeWidth?: number; children?: ReactNode; [key: string]: unknown };
export function Marker(_props: LayerProps) { return null; }
export function Polyline(_props: LayerProps) { return null; }
type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; initialRegion?: Coordinate; [key: string]: unknown };
export default class RouteMap extends Component<Props> {
  animateToRegion(_region: unknown, _duration?: number) { /* Route preview automatically fits its points. */ }
  render() {
    const layers = React.Children.toArray(this.props.children).filter(React.isValidElement) as React.ReactElement<LayerProps>[];
    const points = layers.flatMap(({ props }) => props.coordinates ?? (props.coordinate ? [props.coordinate] : []));
    const latitude = points.map((p) => p.latitude), longitude = points.map((p) => p.longitude);
    const minLat = Math.min(...latitude), maxLat = Math.max(...latitude), minLng = Math.min(...longitude), maxLng = Math.max(...longitude);
    const project = (point: Coordinate) => [30 + (point.longitude - minLng) / (maxLng - minLng || 1) * 440, 250 - (point.latitude - minLat) / (maxLat - minLat || 1) * 220];
    const current = points.at(-1) ?? this.props.initialRegion;
    return <View style={[{ backgroundColor: T.bg, justifyContent: "center", alignItems: "center", gap: 12 }, this.props.style]}>
      {points.length ? <Svg viewBox="0 0 500 280" width="100%" height="65%" accessibilityLabel="Recorded quest route">
        {layers.map(({ props }, index) => props.coordinates ? <SvgPolyline key={index} points={props.coordinates.map((point) => project(point).join(",")).join(" ")} fill="none" stroke={props.strokeColor ?? T.blue} strokeWidth={props.strokeWidth ?? 4} /> : props.coordinate ? <Circle key={index} cx={project(props.coordinate)[0]} cy={project(props.coordinate)[1]} r={6} fill={T.blue} /> : null)}
      </Svg> : <Text style={{ color: T.muted, fontFamily: "Rubik", padding: 24 }}>Your route will appear as location points are recorded.</Text>}
      <Text style={{ color: T.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 24 }}>Route preview · Keep this tab open while recording.</Text>
      {current ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.openstreetmap.org/?mlat=${current.latitude}&mlon=${current.longitude}#map=16/${current.latitude}/${current.longitude}`)} style={{ padding: 12 }}><Text style={{ color: T.blue, fontFamily: "RubikBold" }}>Open location in map ↗</Text></Pressable> : null}
    </View>;
  }
}
