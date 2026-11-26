"use client";
import { useActionState } from "react";

type Retour = { ok?: string; erreur?: string; secret?: string };

/** Formulaire relié à une action serveur, avec confirmation facultative et message de retour. */
export default function Formulaire({ action, children, confirmer, className = "ligne" }: {
  action: (r: Retour, f: FormData) => Promise<Retour>;
  children: React.ReactNode;
  confirmer?: string;
  className?: string;
}) {
  const [etat, envoyer, enCours] = useActionState(action, {} as Retour);
  return (
    <form action={envoyer} className={className}
          onSubmit={(e) => {
            // confirmation du formulaire, ou du bouton cliqué (data-confirmer)
            const b = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
            const q = b?.dataset.confirmer ?? confirmer;
            if (q && !window.confirm(q)) e.preventDefault();
          }}>
      {children}
      {enCours && <span className="doux petit">…</span>}
      {etat.erreur && <span className="danger petit">{etat.erreur}</span>}
      {etat.ok && <span className="ok petit">{etat.ok}{etat.secret && <code className="bloc">{etat.secret}</code>}</span>}
    </form>
  );
}
