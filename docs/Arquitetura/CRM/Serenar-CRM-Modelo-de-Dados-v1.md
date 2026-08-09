# Serenar CRM — Modelo de Dados e Regras de Negócio v1.0

**Projeto:** Serenar Bem-Estar
**Responsável técnico:** 44CODE — Soluções em Tecnologia
**Status:** Arquitetura aprovada para detalhamento técnico
**Safe Point:** `a94b8e2` — `fix: rename AI assistant to Serenar`

## 1. Objetivo

Evoluir o Serenar existente, sem criar sistema paralelo, para centralizar:

- clientes;
- ficha cadastral;
- anamnese profissional versionada;
- histórico de atendimentos;
- agendamentos;
- consentimentos;
- evolução segura da IA Serenar.

O cliente será a entidade central do domínio.

## 2. Princípios arquiteturais congelados

1. Uma pessoa deve possuir uma única ficha.
2. UUID será a chave técnica.
3. CPF será identificador de negócio e único quando informado.
4. Nome da mãe fará parte da identificação complementar.
5. O cadastro do cliente não dependerá de conta em auth.users.
6. profiles continuará representando usuários autenticados.
7. leads continuará representando pessoas interessadas ainda não convertidas em clientes.
8. appointments será relacionado a clients sem perder registros existentes.
9. Histórico profissional nunca será sobrescrito.
10. A IA Serenar nunca acessará o banco diretamente.
11. Operações sensíveis seguirão: interface → Server Function → validação → repository ou RPC → banco.
12. A fundação deverá crescer sem engessamento e sem precisar ser refeita.

## 3. Entidade central: clients

A tabela clients representará a pessoa atendida pelo Serenar, independentemente de possuir conta autenticada.

### 3.1 Responsabilidade

- centralizar a identidade do cliente;
- evitar fichas duplicadas;
- relacionar agendamentos, anamneses, atendimentos, preferências e consentimentos;
- preservar o histórico de relacionamento;
- permitir futura vinculação opcional com auth.users.

### 3.2 Campos previstos

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| auth_user_id | UUID opcional | Vínculo futuro com auth.users, sem tornar login obrigatório |
| full_name | texto | Obrigatório |
| cpf | texto | Obrigatório para consolidar a ficha; único após normalização |
| birth_date | data | Obrigatório |
| mother_name | texto | Identificação complementar mínima da ficha |
| phone | texto | Obrigatório |
| whatsapp | texto opcional | Canal principal quando diferente do telefone |
| email | texto opcional | Contato complementar |
| city | texto opcional | Cidade de residência |
| profession | texto opcional | Informação cadastral |
| status | enum | registered, active, inactive ou archived |
| source | texto | Origem do relacionamento |
| notes | texto opcional | Observações administrativas gerais, sem misturar dados clínicos |
| created_at | timestamptz | Criação automática |
| updated_at | timestamptz | Atualização automática |
| deleted_at | timestamptz opcional | Arquivamento lógico; sem exclusão física direta |

### 3.3 Regras de identificação

1. CPF será armazenado em formato normalizado, somente com dígitos.
2. CPF deverá passar por validação algorítmica antes da persistência.
3. A unicidade do CPF deverá considerar apenas registros não arquivados quando a estratégia física for definida.
4. Nome da mãe não substituirá CPF, mas servirá como confirmação complementar.
5. Nome, data de nascimento, telefone e nome da mãe poderão auxiliar na análise manual de possíveis duplicidades.
6. CPF não será exposto em consultas públicas, logs comuns, mensagens da IA ou respostas do frontend.

### 3.4 Relação com estruturas existentes

- profiles continuará representando o perfil de uma conta autenticada;
- leads continuará representando interesse ainda não convertido;
- appointments passará a receber client_id sem perder os dados históricos atuais;
- ai_conversations poderá futuramente receber client_id quando houver identificação e consentimento válidos;
- user_consents continuará ligado a auth.users; consentimentos do CRM serão modelados separadamente para clientes sem login.

## 4. Responsáveis legais e clientes menores de idade

O Serenar deverá permitir o cadastro de clientes menores de idade sem misturar os dados da pessoa atendida com os dados do responsável legal.

### 4.1 Princípio de separação

- o cliente menor possuirá sua própria ficha;
- o responsável legal possuirá cadastro único;
- o vínculo entre ambos será registrado separadamente;
- consentimentos e autorizações serão associados ao responsável e ao cliente correspondente;
- anamnese e histórico de atendimento permanecerão vinculados à pessoa atendida.

### 4.2 Entidade guardians

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| full_name | texto | Nome completo do responsável |
| cpf | texto | Obrigatório, normalizado, validado e único |
| phone | texto | Contato obrigatório |
| whatsapp | texto opcional | Canal principal quando diferente do telefone |
| email | texto opcional | Contato complementar |
| created_at | timestamptz | Criação automática |
| updated_at | timestamptz | Atualização automática |
| deleted_at | timestamptz opcional | Arquivamento lógico |

### 4.3 Entidade client_guardians

A tabela client_guardians representará exclusivamente o vínculo entre cliente e responsável.

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| client_id | UUID | Referência obrigatória ao cliente menor ou dependente |
| guardian_id | UUID | Referência obrigatória ao responsável |
| relationship | texto controlado | Mãe, pai, tutor, guardião ou outro vínculo legal |
| is_primary | boolean | Indica o responsável principal |
| legal_authority_confirmed | boolean | Confirmação administrativa de responsabilidade |
| valid_from | timestamptz | Início da validade do vínculo |
| valid_until | timestamptz opcional | Término da validade quando aplicável |
| authorization_granted_at | timestamptz opcional | Data da autorização registrada |
| authorization_version | texto opcional | Versão do termo aceito |
| revoked_at | timestamptz opcional | Revogação quando aplicável |
| created_at | timestamptz | Criação automática |
| updated_at | timestamptz | Atualização automática |

### 4.4 Regras para menores

1. A idade será calculada a partir de birth_date; não haverá campo is_minor persistido.
2. Cliente menor deverá possuir ao menos um vínculo ativo em client_guardians antes da confirmação definitiva do atendimento.
3. O CPF do menor deverá ser informado quando disponível e aplicável.
4. A ausência de CPF do menor não permitirá duplicar fichas; nome completo, data de nascimento, nome da mãe e responsável deverão auxiliar a conferência.
5. A autorização do responsável deverá possuir data, versão do termo e possibilidade de revogação.
6. O responsável não será automaticamente tratado como cliente atendido.
7. Um mesmo guardian poderá estar vinculado a mais de um cliente.
8. Um cliente poderá possuir mais de um responsável, com apenas um vínculo principal ativo por vez.
9. Mudanças de guarda ou responsabilidade não apagarão vínculos históricos.

### 4.5 Nome da mãe

O campo mother_name permanecerá na ficha do cliente como identificação complementar mínima.

Ele não substituirá:

- CPF;
- data de nascimento;
- responsável legal;
- comprovação administrativa quando necessária.

Para clientes adultos, mother_name poderá permanecer sem preenchimento quando houver motivo legítimo ou impossibilidade de obtenção.

### 4.6 Segurança

- dados do responsável não serão expostos publicamente;
- CPF do responsável não será enviado à IA Serenar;
- somente administradores autorizados poderão consultar ou alterar responsáveis e vínculos legais;
- alterações em autorizações e vínculos deverão ser auditáveis;
- exclusão física direta não será permitida quando houver histórico relacionado.


## 5. Anamnese profissional versionada

A anamnese será uma estrutura própria, separada da tabela clients e do histórico de sessões.

Ela deverá representar a avaliação profissional utilizada no Serenar, com possibilidade de evolução sem sobrescrever versões anteriores.

### 5.1 Princípios

- a anamnese não será armazenada em uma coluna única de texto;
- perguntas e respostas terão estrutura própria;
- modelos poderão evoluir por versão;
- respostas antigas permanecerão vinculadas à versão utilizada;
- uma nova avaliação não apagará a anterior;
- dados sensíveis terão acesso restrito.

### 5.2 Entidade anamnesis_templates

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| name | texto | Nome do modelo |
| version | inteiro | Número da versão |
| description | texto opcional | Finalidade do modelo |
| active | boolean | Indica se pode ser usado em novas avaliações |
| created_by | UUID | Usuário administrativo responsável |
| created_at | timestamptz | Criação automática |
| retired_at | timestamptz opcional | Encerramento de uso sem apagar histórico |

### 5.3 Entidade anamnesis_questions

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| template_id | UUID | Referência ao modelo |
| question_key | texto | Identificador estável da pergunta |
| label | texto | Texto apresentado |
| field_type | texto controlado | text, textarea, boolean, number, date, single_choice, multiple_choice ou scale |
| options | jsonb opcional | Alternativas quando aplicável |
| required | boolean | Obrigatoriedade da resposta |
| display_order | inteiro | Ordem de exibição |
| help_text | texto opcional | Orientação complementar |
| active | boolean | Permite desativar sem apagar |
| created_at | timestamptz | Criação automática |

### 5.4 Entidade client_anamneses

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| client_id | UUID | Referência obrigatória ao cliente |
| template_id | UUID | Modelo e versão utilizados |
| status | texto controlado | draft, completed, reviewed ou superseded |
| filled_by | texto controlado | client, guardian ou professional |
| guardian_id | UUID opcional | Responsável quando aplicável |
| completed_at | timestamptz opcional | Conclusão do preenchimento |
| reviewed_by | UUID opcional | Profissional que revisou |
| reviewed_at | timestamptz opcional | Data da revisão |
| created_at | timestamptz | Criação automática |
| updated_at | timestamptz | Atualização automática enquanto estiver em rascunho |

### 5.5 Entidade anamnesis_answers

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| anamnesis_id | UUID | Referência à anamnese preenchida |
| question_id | UUID | Referência à pergunta da versão usada |
| answer | jsonb | Valor da resposta em formato compatível com o tipo do campo |
| created_at | timestamptz | Criação automática |
| updated_at | timestamptz | Permitido apenas enquanto a anamnese estiver em rascunho |

### 5.6 Regras de histórico

1. Anamnese concluída não será sobrescrita.
2. Correções posteriores deverão gerar nova versão ou registro de retificação auditável.
3. Nova avaliação do cliente criará novo registro em client_anamneses.
4. Perguntas removidas de versões futuras continuarão disponíveis no histórico antigo.
5. O sistema deverá exibir claramente qual versão do formulário foi utilizada.
6. Respostas de anamnese não serão enviadas integralmente à IA Serenar.
7. A IA somente poderá receber contexto mínimo, autorizado e necessário.

### 5.7 Preenchimento por menor de idade

- o responsável poderá preencher ou autorizar o preenchimento;
- guardian_id deverá registrar quem participou do processo;
- a profissional deverá revisar antes do atendimento quando necessário;
- a pessoa atendida continuará sendo o titular da anamnese.

### 5.8 Segurança

- somente administradores e profissionais autorizados terão acesso completo;
- cliente ou responsável só poderá acessar dados próprios por fluxo autenticado e autorizado;
- consultas públicas serão proibidas;
- alterações deverão respeitar RLS e auditoria;
- dados sensíveis não deverão aparecer em logs comuns ou mensagens de erro.

## 6. Atendimentos e histórico profissional

O histórico profissional será separado da ficha cadastral e da anamnese.

Cada atendimento realizado deverá gerar uma sessão própria, preservando o contexto daquele momento e permitindo acompanhar a evolução do cliente ao longo do tempo.

### 6.1 Entidade client_sessions

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| client_id | UUID | Referência obrigatória ao cliente |
| appointment_id | UUID opcional | Referência ao agendamento que originou a sessão |
| service_id | UUID opcional | Referência ao serviço cadastrado |
| professional_user_id | UUID | Profissional responsável |
| session_started_at | timestamptz | Data e horário de início |
| session_ended_at | timestamptz opcional | Data e horário de término |
| duration_minutes | inteiro opcional | Duração real da sessão |
| status | texto controlado | scheduled, in_progress, completed, cancelled ou no_show |
| client_report | texto opcional | Relato apresentado pelo cliente naquela sessão |
| professional_summary | texto opcional | Resumo profissional do atendimento |
| recommendations | texto opcional | Recomendações posteriores |
| created_at | timestamptz | Criação automática |
| updated_at | timestamptz | Atualização controlada |

### 6.2 Entidade session_notes

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| session_id | UUID | Referência obrigatória à sessão |
| note_type | texto controlado | observation, evolution, recommendation, correction ou administrative |
| content | texto | Conteúdo do registro |
| created_by | UUID | Usuário administrativo ou profissional responsável |
| created_at | timestamptz | Criação automática |
| supersedes_note_id | UUID opcional | Referência ao registro corrigido ou complementado |

### 6.3 Separação de responsabilidades

- clients armazenará identidade e informações cadastrais;
- client_anamneses armazenará avaliações estruturadas;
- client_sessions armazenará cada atendimento realizado;
- session_notes armazenará evolução, observações e correções vinculadas à sessão;
- appointments continuará representando solicitação, reserva e confirmação de horário.

### 6.4 Regras de histórico

1. Sessões concluídas não serão excluídas fisicamente.
2. Observações profissionais antigas não serão sobrescritas silenciosamente.
3. Correções deverão gerar novo registro vinculado ao anterior.
4. Cancelamentos e faltas permanecerão no histórico.
5. Um atendimento poderá existir sem appointment_id quando criado manualmente por administrador autorizado.
6. O serviço deverá preferencialmente ser referenciado por service_id.
7. O nome histórico do serviço poderá ser preservado em snapshot se necessário no modelo físico.
8. O histórico completo será acessível apenas a usuários autorizados.

### 6.5 Fluxo oficial

Cliente identificado

↓

Agendamento confirmado

↓

Sessão realizada

↓

Registro profissional

↓

Recomendações e evolução

↓

Histórico permanente do cliente

### 6.6 Segurança

- registros profissionais não serão retornados em consultas públicas;
- a IA Serenar não receberá notas integrais de sessão;
- somente contexto mínimo e autorizado poderá ser usado pela IA;
- RLS deverá restringir leitura e escrita por função administrativa;
- todas as alterações relevantes deverão ser auditáveis;
- mensagens de erro não deverão revelar conteúdo sensível.

## 7. Separação de Domínios

O projeto Serenar será organizado em domínios de negócio independentes, permitindo evolução sem acoplamento entre módulos.

Essa separação é conceitual e arquitetural, não implicando necessariamente bancos distintos.

### 7.1 Domínio CRM

Responsável pelo relacionamento com clientes.

- clients;
- leads;
- client_guardians;
- contatos;
- preferências;
- consentimentos administrativos;
- documentos cadastrais;
- auditoria administrativa.

### 7.2 Domínio Clínico

Responsável exclusivamente pelas informações profissionais de atendimento.

- anamnesis_templates;
- anamnesis_questions;
- client_anamneses;
- anamnesis_answers;
- client_sessions;
- session_notes;
- evolução clínica;
- protocolos;
- anexos clínicos.

### 7.3 Domínio Agenda

Responsável pela disponibilidade e marcação de horários.

- calendar_slots;
- slot_templates;
- slot_exceptions;
- appointments;
- confirmações;
- cancelamentos;
- reagendamentos.

### 7.4 Domínio IA Serenar

Responsável pelo funcionamento da assistente virtual.

- ai_conversations;
- ai_knowledge;
- memória autorizada;
- contexto mínimo permitido;
- integrações futuras.

### 7.5 Regra Arquitetural Permanente

Nenhum domínio poderá acessar diretamente tabelas internas de outro domínio ignorando as regras de negócio.

Toda comunicação entre módulos deverá ocorrer por meio da arquitetura oficial do projeto:

Interface
↓
Server Function
↓
Validação
↓
Repository ou RPC
↓
Banco de Dados

Essa regra passa a ser considerada permanente para todas as futuras evoluções do Serenar.

## 8. Documentos seguros e anexos

Os documentos do cliente constituem uma capacidade transversal da arquitetura do Serenar.

Eles poderão ser utilizados pelos domínios CRM e Profissional sem criar dependência direta entre suas tabelas.

### 8.1 Objetivos

- centralizar anexos em um único modelo;
- evitar duplicação de arquivos;
- manter rastreabilidade;
- garantir segurança e conformidade com a LGPD;
- impedir acesso direto da IA Serenar aos documentos.

### 8.2 Entidade client_documents

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária |
| client_id | UUID | Cliente proprietário do documento |
| document_type | texto controlado | Tipo do documento |
| storage_path | texto | Caminho interno do Storage |
| original_filename | texto | Nome enviado pelo usuário |
| mime_type | texto | Tipo MIME |
| file_size | inteiro | Tamanho em bytes |
| related_entity_type | texto | Entidade relacionada (anamnese, sessão, consentimento, responsável etc.) |
| related_entity_id | UUID opcional | Registro relacionado |
| uploaded_by | UUID | Usuário responsável pelo envio |
| created_at | timestamptz | Criação automática |
| archived_at | timestamptz opcional | Arquivamento lógico |

### 8.3 Regras permanentes

1. Arquivos permanecerão em bucket privado.
2. O banco armazenará apenas metadados.
3. O acesso ocorrerá exclusivamente por Server Functions autorizadas.
4. URLs assinadas serão temporárias.
5. Nenhum documento será enviado automaticamente à IA Serenar.
6. Toda consulta ou alteração relevante deverá ser auditável.
7. Exclusões físicas deverão respeitar a política de retenção definida pelo sistema.

## 9. Consentimentos, autorizações e memória da IA Serenar

Os consentimentos do CRM serão registrados por finalidade específica, com histórico, versão do termo, responsável pela concessão e possibilidade de revogação quando aplicável.

A autorização necessária para atendimento não implicará autorização automática para marketing, armazenamento de documentos ou memória da IA Serenar.

### 9.1 Entidade client_consents

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| client_id | UUID | Cliente titular dos dados |
| guardian_id | UUID opcional | Responsável legal que concedeu a autorização |
| consent_type | texto controlado | Finalidade específica do consentimento |
| granted | boolean | Estado concedido ou negado |
| legal_basis | texto controlado | Base jurídica ou operacional aplicável |
| term_version | texto | Versão exata do termo apresentado |
| term_hash | texto opcional | Identificador de integridade do conteúdo aceito |
| collection_channel | texto controlado | website, admin, authenticated_portal, document ou other |
| evidence_document_id | UUID opcional | Documento ou termo assinado relacionado |
| granted_at | timestamptz | Data da concessão ou recusa |
| revoked_at | timestamptz opcional | Data da revogação |
| expires_at | timestamptz opcional | Validade quando aplicável |
| recorded_by | UUID opcional | Usuário administrativo que registrou o evento |
| created_at | timestamptz | Criação automática |

### 9.2 Tipos iniciais de consentimento

- data_processing: tratamento de dados necessários ao cadastro e relacionamento;
- service_authorization: autorização para realização do atendimento;
- guardian_authorization: autorização do responsável legal;
- document_storage: armazenamento de documentos e anexos;
- ai_memory: memória controlada da IA Serenar;
- marketing: comunicações promocionais e informativas;
- image_use: uso específico de imagem quando autorizado;
- testimonial_use: publicação de depoimento autorizado.

### 9.3 Regras permanentes

1. Cada finalidade deverá possuir consentimento independente.
2. A recusa de marketing não impedirá o atendimento.
3. A recusa de memória da IA não impedirá cadastro, agendamento ou atendimento.
4. Consentimento revogado não será apagado; permanecerá no histórico com revoked_at.
5. Nova versão de termo exigirá novo registro quando houver mudança material.
6. Consentimentos não poderão ser presumidos por silêncio, campo pré-marcado ou uso de outra funcionalidade.
7. A autorização de responsável legal deverá estar vinculada ao cliente menor correspondente.
8. Operações estritamente necessárias ao agendamento poderão utilizar base adequada sem serem tratadas como marketing ou memória da IA.
9. O sistema deverá exibir de forma clara a finalidade de cada autorização.

### 9.4 Memória da IA Serenar

A memória da IA Serenar será uma funcionalidade opcional e separada.

Sem consentimento ai_memory ativo, a Serenar poderá responder usando apenas:

- conteúdo público;
- dados informados na conversa atual;
- informações operacionais estritamente necessárias para concluir a solicitação em andamento.

Com consentimento ai_memory ativo, o sistema poderá disponibilizar à IA somente contexto previamente filtrado e autorizado.

A IA não receberá diretamente:

- CPF;
- documentos pessoais;
- arquivos anexados;
- anamnese integral;
- notas profissionais integrais;
- dados de responsáveis legais que não sejam necessários ao fluxo.

### 9.5 Contexto permitido para a IA

O contexto autorizado poderá conter, quando necessário:

- primeiro nome;
- preferências de atendimento não sensíveis;
- serviços anteriormente realizados;
- canal preferido de comunicação;
- resumo operacional seguro;
- consentimentos ativos relevantes ao fluxo.

Todo contexto deverá ser construído por Server Function específica, com filtragem e validação antes do envio ao provedor de IA.

### 9.6 Menores de idade

- consentimentos de menores dependerão do responsável legal quando exigido;
- guardian_id identificará quem concedeu a autorização;
- memória da IA para menor não será ativada automaticamente;
- autorizações de atendimento, documentos, imagem e IA permanecerão independentes;
- a revogação do responsável deverá interromper novos usos dependentes daquela autorização.

### 9.7 Relação com user_consents existente

A tabela user_consents continuará atendendo consentimentos vinculados diretamente a auth.users.

client_consents atenderá clientes com ou sem conta autenticada.

Quando houver auth_user_id em clients, o modelo físico deverá impedir registros contraditórios e definir uma fonte oficial para cada finalidade, sem apagar o histórico já existente.

### 9.8 Segurança e auditoria

- consultas públicas serão proibidas;
- somente fluxos autorizados poderão criar ou revogar consentimentos;
- o frontend não poderá alterar consentimentos sensíveis diretamente no banco;
- registros deverão ser imutáveis, exceto pelo preenchimento controlado de revogação;
- toda alteração relevante deverá gerar trilha de auditoria;
- mensagens de erro não deverão revelar dados pessoais ou o conteúdo dos termos.

## 10. Auditoria transversal

A auditoria será uma capacidade transversal do Serenar, aplicável aos domínios CRM, Profissional, Agenda, Documentos e IA.

Ela deverá permitir identificar quem realizou determinada ação, quando ocorreu e qual entidade foi afetada, sem expor dados sensíveis desnecessariamente.

### 10.1 Entidade audit_logs

| Campo | Tipo conceitual | Regra |
|---|---|---|
| id | UUID | Chave primária técnica |
| actor_user_id | UUID opcional | Usuário autenticado responsável pela ação |
| actor_type | texto controlado | admin, professional, client, guardian, system ou ai_service |
| action | texto controlado | create, update, archive, restore, revoke, view_sensitive, export ou other |
| entity_type | texto | Tipo da entidade afetada |
| entity_id | UUID opcional | Registro afetado |
| client_id | UUID opcional | Cliente relacionado, quando aplicável |
| metadata | jsonb | Contexto técnico mínimo e não sensível |
| request_id | texto opcional | Identificador de correlação da requisição |
| ip_hash | texto opcional | Identificador técnico derivado, quando necessário e permitido |
| user_agent_summary | texto opcional | Resumo técnico reduzido |
| created_at | timestamptz | Criação automática e imutável |

### 10.2 Eventos mínimos auditáveis

- criação, alteração, arquivamento e restauração de clientes;
- criação e alteração de responsáveis e vínculos legais;
- conclusão, revisão e retificação de anamneses;
- criação e correção de registros profissionais;
- upload, consulta sensível, arquivamento e exclusão controlada de documentos;
- concessão e revogação de consentimentos;
- exportação de dados;
- mudanças de status em agendamentos e sessões;
- acesso administrativo a dados sensíveis quando justificável;
- ações executadas por Server Functions, RPCs ou serviços internos.

### 10.3 Regras permanentes

1. Registros de auditoria serão imutáveis.
2. Audit logs não armazenarão CPF, anamnese integral, notas profissionais integrais ou conteúdo completo de documentos.
3. Alterações sensíveis deverão registrar ação, entidade, ator e horário.
4. A ausência de usuário autenticado deverá identificar o ator como system, client, guardian ou ai_service conforme o fluxo validado.
5. Logs não substituirão o histórico de negócio das entidades.
6. Acesso aos audit_logs será restrito a administradores autorizados.
7. A retenção dos logs será definida antes da implementação física.
8. Falhas na gravação de auditoria para operações críticas deverão impedir a conclusão da operação quando tecnicamente seguro.

### 10.4 IA Serenar

- a IA não terá acesso aos audit_logs;
- ações disparadas por ferramentas da IA deverão usar actor_type ai_service;
- o sistema deverá registrar somente a ação executada, sem armazenar conteúdo sensível da conversa no log;
- consentimento e autorização continuarão sendo verificados antes de qualquer ação.

### 10.5 Segurança

- inserções serão realizadas apenas por funções autorizadas;
- updates e deletes diretos serão proibidos;
- consultas serão protegidas por RLS;
- metadados serão validados e limitados;
- erros não revelarão o conteúdo dos registros de auditoria.

## 11. Fluxos oficiais de integração

Os fluxos deverão integrar os domínios existentes sem criar cadastros paralelos, sem expor dados sensíveis e sem quebrar o pré-agendamento atual.

### 11.1 Página pública de agendamento

A rota /agendamento continuará utilizando o fluxo protegido por Turnstile, Server Function e RPC.

O formulário deverá incluir, no mínimo:

- nome completo;
- CPF;
- data de nascimento;
- nome da mãe;
- telefone;
- email opcional;
- serviço;
- data e horário;
- observações;
- dados do responsável legal quando a pessoa atendida for menor.

Fluxo oficial:

Cliente preenche o formulário

↓

Validação de campos e CPF

↓

Verificação Turnstile

↓

Server Function de pré-agendamento

↓

Localização segura de cliente existente

↓

Criação ou vinculação da ficha

↓

Criação do pré-agendamento

↓

Vinculação de appointments.client_id

↓

Confirmação administrativa posterior

### 11.2 Identificação de cliente no agendamento

1. O CPF será normalizado e validado no servidor.
2. A busca principal será realizada pelo CPF.
3. Nome, data de nascimento e nome da mãe deverão ser comparados para reduzir vínculos incorretos.
4. Divergências relevantes não serão corrigidas automaticamente; deverão gerar revisão administrativa.
5. O frontend não receberá a ficha completa de um cliente localizado.
6. A resposta pública será genérica e não confirmará a existência prévia de cadastro.
7. A criação ou vinculação deverá ocorrer na mesma operação transacional do pré-agendamento quando o modelo físico permitir.

### 11.3 Compatibilidade com appointments existente

A tabela appointments continuará preservando os campos históricos atuais:

- full_name;
- phone;
- email;
- service;
- preferred_date;
- preferred_time;
- notes.

Será adicionado client_id como referência ao cadastro oficial.

Os campos textuais existentes funcionarão como snapshot histórico do momento da solicitação e não serão apagados na primeira migração.

### 11.4 Cliente menor de idade

Quando birth_date indicar idade inferior a dezoito anos, o fluxo deverá solicitar:

- nome completo do responsável;
- CPF do responsável;
- telefone;
- email opcional;
- vínculo com o menor;
- autorização correspondente.

O sistema deverá localizar ou criar guardians e registrar o vínculo em client_guardians antes da confirmação definitiva do atendimento.

### 11.5 IA Serenar como ponto de entrada

A interface do chat Serenar poderá auxiliar no cadastro e no agendamento, mas não acessará diretamente as tabelas do CRM.

Fluxo oficial:

Pessoa conversa com Serenar

↓

IA identifica a intenção

↓

Solicita apenas os dados necessários

↓

Ferramenta autorizada chama Server Function

↓

Validação de identidade, finalidade e consentimento

↓

Operação permitida no CRM ou na Agenda

↓

Resposta segura e sem exposição de dados

### 11.6 Campo de mensagem da IA Serenar

A experiência atual baseada em perguntas prontas deverá evoluir para conversa livre, mantendo opções rápidas apenas como apoio.

O campo de mensagem deverá permitir que a pessoa:

- escreva sua necessidade livremente;
- informe intenção de agendar;
- solicite orientação sobre serviços;
- peça retorno de atendimento anterior;
- seja encaminhada para a Mariah quando necessário.

A IA deverá perguntar somente o necessário para cada intenção e nunca solicitar CPF sem finalidade clara.

### 11.7 Identificação pela IA

Quando a pessoa solicitar acesso a contexto pessoal ou retorno de atendimento, a IA poderá iniciar um fluxo seguro de identificação.

Esse fluxo deverá:

1. explicar por que a identificação é necessária;
2. coletar os dados por ferramenta própria, e não dentro do prompt comum;
3. validar os dados em Server Function;
4. não devolver CPF ou dados cadastrais ao modelo de IA;
5. retornar apenas um identificador temporário de contexto autorizado;
6. expirar o contexto ao final da sessão ou conforme política definida.

### 11.8 Operações permitidas à IA

A IA poderá, por ferramentas autorizadas:

- consultar serviços públicos;
- consultar disponibilidade pública;
- iniciar pré-agendamento;
- registrar interesse como lead;
- consultar preferências não sensíveis quando houver consentimento;
- solicitar atendimento humano;
- fornecer resumo operacional seguro.

A IA não poderá:

- consultar ou revelar CPF;
- acessar anamnese integral;
- acessar notas profissionais integrais;
- abrir documentos;
- alterar histórico profissional;
- conceder consentimento em nome da pessoa;
- confirmar atendimento sem a regra administrativa correspondente.

### 11.9 Painel administrativo

O painel deverá ganhar a área Admin → Clientes.

A ficha administrativa será composta por abas:

- Cadastro;
- Responsáveis;
- Agendamentos;
- Anamnese;
- Atendimentos;
- Preferências;
- Documentos;
- Consentimentos;
- Auditoria permitida.

O painel deverá priorizar clareza operacional e ocultar detalhes técnicos de banco, Storage e integrações.

### 11.10 Regras transacionais

1. A criação de cliente e pré-agendamento não poderá gerar registros órfãos.
2. Falhas após a reserva do slot deverão liberar ou preservar o slot conforme a regra transacional oficial.
3. Operações críticas deverão ser idempotentes quando houver risco de reenvio.
4. Nenhum fluxo público utilizará service_role no navegador.
5. Respostas de erro públicas serão genéricas.
6. Detalhes técnicos permanecerão somente em logs protegidos.
7. Alterações relevantes deverão gerar auditoria.

## 12. Modelo de Relacionamentos — ERD Conceitual

O ERD conceitual define as relações oficiais entre os domínios do Serenar antes da criação do modelo físico PostgreSQL.

### 12.1 Visão geral

auth.users
    |
    | 0..1
    ↓
profiles

auth.users
    |
    | 0..1
    ↓
clients

clients
    ├── 1:N appointments
    ├── 1:N client_anamneses
    ├── 1:N client_sessions
    ├── 1:N client_consents
    ├── 1:N client_documents
    ├── 1:N client_preferences
    ├── 1:N ai_conversations autorizadas
    └── N:N guardians por meio de client_guardians

### 12.2 Identidade e autenticação

- auth.users poderá possuir um profile;
- auth.users poderá estar vinculado a um client;
- client não dependerá de auth.users;
- profile não substituirá client;
- auth_user_id em clients será opcional e único quando informado.

Cardinalidades:

- auth.users 1:0..1 profiles;
- auth.users 1:0..1 clients;
- clients 0..1:1 auth.users.

### 12.3 Leads e clientes

- leads representará interesse ainda não convertido;
- clients representará pessoa com ficha consolidada;
- um lead poderá originar no máximo um cliente;
- a conversão não apagará o lead;
- lead convertido deverá guardar referência ao client correspondente.

Cardinalidade:

- leads 0..1:1 clients.

### 12.4 Clientes e responsáveis legais

- guardians armazenará o cadastro único do responsável;
- client_guardians armazenará exclusivamente o vínculo;
- um guardian poderá responder por vários clientes;
- um cliente poderá possuir vários responsáveis;
- apenas um vínculo principal ativo será permitido por cliente.

Cardinalidades:

- clients 1:N client_guardians;
- guardians 1:N client_guardians;
- clients N:N guardians por meio de client_guardians.

### 12.5 Clientes e agendamentos

- cada appointment poderá estar vinculado a um client;
- um client poderá possuir vários appointments;
- registros históricos existentes poderão permanecer temporariamente sem client_id;
- novos pré-agendamentos deverão criar ou localizar o cliente dentro do fluxo oficial.

Cardinalidade:

- clients 1:N appointments;
- appointments N:0..1 clients durante a transição;
- appointments N:1 clients após consolidação futura.

### 12.6 Agenda e serviços

- calendar_slots representará disponibilidade;
- appointments utilizará um calendar_slot quando o fluxo exigir reserva de horário;
- services continuará sendo o catálogo oficial;
- appointment poderá manter snapshot textual do serviço;
- client_sessions deverá preferencialmente referenciar services.

Cardinalidades:

- services 1:N appointments;
- services 1:N client_sessions;
- calendar_slots 1:0..1 appointments ativos;
- appointments 0..1:1 calendar_slots.

### 12.7 Anamnese

- anamnesis_templates possuirá várias perguntas;
- cada client_anamnesis utilizará exatamente um template;
- cada client_anamnesis possuirá várias respostas;
- cada resposta apontará para uma pergunta da versão utilizada;
- um cliente poderá possuir várias anamneses ao longo do tempo.

Cardinalidades:

- anamnesis_templates 1:N anamnesis_questions;
- clients 1:N client_anamneses;
- anamnesis_templates 1:N client_anamneses;
- client_anamneses 1:N anamnesis_answers;
- anamnesis_questions 1:N anamnesis_answers;
- guardians 1:N client_anamneses quando filled_by for guardian.

### 12.8 Atendimentos e histórico profissional

- cada client_session pertencerá a um cliente;
- uma sessão poderá ser originada por um appointment;
- uma sessão poderá possuir várias notas profissionais;
- uma nota poderá corrigir ou complementar outra nota;
- uma sessão deverá referenciar o profissional responsável.

Cardinalidades:

- clients 1:N client_sessions;
- appointments 1:0..1 client_sessions;
- services 1:N client_sessions;
- client_sessions 1:N session_notes;
- session_notes 0..1:N session_notes por supersedes_note_id;
- auth.users 1:N client_sessions como professional_user_id.

### 12.9 Consentimentos

- cada consentimento pertencerá a um cliente;
- o consentimento poderá ter sido concedido por um guardian;
- um documento poderá comprovar determinado consentimento;
- consentimentos serão históricos e não substituídos.

Cardinalidades:

- clients 1:N client_consents;
- guardians 1:N client_consents quando aplicável;
- client_documents 1:0..N client_consents como evidência.

### 12.10 Documentos

- todo documento pertencerá a um cliente;
- um documento poderá se relacionar a anamnese, sessão, consentimento, responsável ou outro registro autorizado;
- o arquivo físico permanecerá no Storage privado;
- o banco armazenará somente metadados e relacionamentos.

Cardinalidades:

- clients 1:N client_documents;
- client_anamneses 1:N client_documents quando relacionados;
- client_sessions 1:N client_documents quando relacionados;
- client_consents 1:N client_documents quando relacionados;
- guardians 1:N client_documents quando relacionados.

### 12.11 IA Serenar

- ai_conversations continuará vinculada a auth.users quando houver conta;
- poderá receber client_id opcional após identificação segura;
- memória somente será utilizada com consentimento ativo;
- contexto autorizado será construído por Server Function;
- a IA não possuirá FK ou acesso direto a anamnese, notas, documentos ou CPF.

Cardinalidades:

- auth.users 1:N ai_conversations;
- clients 1:N ai_conversations quando identificadas;
- client_consents 1:N usos autorizados de memória, sem acesso direto pela IA.

### 12.12 Preferências

- preferências não sensíveis pertencerão ao cliente;
- preferências clínicas não serão armazenadas como simples preferências;
- alterações poderão manter histórico conforme decisão do modelo físico;
- a IA somente poderá consultar preferências autorizadas.

Cardinalidade:

- clients 1:N client_preferences.

### 12.13 Auditoria

- audit_logs poderá referenciar qualquer entidade por entity_type e entity_id;
- client_id será preenchido quando a ação estiver relacionada a cliente;
- audit_logs não utilizará cascade delete;
- nenhuma entidade dependerá de audit_logs para existir.

Cardinalidade:

- clients 1:N audit_logs quando aplicável;
- auth.users 1:N audit_logs como ator autenticado;
- entidades auditadas 1:N audit_logs por referência lógica.

### 12.14 Regras de integridade

1. Chaves estrangeiras não deverão apagar histórico profissional por cascade.
2. Soft delete ou arquivamento será preferido para entidades com histórico.
3. Tabelas de vínculo deverão impedir duplicidades ativas.
4. Relações opcionais durante a migração poderão se tornar obrigatórias após consolidação.
5. FKs para auth.users deverão usar ON DELETE SET NULL ou estratégia equivalente quando o histórico precisar permanecer.
6. FKs de respostas para perguntas e templates deverão preservar versões históricas.
7. Documentos e auditoria não serão apagados automaticamente pela exclusão lógica do cliente.
8. Toda cardinalidade deverá ser traduzida em constraints, índices e políticas RLS no modelo físico.

### 12.15 Ordem de dependência conceitual

1. clients e guardians;
2. client_guardians;
3. client_preferences, client_documents e client_consents;
4. integração de appointments com clients;
5. anamnesis_templates e anamnesis_questions;
6. client_anamneses e anamnesis_answers;
7. client_sessions e session_notes;
8. infraestrutura de storage privado e buckets seguros;
9. integração segura da IA Serenar;
10. audit_logs e eventos transversais.


## 13. Modelo Físico PostgreSQL

Esta seção transforma o modelo conceitual em especificação técnica para PostgreSQL/Supabase.

Nenhuma migration deverá ser escrita antes da conclusão desta seção.

### 13.1 Diretrizes gerais

- utilizar UUID como chave primária em todas as entidades;
- preferir timestamptz para registros temporais;
- utilizar jsonb apenas quando a estrutura justificar flexibilidade;
- evitar duplicação de dados entre tabelas;
- preservar histórico por meio de arquivamento lógico sempre que aplicável;
- definir constraints e índices antes da implementação física;
- manter compatibilidade com o Serenar atualmente em produção.

### 13.2 Convenções do modelo físico

As migrations do Serenar CRM deverão seguir estas convenções:

1. Tabelas e colunas usarão snake_case em inglês.
2. Chaves primárias usarão UUID com gen_random_uuid().
3. Todas as Foreign Keys terão ON DELETE definido explicitamente.
4. created_at e updated_at usarão timestamptz com default now().
5. Entidades históricas utilizarão arquivamento lógico quando aplicável.
6. Índices serão definidos junto com cada tabela.
7. RLS será habilitada desde a criação das tabelas sensíveis.
8. Nenhuma operação pública acessará tabelas diretamente.
