import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getDoujinPages, adjacentPosts, postTagCounts } from "@/lib/db";
import { currentRole } from "@/lib/session";
import { canDelete, canEdit } from "@/lib/perms";
import DeleteButton from "@/components/DeleteButton";
import PostView from "@/components/PostView";
import CopyShareLink from "@/components/CopyShareLink";
import { sharePath } from "@/lib/share";
import { siteOrigin } from "@/lib/origin";
import { getT } from "@/lib/i18n/server";
import { formatBytes, type Dict } from "@/lib/i18n/dict";
import { Download, TagIcon, UserIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

function fmtFormat(ext: string) {
  const e = ext.toLowerCase();
  return e === "jpg" || e === "jpeg" || e === "jfif" ? "JPEG" : e.toUpperCase();
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

function timeAgo(t: Dict, ts: number) {
  const secs = (Date.now() - ts) / 1000;
  const rtf = new Intl.RelativeTimeFormat(t.locale, { numeric: "auto" });
  for (const [unit, s] of UNITS) {
    if (secs >= s) return rtf.format(-Math.floor(secs / s), unit);
  }
  return t.post.justNow;
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

  const role = await currentRole();
  const t = await getT();
  const { newer, older } = adjacentPosts(post);
  const tags = postTagCounts(postId);
  const pages = post.type === "doujin" ? getDoujinPages(postId) : [];
  const isDoujin = post.type === "doujin";
  const src =
    post.type === "video"
      ? `/media/video/${post.id}.${post.ext}`
      : `/media/image/${post.id}.${post.ext}`;
  const shareUrl =
    (await siteOrigin()) +
    sharePath(post, pages[0] ? pages[0].file.slice(pages[0].file.lastIndexOf(".")) : undefined);

  const info = (
    <div className="post-info">
      {post.title && <h1>{post.title}</h1>}
      <div>
        {isDoujin ? (
          <>
            {t.post.doujinInfo(formatBytes(t, post.size), post.page_count)}
          </>
        ) : (
          <>
            <a href={src} download={`${post.title || post.id}.${post.ext}`} className="dl">
              <Download />
              {formatBytes(t, post.size)} {fmtFormat(post.ext)}
            </a>
            {post.width && post.height && (
              <>
                {" "}
                ({post.width}×{post.height})
              </>
            )}
          </>
        )}
      </div>
      <div title={new Date(post.created_at).toLocaleString(t.locale)}>
        <UserIcon />
        {post.uploader ? <strong>{post.uploader}</strong> : t.post.unknownUploader}, {timeAgo(t, post.created_at)}
      </div>
      <CopyShareLink url={shareUrl} />
    </div>
  );

  const sidebar = (
    <>
      <h2 className="post-tags-title">{t.post.tags(tags.length)}</h2>
      {tags.length > 0 ? (
        <ul className="post-tags">
          {tags.map((tag) => (
            <li key={tag.name}>
              <Link href={`/?tags=${encodeURIComponent(tag.name)}`}>
                <TagIcon />
                {tag.name}
              </Link>
              <span className="count">{tag.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="post-empty">{t.post.noTags}</p>
      )}

      {canDelete(role) && (
        <div className="action-row">
          <DeleteButton id={post.id} />
        </div>
      )}
    </>
  );

  const media = isDoujin ? (
    <div className="doujin-stage">
      <Link href={`/doujin/${post.id}/read`} className="doujin-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/media/thumb/${post.id}.webp`} alt={post.title} />
      </Link>
      <div>
        <Link href={`/doujin/${post.id}/read`} className="btn btn-accent">
          {t.post.read(pages.length)}
        </Link>
      </div>
      <div className="cover-row">
        {pages.map((pg) => (
          <Link key={pg.page_no} href={`/doujin/${post.id}/read#p${pg.page_no}`}>
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
  ) : post.type === "video" ? (
    <video src={src} controls autoPlay loop playsInline />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={post.title} width={post.width ?? undefined} height={post.height ?? undefined} />
  );

  return (
    <main>
      <PostView
        newer={newer}
        older={older}
        editHref={canEdit(role) ? `/post/${post.id}/edit` : null}
        zoomable={!isDoujin}
        info={info}
        sidebar={sidebar}
        media={media}
      />
    </main>
  );
}
