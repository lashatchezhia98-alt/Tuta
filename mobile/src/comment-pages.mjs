export const COMMENT_PAGE_SIZE = 50;
const baseFields =
  "id,post_id,public_author_id,is_anonymous,parent_comment_id,display_name,body,created_at";
/** @param {{id:string,created_at:string}|null} before */
export async function loadCommentPage(client, postId, before = null, legacy = false) {
  const fields = legacy ? baseFields : baseFields + ",author_initials,is_post_author";
  let query = client
    .from("community_comments")
    .select(fields)
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(COMMENT_PAGE_SIZE + 1);
  if (before) {
    if (
      !/^[0-9a-f-]{36}$/.test(before.id) ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(
        before.created_at,
      ) ||
      !Number.isFinite(Date.parse(before.created_at))
    )
      throw Error("Invalid comment cursor");
    const time = before.created_at; // Preserve Postgres microseconds at the pagination boundary.
    query = query.or(
      `created_at.lt.${time},and(created_at.eq.${time},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query;
  if (error?.code === "42703" && !legacy) return loadCommentPage(client, postId, before, true);
  if (error) throw error;
  const page = (data || []).slice(0, COMMENT_PAGE_SIZE);
  const parentIds = [
    ...new Set(
      page
        .map((row) => row.parent_comment_id)
        .filter((id) => id && !page.some((row) => row.id === id)),
    ),
  ];
  let parents = [];
  if (parentIds.length) {
    const response = await client
      .from("community_comments")
      .select(fields)
      .eq("post_id", postId)
      .in("id", parentIds);
    if (response.error) throw response.error;
    parents = response.data || [];
  }
  return {
    comments: page.slice().reverse(),
    parents,
    hasMore: (data || []).length > COMMENT_PAGE_SIZE,
    before: page.at(-1) || null,
  };
}
export function mergeComments(current, page) {
  return [
    ...new Map([...current, ...page].map((row) => [row.id, row])).values(),
  ].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
