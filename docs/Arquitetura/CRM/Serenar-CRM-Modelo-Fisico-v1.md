# Serenar CRM — Modelo Físico PostgreSQL v1.0

## 1. Propósito e Escopo

Este documento traduz a arquitetura conceitual aprovada para o Serenar CRM em uma especificação técnica física detalhada para PostgreSQL/Supabase.
O objetivo é fornecer um modelo de dados seguro, escalável e alinhado com as regras de negócio, definindo tabelas, colunas, tipos, constraints, chaves estrangeiras, RLS e índices.

**Importante:** Este documento é exclusivamente uma especificação técnica. Ele não é uma migration e não modifica o banco de dados em produção. Nenhuma alteração no Supabase deve ser executada apenas com base neste documento sem o devido processo de migração.

## 2. Linha de Base de Compatibilidade

O Serenar já possui estruturas em produção que devem ser mantidas e respeitadas. A nova arquitetura física foi desenhada para conviver pacificamente com as seguintes tabelas existentes:

- `profiles`: Permanece como o perfil de contas autenticadas (`auth.users`).
- `user_consents`: Permanece para consentimentos atrelados diretamente a `auth.users`.
- `appointments`: Mantém seus campos históricos textuais (`full_name`, `phone`, `email`, `service`, `preferred_date`, `preferred_time`, `notes`). Receberá no futuro chaves estrangeiras opcionais (`client_id`, `service_id`).
- `ai_conversations`: Atualmente exige `user_id` (not null). Será adaptada de forma retrocompatível.
- `user_roles`: Mantém a definição de papéis de usuários (admin, client, owner).
- `leads`: Permanece armazenando os interesses. Receberá vínculo opcional (`converted_client_id`) para evitar perda de origem.
- `services`: Permanece como o catálogo oficial.
- `calendar_slots`, `slot_templates`, `slot_exceptions`: Permanecem inalterados estruturalmente, continuando a controlar a agenda.

Nenhuma dessas tabelas perderá colunas ou terá restrições (constraints) mais rígidas aplicadas que quebrem os dados legados.

## 3. Convenções de Banco de Dados

- **Nomenclatura:** `snake_case` para todas as tabelas, colunas, constraints e índices.
- **Chaves Primárias (PK):** `UUID` padrão gerado via `gen_random_uuid()`.
- **Timestamps:** Utilização de `timestamptz` para `created_at`, `updated_at`, `deleted_at`, etc.
- **Chaves Estrangeiras (FK):** Todas com política `ON DELETE` explícita. Não haverá `CASCADE` destrutivo para registros históricos ou sensíveis (preferência por `RESTRICT` ou `SET NULL`).
- **Arquivamento/Exclusão:** Uso de Soft Delete (arquivamento lógico via `deleted_at` ou `archived_at`) para entidades históricas. Exclusão física restrita.
- **Constraints Nomeadas:** Restrições com nomes claros, ex: `chk_clients_cpf_length`, `fk_client_guardians_client`.
- **Índices:** Criação de índices para todas as Foreign Keys e colunas de busca operacional frequente.
- **Índices Únicos:** A estratégia será definida conforme a regra de negócio. Identificadores civis, como CPF, permanecerão únicos globalmente mesmo após arquivamento; índices parciais serão usados apenas quando a reutilização após inativação for legítima.
- **RLS (Row Level Security):** Habilitada por padrão em todas as novas tabelas desde a criação (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- **Acesso Anônimo:** Proibido acesso direto anônimo às tabelas sensíveis do CRM. Fluxos públicos usarão Server Functions ou RPCs protegidas (`SECURITY DEFINER`).
- **Storage:** Arquivos em buckets privados do Supabase, acessíveis apenas via URLs assinadas.
- **Migrations:** Separadas logicamente por responsabilidade.

## 4. Tipos Controlados (Controlled Types)

Para estados e domínios finitos, a escolha entre `ENUM`, `CHECK` ou `Tabela de Domínio` prioriza extensibilidade sem complexidade desnecessária.

- **Status do Cliente (`clients.status`):** `CHECK constraint` (`registered`, `active`, `inactive`, `archived`). Evita travamento de migrations caso surja um novo status.
- **Vínculo Legal (`client_guardians.relationship`):** `CHECK constraint` (`mother`, `father`, `tutor`, `guardian`, `other`).
- **Status de Anamnese (`client_anamneses.status`):** `CHECK constraint` (`draft`, `completed`, `reviewed`, `superseded`).
- **Tipo de Campo de Anamnese (`anamnesis_questions.field_type`):** `CHECK constraint` (`text`, `textarea`, `boolean`, `number`, `date`, `single_choice`, `multiple_choice`, `scale`).
- **Ator de Preenchimento (`client_anamneses.filled_by`):** `CHECK constraint` (`client`, `guardian`, `professional`).
- **Status de Sessão (`client_sessions.status`):** `CHECK constraint` (`scheduled`, `in_progress`, `completed`, `cancelled`, `no_show`).
- **Tipo de Nota de Sessão (`session_notes.note_type`):** `CHECK constraint` (`observation`, `evolution`, `recommendation`, `correction`, `administrative`).
- **Tipo de Consentimento (`client_consents.consent_type`):** `CHECK constraint` (`data_processing`, `service_authorization`, `guardian_authorization`, `document_storage`, `ai_memory`, `marketing`, `image_use`, `testimonial_use`). Extensível sem alterar tipo enum.
- **Canal de Coleta (`client_consents.collection_channel`):** `CHECK constraint` (`website`, `admin`, `authenticated_portal`, `document`, `other`).
- **Tipo de Ator da Auditoria (`audit_logs.actor_type`):** `CHECK constraint` (`admin`, `professional`, `client`, `guardian`, `system`, `ai_service`).
- **Ação de Auditoria (`audit_logs.action`):** `CHECK constraint` (`create`, `update`, `archive`, `restore`, `revoke`, `view_sensitive`, `export`, `other`).
- **Tipo de Documento (`client_documents.document_type`):** `CHECK constraint` (`identification`, `consent_evidence`, `clinical_attachment`, `external_exam`, `other`).

*Racional:* O uso de restrições `CHECK` baseadas em texto (`text`) ao invés de `ENUMs` nativos do PostgreSQL previne problemas estruturais durante operações de CI/CD e downgrades/rollbacks, mantendo a performance excelente para a escala projetada.

## 5. Especificações Físicas das Tabelas

### 5.1. `clients`
Centraliza a identidade e ficha cadastral.
- **Responsabilidade:** Identidade única da pessoa atendida.
- **Colunas:**
  - `id` (uuid, PK, gen_random_uuid())
  - `auth_user_id` (uuid, NULL, FK auth.users, ON DELETE SET NULL)
  - `full_name` (text, NOT NULL)
  - `cpf` (text, NULL, CHECK quando informado: exatamente 11 dígitos)
  - `birth_date` (date, NOT NULL)
  - `mother_name` (text, NULL)
  - `phone` (text, NOT NULL)
  - `whatsapp` (text, NULL)
  - `email` (text, NULL)
  - `city` (text, NULL)
  - `profession` (text, NULL)
  - `status` (text, NOT NULL, default 'registered', CHECK in list)
  - `source` (text, NOT NULL)
  - `notes` (text, NULL)
  - `created_at` (timestamptz, NOT NULL, default now())
  - `updated_at` (timestamptz, NOT NULL, default now())
  - `deleted_at` (timestamptz, NULL)
- **Constraints Únicas:**
  - Índice único parcial global: `CREATE UNIQUE INDEX uq_clients_cpf ON clients (cpf) WHERE cpf IS NOT NULL;`
  - Índice único parcial global: `CREATE UNIQUE INDEX uq_clients_auth_user ON clients (auth_user_id) WHERE auth_user_id IS NOT NULL;`
- **Índices Operacionais:** `idx_clients_name` (full_name), `idx_clients_phone` (phone).
- **RLS:** Habilitado. Admins possuem acesso total. Usuário logado acessa sua própria ficha (quando `auth_user_id` = `uid()`).
- **Auditoria:** Obrigatória em inserts e updates sensíveis.

### 5.2. `guardians`
Responsáveis legais dos clientes.
- **Responsabilidade:** Cadastro unificado de responsáveis.
- **Colunas:**
  - `id` (uuid, PK)
  - `full_name` (text, NOT NULL)
  - `cpf` (text, NOT NULL, CHECK: exatamente 11 dígitos)
  - `phone` (text, NOT NULL)
  - `whatsapp` (text, NULL)
  - `email` (text, NULL)
  - `created_at` (timestamptz, NOT NULL, default now())
  - `updated_at` (timestamptz, NOT NULL, default now())
  - `deleted_at` (timestamptz, NULL)
- **Constraints:**
  - `chk_guardians_cpf_length`: CPF deve conter exatamente 11 dígitos.
  - `CREATE UNIQUE INDEX uq_guardians_cpf ON guardians (cpf);` — unicidade global, inclusive para responsáveis arquivados.

### 5.3. `client_guardians`
Relação N:N entre clientes e responsáveis.
- **Colunas:**
  - `id` (uuid, PK)
  - `client_id` (uuid, NOT NULL, FK clients, ON DELETE RESTRICT)
  - `guardian_id` (uuid, NOT NULL, FK guardians, ON DELETE RESTRICT)
  - `relationship` (text, NOT NULL, CHECK in list)
  - `is_primary` (boolean, NOT NULL, default false)
  - `legal_authority_confirmed` (boolean, NOT NULL, default false)
  - `valid_from` (timestamptz, NOT NULL, default now())
  - `valid_until` (timestamptz, NULL)
  - `authorization_granted_at` (timestamptz, NULL)
  - `authorization_version` (text, NULL)
  - `revoked_at` (timestamptz, NULL)
  - `created_at` (timestamptz, NOT NULL, default now())
  - `updated_at` (timestamptz, NOT NULL, default now())
- **Constraints:**
  - `chk_client_guardians_validity`: `valid_until IS NULL OR valid_until >= valid_from`.
  - `uq_client_guardians_active_link`: índice único parcial em (`client_id`, `guardian_id`) onde `revoked_at IS NULL AND valid_until IS NULL`, impedindo vínculo ativo duplicado.
  - `uq_client_guardians_primary_active`: índice único parcial em (`client_id`) onde `is_primary = true AND revoked_at IS NULL AND valid_until IS NULL`, garantindo apenas um responsável principal ativo por cliente.
- **Índices:**
  - `idx_client_guardians_client_id` em (`client_id`).
  - `idx_client_guardians_guardian_id` em (`guardian_id`).
- **Histórico:** vínculos encerrados ou revogados permanecem armazenados; nova responsabilidade gera novo vínculo quando necessário.

### 5.4. `client_preferences`
- **Colunas:** `id` (uuid, PK), `client_id` (uuid, FK), `preference_key` (text, NOT NULL), `preference_value` (jsonb, NOT NULL), `created_at`, `updated_at`.
- **Constraints:** Unique `(client_id, preference_key)`.

### 5.5. `client_consents`
- **Responsabilidade:** Histórico imutável de consentimentos por finalidade.
- **Colunas:**
  - `id` (uuid, PK)
  - `client_id` (uuid, NOT NULL, FK clients, ON DELETE RESTRICT)
  - `guardian_id` (uuid, NULL, FK guardians)
  - `consent_type` (text, NOT NULL, CHECK in list)
  - `granted` (boolean, NOT NULL)
  - `legal_basis` (text, NOT NULL)
  - `term_version` (text, NOT NULL)
  - `term_hash` (text, NULL)
  - `collection_channel` (text, NOT NULL, CHECK in list)
  - `evidence_document_id` (uuid, NULL, FK client_documents)
  - `granted_at` (timestamptz, NOT NULL, default now())
  - `revoked_at` (timestamptz, NULL)
  - `expires_at` (timestamptz, NULL)
  - `recorded_by` (uuid, NULL, FK auth.users)
  - `created_at` (timestamptz, NOT NULL, default now())
- **Constraints:** Arquitetura append-only (sem updates na flag `granted`, revogação atualiza `revoked_at`).

### 5.6. `anamnesis_templates`
- **Colunas:** `id`, `name`, `version` (int), `description`, `active` (boolean), `created_by`, `created_at`, `retired_at`.
- **Constraints:** Unique `(name, version)`.

### 5.7. `anamnesis_questions`
- **Colunas:** `id`, `template_id` (FK anamnesis_templates), `question_key` (text), `label`, `field_type` (text, CHECK), `options` (jsonb), `required` (boolean), `display_order` (int), `help_text`, `active`, `created_at`.
- **Constraints:** Unique `(template_id, question_key)`.

### 5.8. `client_anamneses`
- **Colunas:** `id`, `client_id` (FK clients), `template_id` (FK anamnesis_templates), `status` (text, CHECK), `filled_by` (text, CHECK), `guardian_id` (FK guardians), `completed_at`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`.

### 5.9. `anamnesis_answers`
- **Colunas:** `id`, `anamnesis_id` (FK client_anamneses, ON DELETE RESTRICT), `question_id` (FK anamnesis_questions, ON DELETE RESTRICT), `answer` (jsonb, NOT NULL), `created_at`, `updated_at`.
- **Constraints:** Unique `(anamnesis_id, question_id)`.

### 5.10. `client_sessions`
Histórico de atendimento.
- **Colunas:** `id`, `client_id` (FK clients), `appointment_id` (FK appointments, NULL), `service_id` (FK services, NULL), `professional_user_id` (FK auth.users), `session_started_at`, `session_ended_at`, `duration_minutes`, `status` (text, CHECK), `client_report`, `professional_summary`, `recommendations`, `created_at`, `updated_at`.

### 5.11. `session_notes`
Evolução clínica/notas apensadas.
- **Colunas:** `id`, `session_id` (FK client_sessions, ON DELETE RESTRICT), `note_type` (text, CHECK), `content`, `created_by` (FK auth.users, ON DELETE RESTRICT), `supersedes_note_id` (FK session_notes, NULL, ON DELETE RESTRICT), `created_at`.

### 5.12. `client_documents`
- **Responsabilidade:** Metadados seguros de anexos privados.
- **Colunas:**
  - `id` (uuid, PK)
  - `client_id` (uuid, NOT NULL, FK clients, ON DELETE RESTRICT)
  - `document_type` (text, NOT NULL, CHECK)
  - `storage_path` (text, NOT NULL)
  - `original_filename` (text, NOT NULL)
  - `mime_type` (text, NOT NULL)
  - `file_size` (int, NOT NULL)
  - `related_entity_type` (text, NULL)
  - `related_entity_id` (uuid, NULL)
  - `uploaded_by` (uuid, NOT NULL, FK auth.users)
  - `created_at` (timestamptz, NOT NULL, default now())
  - `archived_at` (timestamptz, NULL)
- **Nota Polimórfica:** O uso de `related_entity_type/id` foi preferido em detrimento de 5 chaves estrangeiras anuláveis diferentes, garantindo que o modelo seja facilmente extensível. Operações sensíveis validarão este vínculo via API/RPC.

### 5.13. `audit_logs`
- **Responsabilidade:** Trilha imutável e transversal.
- **Colunas:**
  - `id` (uuid, PK)
  - `actor_user_id` (uuid, NULL)
  - `actor_type` (text, NOT NULL, CHECK)
  - `action` (text, NOT NULL, CHECK)
  - `entity_type` (text, NOT NULL)
  - `entity_id` (uuid, NULL)
  - `client_id` (uuid, NULL)
  - `metadata` (jsonb, NOT NULL, default '{}'::jsonb)
  - `request_id` (text, NULL)
  - `ip_hash` (text, NULL)
  - `user_agent_summary` (text, NULL)
  - `created_at` (timestamptz, NOT NULL, default now())
- **Constraints:** Sem ON DELETE CASCADE; política RLS restrita a INSERTS via Funções. Nenhum UDPATE/DELETE permitido na tabela.

## 6. Integrações com Tabelas Existentes

- **`appointments`**: Adicionar colunas `client_id` (UUID, FK `clients`, NULL) e `service_id` (UUID, FK `services`, NULL). As colunas de texto existentes (`full_name`, `service`, etc.) serão mantidas inalteradas como snapshots do momento do agendamento. Transição suave.
- **`leads`**: Adicionar coluna `converted_client_id` (UUID, FK `clients`, NULL). Manterá a origem do interesse intacta, impedindo conversão múltipla do mesmo lead.
- **`ai_conversations`**:
  - A tabela atual permanece vinculada a usuários autenticados por `user_id NOT NULL`.
  - Poderá receber `client_id` (UUID, NULL, FK `clients`, ON DELETE SET NULL) somente quando houver identificação legítima e consentimento aplicável.
  - O sistema não criará usuário fictício em `auth.users` e não utilizará UUID de sessão anônima em `user_id`.
  - Conversas públicas sem autenticação não serão persistidas em `ai_conversations` enquanto o modelo oficial para esse fluxo não for auditado e aprovado.
  - Qualquer futura alteração de `user_id` para nullable dependerá de auditoria do chat público, das políticas RLS, da retenção, do consentimento e da prevenção de registros órfãos.
  - Esta decisão não bloqueia a primeira migration do CRM e a integração da IA permanecerá em migration posterior.
- **`profiles` e `user_consents`**: Permanecem separados do CRM, focados exclusivamente na autenticação do sistema (`auth.users`). O elo se dará de forma opcional por `clients.auth_user_id`. Regras de Server Function validarão consentimentos consolidados entre `user_consents` e `client_consents`.

## 7. Regras de CPF e Identidade

O CPF é o identificador central de negócios.
- **Armazenamento Físico:** Tipo `text`, limpo antes da persistência no banco (exatamente 11 dígitos, sem pontuação). A formatação e validação algorítmica residirão na Server Function/API.
- **Exclusividade e Omissão:**
  - O CPF não será `NOT NULL` fisicamente na tabela `clients`, permitindo o cadastro controlado de estrangeiros ou menores cuja documentação ainda não esteja disponível.
  - Quando informado, o CPF deverá conter exatamente 11 dígitos e permanecer único em toda a tabela, inclusive para fichas arquivadas.
  - Uma ficha arquivada com o mesmo CPF deverá ser restaurada ou encaminhada para revisão administrativa; nunca deverá ser criada automaticamente uma segunda ficha.
  - Clientes sem CPF deverão passar por verificação complementar com nome completo, data de nascimento, nome da mãe, telefone e responsável legal quando aplicável.
- **Segurança:** O CPF jamais será inserido na tabela `audit_logs` ou repassado ao `messages` (JSON) na tabela `ai_conversations`.

## 8. Menores de Idade e Responsáveis Legais

- O modelo não usará um campo `is_minor`. A idade será deduzida de `clients.birth_date`.
- A unicidade do responsável é mantida por CPF em `guardians`.
- A junção ocorre por `client_guardians`. As constraints físicas exigirão que apenas UM registro dessa tabela por `client_id` possa ter `is_primary = TRUE` ativo (garantido por Partial Unique Index: `CREATE UNIQUE INDEX idx_one_primary_guardian ON client_guardians(client_id) WHERE is_primary = TRUE AND revoked_at IS NULL;`).

## 9. Versionamento de Anamnese

- Modelos (`anamnesis_templates`) e suas perguntas (`anamnesis_questions`) nunca são atualizados destrutivamente quando estão ativos e com respostas. Se as perguntas mudam, a `version` é incrementada e o anterior ganha `retired_at = NOW()`.
- Respostas ficam cravadas no histórico usando chaves estrangeiras restritas, assegurando que o arquivo do cliente e a visão clínica da época estejam imutáveis.

## 10. Sessões e Histórico Profissional

- Separado do `appointment`. Um appointment aponta para intenção, a `client_sessions` marca a realização médica/terapêutica.
- Nenhuma modificação nos `session_notes` substitui (UPDATE) o texto. Usa-se arquitetura de "correção", anexando uma nova nota apontando para a velha via `supersedes_note_id`.

## 11. Documentos e Storage

- Todo arquivo gerado ou recebido vai para um Bucket privado (ex: `crm-documents`). O nome do arquivo no Storage não deve conter CPF ou nome.
- A tabela `client_documents` guardará metadados de Mime Type, tamanho, etc. Nenhuma URL definitiva existirá. As funções do backend gerarão URLs temporárias assinadas e de uso único (signed URLs).
- Polymorphism em `related_entity_type` e `related_entity_id` é o design mais manutenível aqui, permitindo que anexos sirvam de evidência de consentimento E relatórios médicos de uma sessão, sem fragmentar o schema em múltiplas tabelas-meio.

## 12. Modelo de Consentimento

- `client_consents` será append-only. Se um consentimento de marketing é cancelado, a tupla atual recebe `revoked_at = NOW()`. Um novo opt-in cria um novo registro independente.
- Sem uso de chaves booleanas estáticas (ex: `marketing_opt_in = true` no profile). Essa granularidade física é vital para compliance LGPD.

## 13. Modelo de Auditoria

- Tabela `audit_logs` só terá política RLS de `INSERT` e com `SECURITY DEFINER` (ou via Server Functions via service_role restrito).
- Sem dependência lógica com as tabelas operacionais (ex: sem FK de cascata).
- Nenhuma operação falhará por erros de inserção na auditoria a menos que configurado estritamente na transação. A prioridade é do negócio, embora falhas de auditoria gerem alertas severos.

## 14. Matriz RLS (Row Level Security)

*Nota: Esta matriz representa o comportamento-alvo da autorização do Serenar. No estado atual do banco, `app_role` possui somente `admin`, `client` e `owner`. As funções `is_admin()` e `is_staff()` reconhecem `admin` e `owner`. Os papéis `professional` e `guardian` ainda não existem e não deverão ser inventados na Migration 001. Portanto, a primeira migration implementará somente as políticas compatíveis com o modelo de autorização já existente; as demais permanecerão como arquitetura futura até que seus papéis e fluxos de identidade sejam formalmente modelados.*

| Ator / Permissão | `clients` | `client_anamneses` | `client_sessions` | `client_consents` | `client_documents` | `audit_logs` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Anon / Public** | NONE | NONE | NONE | NONE | NONE | NONE |
| **Auth. Client** (próprio) | SELECT/UPDATE | SELECT | SELECT | SELECT/INSERT | SELECT | NONE |
| **Auth. Guardian** | SELECT | SELECT (se autz) | NONE | SELECT/INSERT | SELECT | NONE |
| **Professional** | SELECT | SELECT/INSERT | ALL (restrito) | SELECT | SELECT | NONE |
| **Admin / Owner** | ALL | ALL | ALL | ALL | ALL | SELECT |
| **Service Role** | ALL | ALL | ALL | ALL | ALL | ALL |

## 15. Matriz Física de Chaves Estrangeiras

Esta seção consolida todas as chaves estrangeiras do Serenar CRM. As decisões priorizam preservação histórica, ausência de registros órfãos, compatibilidade com produção e evolução sem rigidez desnecessária.

| Tabela | Coluna | Referência | Nulável | ON DELETE | Índice | Justificativa |
|---|---|---|---|---|---|---|
| `clients` | `auth_user_id` | `auth.users(id)` | Sim | `SET NULL` | Sim, único quando informado | A exclusão da conta autenticada não deve apagar a ficha do CRM. |
| `client_guardians` | `client_id` | `clients(id)` | Não | `RESTRICT` | Sim | O vínculo legal e seu histórico não podem sobreviver sem referência válida nem ser apagados por exclusão acidental. |
| `client_guardians` | `guardian_id` | `guardians(id)` | Não | `RESTRICT` | Sim | Preserva o responsável e todos os vínculos legais relacionados. |
| `client_preferences` | `client_id` | `clients(id)` | Não | `RESTRICT` | Sim | O Serenar utilizará arquivamento lógico de clientes; preferências não serão apagadas automaticamente. |
| `client_consents` | `client_id` | `clients(id)` | Não | `RESTRICT` | Sim | Consentimentos são evidências históricas e não podem ser removidos por cascata. |
| `client_consents` | `guardian_id` | `guardians(id)` | Sim | `RESTRICT` | Sim | Quando informado, o responsável que concedeu a autorização deve permanecer identificável. |
| `client_consents` | `evidence_document_id` | `client_documents(id)` | Sim | `RESTRICT` | Sim | Um documento usado como evidência não poderá ser removido enquanto sustentar um consentimento. |
| `client_consents` | `recorded_by` | `auth.users(id)` | Sim | `SET NULL` | Sim | Preserva o consentimento mesmo que a conta administrativa seja removida. |
| `anamnesis_templates` | `created_by` | `auth.users(id)` | Não | `RESTRICT` | Sim | Um modelo utilizado no histórico deve preservar a referência ao autor responsável. |
| `anamnesis_questions` | `template_id` | `anamnesis_templates(id)` | Não | `RESTRICT` | Sim | Perguntas de versões utilizadas não podem ser apagadas por cascata. |
| `client_anamneses` | `client_id` | `clients(id)` | Não | `RESTRICT` | Sim | A anamnese pertence ao histórico do cliente e deve ser preservada. |
| `client_anamneses` | `template_id` | `anamnesis_templates(id)` | Não | `RESTRICT` | Sim | Mantém a versão exata utilizada no preenchimento. |
| `client_anamneses` | `guardian_id` | `guardians(id)` | Sim | `RESTRICT` | Sim | Quando houver participação do responsável, a referência legal deve permanecer. |
| `client_anamneses` | `reviewed_by` | `auth.users(id)` | Sim | `SET NULL` | Sim | A revisão continua registrada mesmo se a conta da profissional for removida. |
| `anamnesis_answers` | `anamnesis_id` | `client_anamneses(id)` | Não | `RESTRICT` | Sim | Respostas concluídas são dados históricos e não serão apagadas automaticamente. |
| `anamnesis_answers` | `question_id` | `anamnesis_questions(id)` | Não | `RESTRICT` | Sim | Preserva a pergunta e a versão às quais a resposta pertence. |
| `client_sessions` | `client_id` | `clients(id)` | Não | `RESTRICT` | Sim | Sessões são parte permanente do histórico profissional. |
| `client_sessions` | `appointment_id` | `appointments(id)` | Sim | `SET NULL` | Sim | A sessão pode continuar existindo mesmo se o vínculo operacional com o agendamento deixar de existir. |
| `client_sessions` | `service_id` | `services(id)` | Sim | `SET NULL` | Sim | Preserva a sessão quando um serviço for desativado ou removido, usando snapshot histórico quando necessário. |
| `client_sessions` | `professional_user_id` | `auth.users(id)` | Não | `RESTRICT` | Sim | Sessões concluídas devem preservar a identificação da profissional responsável. |
| `session_notes` | `session_id` | `client_sessions(id)` | Não | `RESTRICT` | Sim | Notas profissionais não podem ser eliminadas por cascata. |
| `session_notes` | `created_by` | `auth.users(id)` | Não | `RESTRICT` | Sim | Preserva a autoria do registro profissional. |
| `session_notes` | `supersedes_note_id` | `session_notes(id)` | Sim | `RESTRICT` | Sim | Mantém a cadeia de correções e impede exclusão de notas referenciadas. |
| `client_documents` | `client_id` | `clients(id)` | Não | `RESTRICT` | Sim | Documentos privados nunca devem ficar órfãos ou ser apagados automaticamente. |
| `client_documents` | `uploaded_by` | `auth.users(id)` | Não | `RESTRICT` | Sim | O responsável pelo upload deve permanecer identificável para auditoria. |
| `appointments` | `client_id` | `clients(id)` | Sim | `SET NULL` | Sim | Compatibilidade com registros legados e preservação dos snapshots textuais. |
| `appointments` | `service_id` | `services(id)` | Sim | `SET NULL` | Sim | O histórico textual do serviço permanece mesmo que o catálogo mude. |
| `leads` | `converted_client_id` | `clients(id)` | Sim | `SET NULL` | Sim, único quando informado | Preserva o lead original e impede conversões múltiplas. |
| `ai_conversations` | `client_id` | `clients(id)` | Sim | `SET NULL` | Sim | O vínculo CRM é opcional e não deve apagar conversas autenticadas existentes. |

### 15.1 Referências lógicas sem FK física

`audit_logs.entity_type` e `audit_logs.entity_id` permanecerão como referência lógica, sem chave estrangeira polimórfica. Isso permite auditar diferentes entidades sem acoplar a tabela de auditoria a todas elas.

`audit_logs.client_id` será uma referência lógica opcional, sem `ON DELETE CASCADE`, para que a trilha permaneça íntegra mesmo em cenários futuros de anonimização ou retenção.

### 15.2 Documentos relacionados a outras entidades

O modelo polimórfico `related_entity_type` e `related_entity_id` será mantido nesta versão para evitar múltiplas colunas anuláveis e permitir expansão controlada.

Regras obrigatórias:

1. `related_entity_type` e `related_entity_id` deverão ser ambos nulos ou ambos preenchidos.
2. `related_entity_type` utilizará lista controlada.
3. A existência e a propriedade da entidade relacionada serão validadas em Server Function ou RPC protegida.
4. O documento sempre permanecerá diretamente vinculado a `client_id`.
5. A ausência de FK polimórfica não permitirá acesso direto do frontend à escrita.
6. Novos tipos de entidade somente serão adicionados após revisão de segurança e integridade.

### 15.3 Regras permanentes de exclusão

1. Dados clínicos, consentimentos, documentos e vínculos legais não utilizarão `ON DELETE CASCADE`.
2. Entidades com histórico utilizarão arquivamento lógico ou aposentadoria.
3. `SET NULL` será usado apenas quando o registro filho continuar válido sem o vínculo original.
4. `RESTRICT` será usado quando a exclusão do registro pai destruiria contexto, autoria, prova ou histórico.
5. Exclusão física dependerá de processo administrativo específico, política de retenção e auditoria.
6. Todas as colunas de FK possuirão índice B-Tree, salvo justificativa técnica documentada.
7. A obrigatoriedade futura de relações atualmente nuláveis somente será aplicada após backfill auditado e homologação em produção.

## 16. Inventário de Constraints Críticas e Índices (Resumo)

- **PKs:** UUIDs genéricos default `gen_random_uuid()`.
- **Unique e Unique Partial:**
  - `uq_clients_cpf` (`cpf` onde `cpf IS NOT NULL`, sem excluir registros arquivados)
  - `uq_guardians_cpf` (`cpf` único globalmente, inclusive para responsáveis arquivados)
  - `idx_primary_guardian` (`client_id` em `client_guardians` onde `is_primary = true AND revoked_at IS NULL`)
- **FK Indexes:** Todos os `*_id` criarão índices padrão B-Tree para prevenir table scans em JOINs e DELETEs (ex: `idx_client_sessions_client_id`).

## 17. Sequência de Migration Proposta

Visando deploy contínuo seguro, sem breaking changes, a execução será fracionada:

1. **Mig 001 - CRM Identidade:** Cria as restrições `CHECK` e as tabelas `clients`, `guardians` e `client_guardians`, com índices, Foreign Keys, triggers e fundação RLS compatível com o modelo de autorização existente. (Deploy transparente).
2. **Mig 002 - Preferências, Documentos e Consentimentos:** Cria `client_preferences`, depois `client_documents` e, por fim, `client_consents`, permitindo que `evidence_document_id` nasça com sua Foreign Key válida desde a criação.
3. **Mig 003 - Integração Leads e Appointments:** Modifica tabela `appointments` (adiciona colunas nullable `client_id`, `service_id`), e `leads` (adiciona `converted_client_id`). Indexa tudo.
4. **Mig 004 - Domínio Clínico (Anamnese e Sessões):** Cria todo o bloco `anamnesis_*` e `client_sessions`, `session_notes`.
5. **Mig 005 - Auditoria e Storage Seguro:** Cria `audit_logs` e configura os buckets privados, políticas e infraestrutura necessária do Supabase Storage. A tabela `client_documents` já terá sido criada na Mig 002.
6. **Mig 006 - IA e Setup RLS:** Modifica `ai_conversations` para CRM e revisita Grants/RLS unificados para garantir segurança hermética.
7. **Reflexo TypeScript:** `supabase gen types` para alinhar as rotas atuais do frontend de pré-agendamento às colunas nullable recém inseridas.

## 18. Compatibilidade Produtiva e Rollout

A infraestrutura atual está protegida:
- Não há migrações destrutivas. Nenhuma exclusão de coluna ou dados textuais atuais (`full_name`, `phone` do `appointments`) ocorrerá no curto prazo.
- Todo pré-agendamento via web continuará operante e salvará nos campos texto de `appointments`.
- O backfill de `appointments.client_id` não utilizará CPF, pois os agendamentos legados não possuem esse campo. A vinculação considerará nome, telefone e email existentes, com critérios conservadores, relatório de ambiguidades e revisão administrativa; nenhuma correspondência incerta será vinculada automaticamente.
- Comparações com o Lovable Cloud Database serão mandatórias utilizando comandos de diff do Supabase CLI antes do push da release.

## 19. Decisões em Aberto e Resoluções Pós-Auditoria

*A auditoria local não detectou bloqueios impeditivos.*
- **Decisão resolvida (IA pública):** `ai_conversations.user_id` permanecerá `NOT NULL` para conversas autenticadas. Não serão criados usuários fictícios em `auth.users`, nem UUIDs de sessão serão gravados nessa FK. Conversas públicas continuarão sem persistência nessa tabela até que um modelo específico seja auditado e aprovado. A adição opcional de `client_id` e qualquer flexibilização futura de `user_id` ficarão em migration posterior e não bloqueiam a fundação do CRM.
- **Decisão resolvida (CPF e Menores):** `clients.cpf` será nullable para estrangeiros, menores sem documento disponível e exceções controladas. Quando informado, deverá conter exatamente 11 dígitos e será único globalmente, inclusive em fichas arquivadas. Registros sem CPF exigirão identificação complementar e controle contra duplicidade; uma ficha arquivada deverá ser restaurada ou revisada, nunca recriada com o mesmo CPF.
