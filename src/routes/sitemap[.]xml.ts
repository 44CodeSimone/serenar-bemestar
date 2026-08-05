import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { absoluteSiteUrl } from "@/lib/seo";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  lastmod?: string | null;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/sobre", changefreq: "monthly", priority: "0.9" },
          { path: "/servicos", changefreq: "monthly", priority: "0.9" },
          { path: "/agendamento", changefreq: "monthly", priority: "0.9" },
          { path: "/contato", changefreq: "monthly", priority: "0.8" },
          { path: "/faq", changefreq: "monthly", priority: "0.7" },
          { path: "/blog", changefreq: "weekly", priority: "0.7" },
          { path: "/politica-privacidade", changefreq: "yearly", priority: "0.3" },
          { path: "/termos", changefreq: "yearly", priority: "0.3" },
        ];
        const { data: posts } = await supabase
          .from("blog_posts")
          .select("slug,published_at,updated_at")
          .eq("status", "published")
          .order("published_at", { ascending: false });
        const articleEntries: SitemapEntry[] = (posts ?? []).map((post) => ({
          path: `/blog/${encodeURIComponent(post.slug)}`,
          changefreq: "monthly",
          priority: "0.6",
          lastmod: post.updated_at || post.published_at,
        }));
        const entries = [...staticEntries, ...articleEntries];
        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${absoluteSiteUrl(e.path)}</loc>`,
            e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
