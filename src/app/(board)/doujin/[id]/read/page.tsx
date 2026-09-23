import { notFound } from "next/navigation";
import { getPost, getDoujinPages } from "@/lib/db";
import Reader from "@/components/Reader";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = getPost(postId);
  if (!post || post.type !== "doujin") notFound();

  const pages = getDoujinPages(postId);
  if (!pages.length) notFound();

  return (
    <Reader postId={postId} title={`#${postId}`} pages={pages} />
  );
}
