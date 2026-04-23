import { redirect } from "next/navigation";

// The intermediate project detail page has been removed. Clicking a project
// card now takes users directly to the canvas editor at
// /generate?project={id}. This file preserves existing bookmarks by
// redirecting /project/{id} to the canvas editor.
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/generate?project=${id}`);
}
