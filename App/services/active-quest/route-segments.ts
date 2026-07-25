import { simplifyRouteForRendering } from "@/services/active-quest/route-filter";
import { ActiveQuestRenderableSegment, ActiveQuestRoutePoint, ActiveQuestRouteSegment } from "@/types/active-quest";

export function buildRenderableSegments(segments: ActiveQuestRouteSegment[], route: ActiveQuestRoutePoint[]): ActiveQuestRenderableSegment[] {
  const pointById = new Map(route.map((point) => [point.id, point]));
  return segments.map((segment) => ({ id: segment.id, state: segment.state, points: simplifyRouteForRendering(segment.pointIds.map((id) => pointById.get(id)).filter((point): point is ActiveQuestRoutePoint => Boolean(point))) })).filter((segment) => segment.points.length > 0);
}
