import type { JournalData } from "@/types/journal";
import type { ActiveQuestSnapshot } from "@/types/active-quest";
export type JournalAlbumProps = {
  data: JournalData | null;
  snapshot: ActiveQuestSnapshot | null;
  loading: boolean;
  error: string | null;
  refreshToken: number;
  contentWidth: number;
  horizontalPadding: number;
  bottomInset: number;
  onRefresh: () => void;
  onExplore: () => void;
  onOpen: (completionId?: string) => void;
  onScroll: (offset: number) => void;
};
