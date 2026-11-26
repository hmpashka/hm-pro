"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Menu({ liens }: { liens: { href: string; nom: string }[] }) {
  const p = usePathname();
  return (
    <nav className="menu">
      {liens.map((l) => (
        <Link key={l.href} href={l.href} className={(l.href === "/" ? p === "/" : p.startsWith(l.href)) ? "actif" : ""}>{l.nom}</Link>
      ))}
    </nav>
  );
}
