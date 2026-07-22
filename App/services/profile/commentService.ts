import { supabase } from "@/lib/supabase";

export type QuestPostComment = { id: string; parentId: string | null; body: string; createdAt: string; userId: string; displayName: string; username: string | null; emoji: string; avatarColor: string; avatarUrl: string | null };

export async function fetchQuestPostComments(postId: string) {
  const { data, error } = await supabase.rpc("get_quest_post_comments", { p_post_id: postId });
  if (error) throw error;
  return (data ?? []) as QuestPostComment[];
}

export async function addQuestPostComment(postId: string, body: string, parentId: string | null = null) {
  const { error } = await supabase.rpc("add_quest_post_comment", { p_post_id: postId, p_body: body, p_parent_id: parentId });
  if (error) throw error;
}
