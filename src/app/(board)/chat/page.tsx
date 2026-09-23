import { redirect } from "next/navigation";
import ChatApp from "@/components/ChatApp";
import { listChannels } from "@/lib/chat";
import { chatMember } from "@/lib/chatAuth";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const me = await chatMember();
  if (!me) redirect("/login");
  return (
    <main className="chat-page">
      <ChatApp initialChannels={listChannels()} me={me.user} isOwner={me.isOwner} />
    </main>
  );
}
