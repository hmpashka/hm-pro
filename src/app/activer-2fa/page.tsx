import { redirect } from "next/navigation";
import { exigerSession } from "@/lib/session";
import Activation from "./activation";

export const dynamic = "force-dynamic";

export default async function Activer2fa() {
  const c = await exigerSession({ sans2fa: true });
  if (c.user.twoFactorEnabled) redirect("/");
  return <Activation />;
}
