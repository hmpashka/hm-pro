"use client";
import { useState } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";

export default function Activation() {
  const [qr, setQr] = useState("");
  const [uri, setUri] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [erreur, setErreur] = useState("");

  async function demarrer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur("");
    const password = String(new FormData(e.currentTarget).get("mdp"));
    const { data, error } = await authClient.twoFactor.enable({ password, method: "totp" });
    if (error || !data || data.method !== "totp") { setErreur("Mot de passe refusé."); return; }
    setUri(data.totpURI);
    setCodes(data.backupCodes);
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }));
  }
  async function confirmer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    if (error) setErreur("Code refusé : vérifiez l'heure du téléphone et réessayez.");
    else window.location.href = "/";
  }

  return (
    <main className="connexion">
      <h1>Activer la double authentification</h1>
      <p className="doux">Obligatoire pour utiliser le tableau de bord.</p>
      {!qr ? (
        <form onSubmit={demarrer}>
          <label>Votre mot de passe<input name="mdp" type="password" autoComplete="current-password" required /></label>
          <button className="principal">Continuer</button>
        </form>
      ) : (
        <form onSubmit={confirmer}>
          <p>1. Scannez ce code avec Google Authenticator, Microsoft Authenticator, 1Password ou Bitwarden.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code de la double authentification" width={220} height={220} />
          <details><summary className="petit">Saisie manuelle</summary><code className="bloc">{uri}</code></details>
          <p>2. Notez ces codes de secours (un seul usage chacun) et gardez-les hors ligne :</p>
          <code className="bloc">{codes.join("   ")}</code>
          <label>3. Code affiché par l'appli<input name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>
          <button className="principal">Activer</button>
        </form>
      )}
      {erreur && <p className="message danger">{erreur}</p>}
    </main>
  );
}
