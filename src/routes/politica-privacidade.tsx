import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE } from "@/lib/site-config";

export const Route = createFileRoute("/politica-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Serenar" },
      { name: "description", content: "Como o Serenar coleta, usa e protege seus dados pessoais conforme a LGPD." },
    ],
  }),
  component: () => (
    <section className="container-narrow max-w-3xl py-16 md:py-24">
      <p className="eyebrow mb-3">LGPD</p>
      <h1 className="display-serif text-5xl">Política de Privacidade</h1>
      <div className="prose prose-neutral mt-8 space-y-4 text-muted-foreground [&>h2]:font-serif [&>h2]:text-2xl [&>h2]:text-sage-deep [&>h2]:mt-8">
        <p>Sua tranquilidade importa dentro e fora do espaço. Esta política descreve, de forma simples, como tratamos seus dados no {SITE.name}.</p>
        <h2>Dados que coletamos</h2>
        <p>Nome, telefone, email, data de nascimento (opcional), preferências de atendimento e conversas com a assistente virtual Serená, quando você concordar.</p>
        <h2>Como usamos</h2>
        <p>Para agendar sessões, personalizar seu cuidado, lembrar aniversários (com consentimento), enviar comunicações (quando autorizadas) e manter registros mínimos de negócio.</p>
        <h2>Base legal (LGPD)</h2>
        <p>Consentimento explícito para memória da IA e marketing. Execução de contrato para agendamentos. Legítimo interesse para segurança do site.</p>
        <h2>Compartilhamento</h2>
        <p>Não vendemos dados. Utilizamos provedores de infraestrutura (Lovable Cloud) para armazenamento seguro. Compartilhamos com autoridades apenas quando exigido por lei.</p>
        <h2>Seus direitos</h2>
        <p>Você pode acessar, corrigir, exportar ou excluir seus dados a qualquer momento. Basta escrever para {SITE.email} ou pelo WhatsApp {SITE.whatsapp.display}.</p>
        <h2>Cookies</h2>
        <p>Usamos apenas cookies essenciais para funcionamento do site e um cookie de preferência para lembrar sua escolha no banner LGPD.</p>
      </div>
      <div className="mt-10">
        <Link to="/" className="btn-serena-outline">Voltar</Link>
      </div>
    </section>
  ),
});
