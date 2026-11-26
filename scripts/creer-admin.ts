// Premier compte (administrateur) : npm run creer-admin -- mail@domaine.fr "Prénom Nom"
// Le mot de passe est demandé (pas dans l'historique du terminal). La 2FA sera demandée à la première connexion.
import { createInterface } from "node:readline/promises";
import { creerPersonne } from "../src/lib/personnes";
import { sql } from "../src/db";

const [email, nom] = process.argv.slice(2);
if (!email) { console.error('Usage : npm run creer-admin -- mail@domaine.fr "Prénom Nom"'); process.exit(1); }
let mdp = process.env.MOT_DE_PASSE ?? "";
if (!mdp) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  mdp = await rl.question("Mot de passe (12 caractères au moins) : ");
  rl.close();
}
try {
  const u = await creerPersonne({ email, name: nom ?? email, password: mdp, role: "admin" });
  console.log("Administrateur créé :", u.email);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
