import { notFound } from "next/navigation";
import { MODULES } from "@/lib/droits";
import { exigerDroit } from "@/lib/session";

export default async function Bientot({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const m = MODULES.find((x) => x.code === module && !x.pret);
  if (!m) notFound();
  await exigerDroit(m.code, "lecture");
  return (
    <>
      <h1>{m.nom}</h1>
      <p className="doux">Ce module arrive dans une prochaine étape.</p>
    </>
  );
}
