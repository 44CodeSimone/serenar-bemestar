
# Serenar CMS — Plano incremental

Objetivo: transformar `/admin` em um CMS completo para a Mariah, sem quebrar arquitetura, design, Auth, RLS, agendamentos, chat, WhatsApp ou SEO existentes. Tudo em Português (Brasil).

Para reduzir risco, entrego em **3 fases**. Cada fase é funcional e testável antes da próxima.

---

## Fase 1 — Fundação (esta entrega)

Escopo mínimo que já dá controle real à Mariah sem risco de quebrar o público.

### 1.1 Banco de dados (migração única)
- Nova tabela `public.site_images` — biblioteca de imagens
  - campos: `storage_path`, `public_url`, `alt`, `tag` (hero/servico/blog/sobre/outros), `width`, `height`, `size_bytes`, `mime`, `uploaded_by`
- Nova tabela `public.site_content` — conteúdo editável do site (key/value JSONB)
  - chaves iniciais: `home_hero`, `home_about`, `home_cta`, `contact_info`, `footer`, `seo_home`, `whatsapp_group`
- Adicionar colunas em `services`: `image_url`, `alt`, `display_order`, `active` (se ainda não existirem)
- Estender `blog_posts` para CMS completo: `slug`, `excerpt`, `content`, `cover_url`, `cover_alt`, `seo_title`, `seo_description`, `tags text[]`, `status` ('draft'|'published'), `published_at`
- RLS:
  - Leitura pública apenas para: `site_images` (linha marcada `public=true`), `site_content` (todas), `services` (active), `blog_posts` (status='published')
  - Escrita: apenas `is_admin(auth.uid())`
- GRANTs completos (anon SELECT onde há política pública; authenticated + service_role para admin)

### 1.2 Supabase Storage
- Bucket `site-images` (privado; URLs assinadas ou público read apenas via política)
- Políticas: upload/delete só para admin; leitura pública dos objetos
- Validação client-side: apenas `image/jpeg|png|webp`, máx 5 MB

### 1.3 Admin — navegação e telas base
Atualizar `AdminSidebar` com os itens finais:
Dashboard · Conteúdo do site · Imagens · Serviços · Agendamentos · Blog · FAQ · Depoimentos · SEO · WhatsApp · Configurações

Nesta fase implemento telas funcionais para:
- **Imagens** (`/admin/imagens`) — upload, preview, alt text, tag, copiar URL, excluir
- **Conteúdo do site** (`/admin/conteudo`) — editor de campos do `home_hero`, `home_about`, `home_cta`, `contact_info`, `footer`, com salvar/mensagem de sucesso
- **WhatsApp** (`/admin/whatsapp`) — número principal + link do grupo (título, descrição, link, CTA, ativo, aparece em Home/Contato); se link vazio, botão público fica escondido
- **Blog** (`/admin/blog`) — lista, criar, editar, excluir, salvar rascunho, publicar/despublicar, imagem de capa, slug, resumo, conteúdo (markdown simples), SEO, tags, data
- **Serviços** (`/admin/servicos`) — já existe; adicionar imagem, ordem, ativo

Telas placeholder (evolução Fase 2/3): SEO, Depoimentos.

### 1.4 Server functions
- `uploadSiteImage`, `deleteSiteImage`, `listSiteImages` (admin only)
- `getSiteContent(key)` público / `updateSiteContent(key, value)` admin
- `listBlogPosts(admin)` / `getPublishedPost(slug)` público / `upsertBlogPost` / `deleteBlogPost`
- `getWhatsappGroup` público / `updateWhatsappGroup` admin

Todas admin usam `requireSupabaseAuth` + checagem `is_admin`.

### 1.5 Público conectado
Nesta fase conecto ao editável:
- Home: hero + about + CTA lidos de `site_content`
- Rodapé/Contato: dados de `site_content.contact_info`
- Página `/blog`: lista posts publicados (substitui o placeholder atual), rota nova `/blog/$slug`
- Seção "Grupo do WhatsApp" na Home e em `/contato` (só renderiza se `active` e `link` preenchidos)
- `SITE.whatsapp.link` continua como fallback; se admin editar, sobrescreve em runtime via hook

---

## Fase 2 — Blog rico + SEO + Depoimentos
- Editor de conteúdo mais rico (toolbar markdown)
- Página `/admin/seo` para meta por rota
- CRUD de depoimentos + carrossel público
- OG image por post (usa cover)

## Fase 3 — Polimento CMS
- Galeria de reuso de imagens em qualquer campo (image picker modal)
- Log de auditoria de edições
- Preview de post antes de publicar
- Versionamento simples de `site_content`

---

## Detalhes técnicos (referência)

```text
src/routes/_authenticated/admin/
  conteudo.tsx        (novo)
  imagens.tsx         (novo)
  blog.tsx            (novo — CRUD)
  whatsapp.tsx        (novo)
  servicos.tsx        (estender)
src/routes/blog.$slug.tsx        (novo público)
src/lib/cms.functions.ts         (novo — server fns admin/público)
src/components/admin/ImagePicker.tsx
src/components/admin/ImageUploader.tsx
supabase/migrations/<ts>_cms_foundation.sql
```

Segurança: validação de mime/size no client + no server fn; storage policies restringem write ao admin; RLS gate por `is_admin`. Nada exposto publicamente além do que já é público hoje.

---

Confirma que sigo com a **Fase 1** exatamente como descrito? Se quiser ajustar escopo (ex.: adiar Blog para Fase 2, ou incluir Depoimentos já agora), me avise antes.
