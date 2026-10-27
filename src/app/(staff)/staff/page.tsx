import { redirect } from "next/navigation";

/** /staff has no page of its own; the auth guard on /teacher handles signed-out users. */
export default function StaffIndex() {
  redirect("/teacher");
}
