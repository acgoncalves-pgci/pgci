# Matriz de Validação — Fase 0 do Plano 2

**Status:** aprovada em 16/09/2026  
**Origem:** `plano-2.md` — primeiro passo executável  
**Finalidade:** fechar regras de negócio antes de migração, telas e permissões. Os valores marcados como **Proposta** só se tornam regra após aprovação.

## 1. Resultado esperado desta validação

A aprovação desta matriz deve entregar quatro definições implementáveis:

1. Estrutura organizacional e vínculos de usuários com unidades.
2. Matriz de status, ações, justificativas e permissões.
3. Catálogo de tipos de protocolo, fluxos e fases atribuídas.
4. Políticas de anexos, consulta externa e assinatura eletrônica.

Nenhuma alteração de regra deve ser implementada enquanto o respectivo item estiver pendente de aprovação.

## 2. Estrutura organizacional e contexto de unidade

| Decisão | Proposta para validação | Status |
| --- | --- | --- |
| Estrutura | Árvore de unidades com raiz e quantidade ilimitada de subníveis. | Aprovada |
| Identificação | Unidade possui ID estável, nome, sigla, situação, unidade-pai opcional e posição. A numeração visual (`1.`, `1.1.`) é calculada pela posição, não é o ID. | Aprovada |
| Movimentação | Administrador autorizado pode reordenar, subordinar uma unidade a outra ou movê-la para a raiz. Toda movimentação gera auditoria. | Aprovada |
| Integridade | Não permitir ciclos, inativar unidade com vínculos ativos sem orientar a transferência e nunca apagar históricos de protocolos. | Aprovada |
| Usuários | Um usuário pode ter vários vínculos ativos, cada um com unidade, papel, cargo/assinatura e vigência própria. | Aprovada |
| Contexto | O usuário escolhe um vínculo válido para operar. Ter vínculo na unidade-pai não concede acesso automático a descendentes, nem o inverso. | Aprovada |
| Encaminhamento | A lista de destino vem da mesma árvore e respeita o contexto, o fluxo e a permissão do ator. | Aprovada |

**Confirmações necessárias:** quem pode mover/inativar unidades; se determinada unidade deve enxergar seus descendentes; e a política para protocolos em andamento quando uma unidade muda de posição ou é inativada.

## 3. Papéis e permissões

A tabela abaixo é uma base para validar as permissões granularmente. “Conforme fluxo” significa que a ação também depende do status, fase, contexto de unidade e vínculo do usuário.

| Domínio | Administrador | Gestor | Operador | Leitor |
| --- | --- | --- | --- | --- |
| Consultar protocolos do contexto | Sim | Sim | Sim | Sim |
| Abrir protocolo | Sim | Sim | Sim | Não |
| Editar antes do primeiro encaminhamento | Sim | Conforme fluxo | Conforme fluxo | Não |
| Encaminhar/designar destinatário | Sim | Conforme fluxo | Conforme fluxo | Não |
| Cancelar, rejeitar/devolver, reabrir, concluir, arquivar | Sim | Conforme fluxo | Conforme fluxo | Não |
| Excluir permanentemente antes do encaminhamento | Conforme política D-04 | Não por padrão | Não por padrão | Não |
| Gerir anexos, checklists e documentos | Sim | Conforme fluxo | Conforme fluxo | Somente visualizar, quando autorizado |
| Gerir tipos, fluxos e fases | Sim | Conforme política | Não por padrão | Não |
| Gerir usuários, unidades e vínculos | Sim | Conforme política | Não | Não |
| Relatórios e operações em lote | Sim | Conforme política | Conforme política | Somente relatórios liberados |

**Confirmações necessárias:** permissões efetivas do Gestor e Operador; se existe um perfil adicional; e se permissões individuais podem complementar/restringir o papel do vínculo.

## 4. Status, ações e transições

A nomenclatura abaixo consolida os estados citados no material de referência. A equivalência com os estados atuais deve ser migrada apenas após aprovação.

| Status proposto | Entra por | Pode seguir para | Justificativa obrigatória |
| --- | --- | --- | --- |
| Cadastrado | Abertura do protocolo | Em tramitação, Cancelado, Arquivado | Não |
| Em tramitação | Encaminhamento ou aceite em fase ativa | Em tramitação, Concluído, Rejeitado/Devolvido, Cancelado, Arquivado | Conforme ação |
| Rejeitado/Devolvido | Recusa com retorno ao remetente/origem | Em tramitação, Cancelado, Arquivado | Sim |
| Concluído | Encerramento regular do fluxo | Reaberto, Arquivado | Sim, se o fluxo exigir |
| Reaberto | Reabertura de protocolo concluído | Em tramitação, Concluído, Arquivado | Sim |
| Cancelado | Cancelamento autorizado | Arquivado ou consulta histórica | Sim |
| Arquivado | Arquivamento administrativo | Reaberto, se permitido | Sim, se o fluxo exigir |

**Regras a aprovar:**

- Todo encaminhamento cria evento com origem, destino, ator, data/hora e eventual motivo.
- Alteração de destinatário exige motivo e auditoria.
- Ação de “visualizar” só confirma leitura após comando explícito do destinatário.
- Exclusão física só pode existir antes do primeiro encaminhamento, conforme D-04, e não pode romper a auditoria exigida pela instituição.
- Os nomes atuais eventualmente existentes devem ser mapeados para a taxonomia aprovada; não haverá duplicação de status equivalentes.

## 5. Modelo explícito: tipo de protocolo → fluxo → fases

Cada protocolo nasce com um **tipo**. O tipo aponta para um **fluxo** ativo. O fluxo contém uma sequência ordenada de **fases**. A atribuição não é implícita: deve ficar cadastrada e auditável.

```text
Tipo de Protocolo
  └── Fluxo ativo (versão)
        ├── Fase 1 — ordem 1
        ├── Fase 2 — ordem 2
        └── Fase N — ordem N
```

| Entidade | Responsabilidade | Campos mínimos |
| --- | --- | --- |
| Tipo de protocolo | Define a experiência de abertura e o fluxo aplicável. | Nome, código, ativo, assunto obrigatório/opcional, descrição obrigatória, regra de anexo, modelo de texto, `fluxoId`. |
| Fluxo | Define o caminho processual versionado de um ou mais tipos. | Nome, versão, ativo, data de vigência, regra de início e regra de conclusão. |
| Fase | Define uma etapa reutilizável do processo. | Nome, código, ativo, responsável/unidade elegível, prazo quando aplicável, checklist e arquivos exigidos. |
| Atribuição fluxo-fase | Vincula e ordena fases dentro de um fluxo. | `fluxoId`, `faseId`, ordem, obrigatória, condições de entrada/saída, responsáveis permitidos. |
| Transição | Define o avanço, retorno, rejeição ou encerramento entre fases. | Fase origem, ação, fase destino/status, permissão exigida, justificativa e validações. |

### 5.1 Cadastro que deve existir na interface

1. Cadastro de fases: criar, editar, ativar/inativar, definir responsável elegível, checklist, arquivos obrigatórios e prazo.
2. Cadastro de fluxos: criar fluxo, atribuir fases existentes, ordenar fases, definir entradas/saídas e publicar uma versão.
3. Cadastro de tipos: criar tipo e atribuir exatamente um fluxo ativo; validar campos condicionais e requisitos de abertura.
4. Histórico: um protocolo já aberto mantém a versão do fluxo com a qual iniciou, mesmo que o fluxo seja alterado depois.

### 5.2 Matriz para preenchimento e aprovação

O catálogo real de tipos e fases não foi fornecido nos PDFs. A tabela deve ser preenchida pelo responsável funcional antes da implementação.

| Tipo de protocolo | Código | Fluxo atribuído | Versão | Fases em ordem | Unidade/papel responsável por fase | Anexo obrigatório | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _Preencher_ | _Preencher_ | _Preencher_ | _Preencher_ | _Fase 1 → Fase N_ | _Preencher_ | _Sim/Não_ | _Ativo/Inativo_ |

**Confirmações necessárias:** tipos iniciais, catálogo de fases, fluxo padrão, possibilidade de um fluxo ser reutilizado por vários tipos e política de versão/publicação.

## 5.3 Preenchimento inicial — catálogo piloto do projeto

Os itens desta seção foram extraídos dos tipos de protocolo de **demonstração** já presentes no projeto. Fluxos, fases e responsáveis abaixo são uma **Proposta** para discussão; não representam a estrutura oficial da prefeitura e não devem ser implementados como regra definitiva sem aprovação.

| Código do tipo | Tipo existente | Fluxo piloto atribuído | Fases ordenadas propostas | Responsável proposto | Anexo obrigatório | Situação |
| --- | --- | --- | --- | --- | --- | --- |
| `pt-admin` | Solicitação administrativa | FL-01 Administrativo v0.1 | 1. Triagem; 2. Atendimento pela unidade de destino; 3. Conclusão | Protocolo Geral → unidade escolhida → responsável atual | Não | Proposta |
| `pt-buy` | Compra de material | FL-02 Compras v0.1 | 1. Triagem; 2. Análise administrativa; 3. Conclusão | Protocolo Geral → Administração → responsável atual | Não | Proposta |
| `pt-info` | Pedido de informação | FL-03 Informação v0.1 | 1. Triagem; 2. Atendimento pela unidade detentora; 3. Conclusão | Protocolo Geral → unidade escolhida → responsável atual | Não | Proposta |
| `pt-serv` | Requerimento de servidor | FL-04 Servidor v0.1 | 1. Triagem; 2. Análise administrativa; 3. Conclusão | Protocolo Geral → Administração → responsável atual | Não | Proposta |
| `pt-contract` | Análise de contrato | FL-05 Contratos v0.1 | 1. Triagem; 2. Análise jurídica; 3. Conclusão | Protocolo Geral → Jurídico → responsável atual | Não | Proposta |
| `pt-pay` | Pagamento de fornecedor | FL-06 Pagamento v0.1 | 1. Triagem; 2. Análise financeira; 3. Conclusão | Protocolo Geral → Financeiro → responsável atual | **Sim, validar quais documentos** | Proposta |

### Fases piloto cadastráveis

| Código | Fase | Objetivo | Regra de saída proposta |
| --- | --- | --- | --- |
| F-TRIAGEM | Triagem | Conferir abertura, tipo e encaminhar à unidade competente. | Destino definido e recebimento confirmado. |
| F-ATENDIMENTO | Atendimento/Análise | A unidade responsável analisa a demanda ou executa a providência. | Despacho/resultado registrado. |
| F-CONCLUSAO | Conclusão | Registrar o resultado e encerrar o fluxo. | Conclusão autorizada pelo papel responsável. |

**Pontos para validação do catálogo piloto:**

- Confirmar se “Triagem” é uma fase obrigatória para todos os tipos ou se a abertura já deve iniciar diretamente na unidade competente.
- Substituir os responsáveis genéricos pelas unidades e papéis oficiais da estrutura organizacional.
- Para Compras, Contratos e Pagamentos, definir fases adicionais obrigatórias, documentos/checklists e eventuais aprovações.
- Confirmar quais anexos são obrigatórios por tipo; o único caso sinalizado como provável é Pagamento de fornecedor, mas os documentos exigidos não foram fornecidos.
- Aprovar, ajustar ou excluir cada fluxo piloto antes de criar versões ativas no sistema.
## 6. Anexos, consulta e assinatura

| Tema | Proposta para validação | Status |
| --- | --- | --- |
| Inclusão de anexo | Permitir incluir enquanto o protocolo estiver na caixa do ator e a fase/permissão autorizarem; bloquear após o encaminhamento para fora da caixa, salvo exceção aprovada. | Aprovada |
| Metadados | Anexo contém arquivo, tipo/extensão aceita, descrição/observação, autor e eventos de renomear/remover. | Aprovada |
| Consulta pública/QR Code | Não liberar até definir dados expostos, autenticação por CPF/CNPJ + protocolo, URL, expiração e requisitos de LGPD. | Aprovada |
| Assinatura eletrônica | Não prometer validade jurídica até definição do provedor, autenticação/token, evidências e política de assinatura. | Aprovada |

## 7. Critério para encerrar a validação

A Fase 0 estará apta a iniciar quando:

- [x] A estrutura de unidades, seus administradores e suas regras de escopo forem aprovadas.
- [x] Os papéis e permissões tiverem responsável institucional e tabela aprovada.
- [x] Os status, transições e justificativas tiverem sido aprovados.
- [x] Cada tipo inicial possuir um fluxo, e cada fluxo possuir fases ordenadas e responsáveis definidos.
- [x] A política de anexos estiver aprovada.
- [x] Itens de consulta pública e assinatura estiverem aprovados ou explicitamente adiados.

## 8. Próxima ação do responsável funcional

Preencher a matriz da seção 5.2 e marcar as propostas deste documento como **Aprovada**, **Ajustar** ou **Adiada**. Após isso, a implementação inicia pela modelagem/migração das entidades e pela aplicação da matriz de permissões.

