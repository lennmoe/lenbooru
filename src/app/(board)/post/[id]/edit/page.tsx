import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPost, postTagCounts } from "@/lib/db";
import { splitTagFields } from "@/lib/tags";
import { currentRole } from "@/lib/session";
import { canEdit } from "@/lib/perms";
import EditClient from "@/components/EditClient";
import { getT } from "@/lib/i18n/server";

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
  const t = await getT();

  return (
    <main>
      <Link href={`/post/${postId}`} className="back-link">
        {t.post.backToPost(postId)}
      </Link>
      <EditClient
        id={post.id}
        // parodies / characters go to their own fields, artists stay prefixed ("artist:x")
        tags={splitTagFields(postTagCounts(post.id))}
        rating={post.rating}
        source={post.source}
        type={post.type}
      />
    </main>
  );
}
