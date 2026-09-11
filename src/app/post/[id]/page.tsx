import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getDoujinPages } from "@/lib/db";
import { currentRole } from "@/lib/session";
import { canDelete, canEdit } from "@/lib/perms";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

function fmtBytes(n: number) {
  if (!n) return "?";
  const u = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = getPost(postId);
  if (!post) notFound();

  const pages = post.type === "doujin" ? getDoujinPages(postId) : [];
  const created = new Date(post.created_at).toLocaleString("fr-FR");
  const role = await currentRole();

  return (
    <main>
      <Link href="/" className="back-link">
        ← Galerie
      </Link>

      <div className="post-wrap">
        <div>
          {post.type === "image" && (
            <div className="post-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/media/image/${post.id}.${post.ext}`}
                alt={post.title}
              />
            </div>
          )}

          {post.type === "video" && (
            <div className="post-media">
              <video
                src={`/media/video/${post.id}.${post.ext}`}
                controls
                autoPlay
                loop
                playsInline
              />
            </div>
          )}

          {post.type === "doujin" && (
            <div>
              <Link href={`/doujin/${post.id}/read`} className="post-media" style={{ display: "block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/media/thumb/${post.id}.webp`}
                  alt={post.title}
                  style={{ maxHeight: "60vh" }}
                />
              </Link>
              <div style={{ margin: "12px 0" }}>
                <Link href={`/doujin/${post.id}/read`} className="btn btn-accent">
                  📖 Lire ({pages.length} pages)
                </Link>
              </div>
              <div className="cover-row">
                {pages.map((pg) => (
                  <Link
                    key={pg.page_no}
                    href={`/doujin/${post.id}/read#p${pg.page_no}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/media/doujin/${post.id}/${pg.file}`}
                      alt={`page ${pg.page_no}`}
                      loading="lazy"
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="side">
          <h1>{post.title || `#${post.id}`}</h1>
          <div className="meta">
            Type&nbsp;: {post.type}
            <br />
            {post.width && post.height && (
              <>
                Dimensions&nbsp;: {post.width}×{post.height}
                <br />
              </>
            )}
            {post.type === "doujin" && (
              <>
                Pages&nbsp;: {post.page_count}
                <br />
              </>
            )}
            Taille&nbsp;: {fmtBytes(post.size)}
            <br />
            Ajouté&nbsp;: {created}
          </div>

          {post.tags.length > 0 ? (
            <div className="tag-list">
              {post.tags.map((t) => (
                <Link key={t} href={`/?tags=${encodeURIComponent(t)}`} className="tag">
                  {t}
                </Link>
              ))}
            </div>
          ) : (
            <p className="meta">Aucun tag</p>
          )}

          {(canEdit(role) || canDelete(role)) && (
            <div className="action-row">
              {canEdit(role) && (
                <Link href={`/post/${post.id}/edit`} className="btn">
                  ✏️ Éditer
                </Link>
              )}
              {canDelete(role) && <DeleteButton id={post.id} />}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
