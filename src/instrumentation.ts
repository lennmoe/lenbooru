export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBot } = await import("./lib/bot");
    startBot();
  }
}
