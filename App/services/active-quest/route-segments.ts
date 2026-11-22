import { simplifyRouteForRendering } from "@/services/active-quest/route-filter";
import { ActiveQuestRenderableSegment, ActiveQuestRoutePoint, ActiveQuestRouteSegment } from "@/types/active-quest";
import { energyCount } from "@/services/active-quest/energy-diagnostics";

const cached = new WeakMap<ActiveQuestRouteSegment, { first?: ActiveQuestRoutePoint; last?: ActiveQuestRoutePoint; count: number; value: ActiveQuestRenderableSegment }>();

export function buildRenderableSegments(segments: ActiveQuestRouteSegment[], route: ActiveQuestRoutePoint[]): ActiveQuestRenderableSegment[] {
  const pointById = new Map(route.map((point) => [point.id, point]));
  return segments.map(segment => {
    const points = segment.pointIds.map(id => pointById.get(id)).filter((point): point is ActiveQuestRoutePoint => Boolean(point));
    const previous = cached.get(segment);
    if (previous && previous.first === points[0] && previous.last === points.at(-1) && previous.count === points.length) return previous.value;
    energyCount("route.segmentRebuilds");
    const value = { id: segment.id, state: segment.state, points: simplifyRouteForRendering(points) };
    cached.set(segment, { first: points[0], last: points.at(-1), count: points.length, value });
    return value;
  }).filter(segment => segment.points.length > 0);
}
