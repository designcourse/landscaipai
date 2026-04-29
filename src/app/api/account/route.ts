import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUCKET_UPLOADS,
  BUCKET_THUMBNAILS,
  BUCKET_GENERATIONS,
  BUCKET_VIDEOS,
  BUCKET_FINALIZED_VIDEOS,
  BUCKET_COMPANY_LOGOS,
} from "@/lib/utils/storage";

const USER_BUCKETS = [
  BUCKET_UPLOADS,
  BUCKET_THUMBNAILS,
  BUCKET_GENERATIONS,
  BUCKET_VIDEOS,
  BUCKET_FINALIZED_VIDEOS,
  BUCKET_COMPANY_LOGOS,
];

async function removeUserFilesInBucket(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  userId: string
) {
  const paths: string[] = [];

  const { data: topLevel } = await admin.storage.from(bucket).list(userId, {
    limit: 1000,
  });
  if (!topLevel) return;

  for (const entry of topLevel) {
    if (!entry.name) continue;
    if (entry.id === null) {
      // Folder — list one level deeper
      const subPath = `${userId}/${entry.name}`;
      const { data: nested } = await admin.storage.from(bucket).list(subPath, {
        limit: 1000,
      });
      nested?.forEach((f) => {
        if (f.name) paths.push(`${subPath}/${f.name}`);
      });
    } else {
      paths.push(`${userId}/${entry.name}`);
    }
  }

  if (paths.length > 0) {
    await admin.storage.from(bucket).remove(paths);
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    await Promise.all(
      USER_BUCKETS.map((bucket) =>
        removeUserFilesInBucket(admin, bucket, user.id).catch(() => {})
      )
    );

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
