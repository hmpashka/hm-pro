// Avant chaque page : sans cookie de session, direction /connexion. Le vrai contrôle (session, 2FA, droits) est fait
// côté serveur dans chaque page et action ; ceci évite seulement d'afficher quoi que ce soit sans être connecté.
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(req: NextRequest) {
  if (!getSessionCookie(req, { cookiePrefix: "hmpro" })) return NextResponse.redirect(new URL("/connexion", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!connexion|2fa|api/|_next/|manifest.webmanifest|icone.svg|favicon.ico).*)"],
};
