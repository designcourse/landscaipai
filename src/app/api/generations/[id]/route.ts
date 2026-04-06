import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_GENERATIONS } from "@/lib/utils/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Fetch generation status by id
  return NextResponse.json({ id, status: "not implemented" });
}

/**
 * Recursively collect all descendant generation IDs + storage paths
 * (generations that used this one as parent_generation_id).
 */
async function collectDescendants(
  admin: ReturnType<typeof createAdminClient>,
  genId: string,
  userId: string
): Promise<{ id: string; storage_path: string }[]> {
  const results: { id: string; storage_path: string }[] = [];
  const queue = [genId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const { data: children } = await admin
      .from("generations")
      .select("id, storage_path")
      .eq("parent_generation_id", parentId)
      .eq("user_id", userId);

    for (const child of children ?? []) {
      results.push(child);
      queue.push(child.id);
    }
  }

  return results;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Verify ownership + get storage path
    const { data: generation } = await admin
      .from("generations")
      .select("id, storage_path, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // 3. Collect all descendant generations (children, grandchildren, etc.)
    const descendants = await collectDescendants(admin, id, user.id);

    // All IDs to delete (descendants first, then self — reverse for FK safety)
    const allIds = [...descendants.map((d) => d.id), id];
    const allPaths = [
      ...descendants.map((d) => d.storage_path).filter(Boolean),
      generation.storage_path,
    ].filter(Boolean);

    // 4. Nullify credit_transaction references
    await admin
      .from("credit_transactions")
      .update({ generation_id: null })
      .in("generation_id", allIds);

    // 5. Delete generation records — descendants first, then self
    if (descendants.length > 0) {
      // Delete in reverse order (deepest children first)
      const descendantIds = descendants.map((d) => d.id).reverse();
      await admin.from("generations").delete().in("id", descendantIds);
    }
    await admin.from("generations").delete().eq("id", id);

    // 6. Delete storage files (best-effort)
    if (allPaths.length > 0) {
      await admin.storage.from(BUCKET_GENERATIONS).remove(allPaths).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      deletedCount: allIds.length,
    });
  } catch (err) {
    console.error("Generation delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete generation" },
      { status: 500 }
    );
  }
}
