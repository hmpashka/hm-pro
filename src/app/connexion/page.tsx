"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function Connexion() {
  const [erreur, setErreur] = useState("");
  const [attente, setAttente] = useState(false);
  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur("");
    setAttente(true);
    const f = new FormData(e.currentTarget);
    const { data, error } = await authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("mdp")) });
    setAttente(false);
    if (error) {
      setErreur(error.status === 429 ? "Trop d'essais : réessayez dans 15 minutes." : "Adresse ou mot de passe incorrect.");
      return;
    }
    // 2FA déjà activée : le client part sur /2fa tout seul. Sinon, activation obligatoire.
    if (data && !("twoFactorRedirect" in data && data.twoFactorRedirect)) window.location.href = "/activer-2fa";
  }
  return (
    <main className="connexion">
      <h1>HM Pro</h1>
      <form onSubmit={envoyer}>
        <label>Adresse mail<input name="email" type="email" autoComplete="username" required /></label>
        <label>Mot de passe<input name="mdp" type="password" autoComplete="current-password" required minLength={12} /></label>
        {erreur && <p className="message danger">{erreur}</p>}
        <button className="principal" disabled={attente}>{attente ? "Connexion…" : "Se connecter"}</button>
      </form>
    </main>
  );
}
