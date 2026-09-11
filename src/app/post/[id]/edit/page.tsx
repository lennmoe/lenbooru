import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPost } from "@/lib/db";
import { currentRole } from "@/lib/session";
import { canEdit } from "@/lib/perms";
import EditClient from "@/components/EditClient";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = parseInt(id, 10);

  if (!canEdit(await currentRole())) redirect(`/post/${postId}`);

  const post = getPost(postId);
  if (!post) notFound();

  return (
    <main>
      <Link href={`/post/${postId}`} className="back-link">
        ← Post #{postId}
      </Link>
      <EditClient
        id={post.id}
        title={post.title}
        tags={post.tags}
        type={post.type}
      />
    </main>
  );
}
