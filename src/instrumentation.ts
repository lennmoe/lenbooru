export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBot } = await import("./lib/bot");
    startBot();
    // one-off background pass: animated thumbnails + samples for older posts
    const { regenerateMediaOnce } = await import("./lib/regen");
    void regenerateMediaOnce();
  }
}
