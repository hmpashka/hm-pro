import Link from "next/link";
import { exigerSession } from "@/lib/session";
import { modulesVisibles, peut } from "@/lib/droits";
import { PRODUITS, comptes, resumer } from "@/lib/live";

export const dynamic = "force-dynamic";

async function resumeLicences() {
  try {
    const listes = await Promise.all(PRODUITS.map(async (p) => ({ p, r: resumer(await comptes(p.code)) })));
    return { listes };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "live.hm injoignable" };
  }
}

export default async function Accueil({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const c = await exigerSession();
  const { refus } = await searchParams;
  const modules = modulesVisibles(c.user, c.droits);
  const lic = peut(c.user, c.droits, "licences", "lecture") ? await resumeLicences() : null;
  return (
    <>
      <h1>Bonjour {c.user.name.split(" ")[0]}</h1>
      {refus && <p className="message alerte">Vous n'avez pas accès à « {refus} ».</p>}
      {lic && (
        <>
          <h2>Licences</h2>
          {"erreur" in lic ? <p className="message danger">live.hm : {lic.erreur}</p> : (
            <div className="grille">
              {lic.listes!.map(({ p, r }) => (
                <Link key={p.code} href={"/licences?produit=" + p.code} className="carte" style={{ color: "inherit" }}>
                  <div className="doux">{p.nom}</div>
                  <div className="chiffre">{r.actifs}<span className="doux petit"> actives / {r.total}</span></div>
                  <div className="petit">
                    <span className="alerte">{r.essais} en essai</span>
                    {r.essaisFinis.length > 0 && <> · <span className="danger">{r.essaisFinis.length} essai(s) fini(s)</span></>}
                    {r.expirentBientot.length > 0 && <> · <span className="alerte">{r.expirentBientot.length} expire(nt) sous 30 j</span></>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      <h2>Modules</h2>
      <div className="grille">
        {modules.map((m) => (
          <Link key={m.code} href={"/" + m.code} className="carte" style={{ color: "inherit" }}>
            <strong>{m.nom}</strong>
            <div className="doux petit">{m.pret ? "Ouvrir" : "Bientôt"}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
