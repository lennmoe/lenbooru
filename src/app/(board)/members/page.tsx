import { redirect } from "next/navigation";

/** Members management moved to the admin page. */
export default function MembersPage() {
  redirect("/admin?tab=members");
}
