import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getDoujinPages, adjacentPosts, postTagCounts } from "@/lib/db";
import { currentRole } from "@/lib/session";
import { canDelete, canEdit } from "@/lib/perms";
import DeleteButton from "@/components/DeleteButton";
import PostView from "@/components/PostView";
import CopyShareLink from "@/components/CopyShareLink";
import SampleImage from "@/components/SampleImage";
import { hasSample, samplePercent } from "@/lib/media";
import { sharePath } from "@/lib/share";
import { siteOrigin } from "@/lib/origin";
import { getT } from "@/lib/i18n/server";
import { formatBytes, type Dict } from "@/lib/i18n/dict";
import { Download, TagIcon } from "@/components/Icons";
import { TAG_CATEGORIES, displayTag } from "@/lib/tags";

export const dynamic = "force-dynamic";

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

  const dimensions = post.width && post.height ? ` (${post.width}×${post.height})` : "";
  const sourceIsUrl = /^https?:\/\//i.test(post.source);

  const info = (
    <>
      <li>
        {t.info.id}: {post.id}
      </li>
      <li>
        {t.info.uploader}: {post.uploader || t.post.unknownUploader}
      </li>
      <li>
        {t.info.date}:{" "}
        <time dateTime={new Date(post.created_at).toISOString()} title={new Date(post.created_at).toLocaleString(t.locale)}>
          {timeAgo(t, post.created_at)}
        </time>
      </li>
      <li>
        {t.info.size}:{" "}
        {isDoujin ? (
          formatBytes(t, post.size)
        ) : (
          <a href={src} download={`${post.id}.${post.ext}`}>
            {formatBytes(t, post.size)} .{post.ext}
          </a>
        )}
        {dimensions}
      </li>
      <li>
        {t.info.type}: {t.info.types[post.type]}
        {isDoujin && ` (${t.info.pages.toLowerCase()} : ${post.page_count})`}
      </li>
      <li className="post-source">
        {t.info.source}:{" "}
        {!post.source ? (
          <span className="dim">{t.info.none}</span>
        ) : sourceIsUrl ? (
          <a href={post.source} target="_blank" rel="noopener noreferrer nofollow">
            {post.source.replace(/^https?:\/\/(www\.)?/i, "")}
          </a>
        ) : (
          post.source
        )}
      </li>
      <li>
        {t.info.rating}:{" "}
        {post.rating ? (
          <span className={`rating-text rating-${post.rating}`}>{t.ratings[post.rating]}</span>
        ) : (
          <span className="dim">{t.info.unrated}</span>
        )}
      </li>
    </>
  );

  const tagGroups = (
    <>
      {tags.length === 0 && <p className="post-empty">{t.post.noTags}</p>}
      {/* grouped like Danbooru: Artist, Parody, Character, General */}
      {TAG_CATEGORIES.map((cat) => {
        const group = tags.filter((tag) => tag.category === cat);
        if (!group.length) return null;
        return (
          <section key={cat} className="post-tag-group">
            <h3>{t.tagCats[cat]}</h3>
            <ul className="post-tags">
              {group.map((tag) => (
                <li key={tag.name}>
                  <Link href={`/?tags=${encodeURIComponent(tag.name)}`} className={`tag-${cat}`}>
                    <TagIcon />
                    {displayTag(tag.name)}
                  </Link>
                  <span className="count">{tag.count}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );

  const options = (
    <>
      {!isDoujin && (
        <li>
          <a href={src} download={`${post.id}.${post.ext}`}>
            <Download />
            {t.info.download}
          </a>
        </li>
      )}
      <li>
        <CopyShareLink url={shareUrl} className="linklike" />
      </li>
    </>
  );

  const media = isDoujin ? (
    <div className="doujin-stage">
      <Link href={`/doujin/${post.id}/read`} className="doujin-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/media/thumb/${post.id}.webp`} alt={`#${post.id}`} />
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
    // heavy originals (big GIF / APNG / huge images) start with their light sample
    hasSample(post.id) ? (
      <SampleImage
        sample={`/media/sample/${post.id}.webp`}
        original={src}
        percent={samplePercent(post.width, post.height)}
        alt={post.tags.join(" ")}
        width={post.width}
        height={post.height}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={post.tags.join(" ")} width={post.width ?? undefined} height={post.height ?? undefined} />
    )
  );

  return (
    <main>
      <PostView
        newer={newer}
        older={older}
        editHref={canEdit(role) ? `/post/${post.id}/edit` : null}
        zoomable={!isDoujin}
        tags={tagGroups}
        info={info}
        options={options}
        footer={
          canDelete(role) && (
            <div className="action-row">
              <DeleteButton id={post.id} />
            </div>
          )
        }
        media={media}
        rating={post.rating}
      />
    </main>
  );
}
