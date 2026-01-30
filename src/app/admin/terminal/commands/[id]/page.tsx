// src/app/admin/terminal/commands/[id]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import CommandEditor from "@/app/admin/terminal/commands/[id]/CommandEditor";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { Card } from "@/components/ui/card";
import { BackButton } from "@/components/blog/BackButton";

export const metadata = { title: "Edit Command" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!id) notFound();

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <BackButton fallbackHref="/admin/terminal/commands" />
            <h1 className="text-3xl text-center font-bold flex-1">Edit Command</h1>
            {/* spacer to keep title centered */}
            <div className="w-[88px]" />
          </div>

          <Card className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <CommandEditor id={id} />
          </Card>
        </div>
      </div>
    </main>
  );
}
