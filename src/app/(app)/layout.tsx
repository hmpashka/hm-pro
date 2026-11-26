import { exigerSession } from "@/lib/session";
import { modulesVisibles } from "@/lib/droits";
import Menu from "@/composants/menu";
import Deconnexion from "@/composants/deconnexion";

export const dynamic = "force-dynamic";

export default async function Coque({ children }: { children: React.ReactNode }) {
  const c = await exigerSession();
  const liens = [{ href: "/", nom: "Accueil" }, ...modulesVisibles(c.user, c.droits).map((m) => ({ href: "/" + m.code, nom: m.nom })),
                 { href: "/reglages", nom: "Réglages" }];
  return (
    <>
      <header className="entete">
        <span className="marque">HM Pro</span>
        <Menu liens={liens} />
        <Deconnexion />
      </header>
      <main className="page">{children}</main>
    </>
  );
}
