import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_UPLOADS, BUCKET_THUMBNAILS, BUCKET_GENERATIONS } from "@/lib/utils/storage";

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
    const { data: image } = await admin
      .from("images")
      .select("id, storage_path, thumbnail_path, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // 3. Get all generations for this image
    const { data: generations } = await admin
      .from("generations")
      .select("id, storage_path")
      .eq("image_id", id)
      .eq("user_id", user.id);

    const genIds = (generations ?? []).map((g) => g.id);
    const genPaths = (generations ?? []).map((g) => g.storage_path).filter(Boolean);

    // 4. Nullify credit_transaction references (audit trail preserved, FK cleared)
    if (genIds.length > 0) {
      await admin
        .from("credit_transactions")
        .update({ generation_id: null })
        .in("generation_id", genIds);
    }

    // 5. Delete generation records (children before parents to respect FK)
    // Sort by depth: delete generations with parent_generation_id first
    if (genIds.length > 0) {
      // Delete in batches — children first (those with parent_generation_id set)
      await admin
        .from("generations")
        .delete()
        .in("id", genIds)
        .not("parent_generation_id", "is", null);

      await admin
        .from("generations")
        .delete()
        .in("id", genIds);
    }

    // 6. Delete image record
    await admin.from("images").delete().eq("id", id).eq("user_id", user.id);

    // 7. Delete storage files (non-blocking — best-effort cleanup)
    const storageOps: Promise<unknown>[] = [];

    if (image.storage_path) {
      storageOps.push(admin.storage.from(BUCKET_UPLOADS).remove([image.storage_path]));
    }
    if (image.thumbnail_path) {
      storageOps.push(admin.storage.from(BUCKET_THUMBNAILS).remove([image.thumbnail_path]));
    }
    if (genPaths.length > 0) {
      storageOps.push(admin.storage.from(BUCKET_GENERATIONS).remove(genPaths));
    }

    await Promise.allSettled(storageOps);

    return NextResponse.json({ success: true, deletedGenerations: genIds.length });
  } catch (err) {
    console.error("Image delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
