"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function DeuxiemeFacteur() {
  const [secours, setSecours] = useState(false);
  const [erreur, setErreur] = useState("");
  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur("");
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    const r = secours
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
    if (r.error) setErreur(r.error.status === 429 ? "Trop d'essais : réessayez dans 15 minutes." : "Code refusé.");
    else window.location.href = "/";
  }
  return (
    <main className="connexion">
      <h1>Vérification</h1>
      <form onSubmit={envoyer}>
        <label>{secours ? "Code de secours" : "Code à 6 chiffres de votre appli d'authentification"}
          <input name="code" inputMode={secours ? "text" : "numeric"} autoComplete="one-time-code" required autoFocus />
        </label>
        {erreur && <p className="message danger">{erreur}</p>}
        <button className="principal">Valider</button>
        <button type="button" onClick={() => setSecours(!secours)}>{secours ? "Utiliser l'appli" : "Utiliser un code de secours"}</button>
      </form>
    </main>
  );
}
