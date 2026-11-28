"use server";
import { revalidatePath } from "next/cache";
import { exigerDroit } from "@/lib/session";
import { viderCacheAgenda } from "@/lib/agenda";

export async function actualiserAgenda(_r?: { ok?: string; erreur?: string }, _f?: FormData) {
  void _r; void _f;
  await exigerDroit("agenda", "lecture");
  viderCacheAgenda();
  revalidatePath("/agenda");
  revalidatePath("/");
  return { ok: "Actualisé." };
}
