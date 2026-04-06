import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { redirect } from "next/navigation";

export default async function CanvasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getAuthenticatedProfile();
  if (!user) redirect("/login");

  return (
    <div className="h-screen w-screen overflow-hidden">
      {children}
    </div>
  );
}
