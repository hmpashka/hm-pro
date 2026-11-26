"use client";
import { authClient } from "@/lib/auth-client";
export default function Deconnexion() {
  return <button onClick={async () => { await authClient.signOut(); window.location.href = "/connexion"; }}>Quitter</button>;
}
