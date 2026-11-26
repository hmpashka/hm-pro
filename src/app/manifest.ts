import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "HM Pro", short_name: "HM Pro", start_url: "/", display: "standalone", background_color: "#0f1216", theme_color: "#1f6feb", lang: "fr",
           icons: [{ src: "/icone.svg", sizes: "any", type: "image/svg+xml" }] };
}
