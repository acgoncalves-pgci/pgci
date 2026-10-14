# Dados de demonstração

O seed é criado por prefeitura na primeira abertura do ambiente operacional ou de consulta. O site institucional `/` não inicializa dados operacionais. Todos os nomes, empresas, documentos e conteúdos são fictícios.

## Acesso

Rota padrão: `/saomateusdomaranhao/`. Senha demonstrativa: `Pgci@2026`.

| Usuário / e-mail | Unidade principal | Exemplo de acesso |
| --- | --- | --- |
| Marina Duarte / marina.duarte@example.com | Gestão de Processos | Administradora em todas as unidades |
| Clara Nunes / clara.nunes@example.com | Gestão de Processos | Protocolo e tramitação |
| Bruno Lima / bruno.lima@example.com | Administração | Análise administrativa |
| Rafael Reis / rafael.reis@example.com | Financeiro | Conferência financeira |
| Luísa Azevedo / luisa.azevedo@example.com | Jurídico | Pareceres e contratos |
| Joana Melo / joana.melo@example.com | Educação | Operadora na Educação, gestora na Administração |
| Helena Barros / helena.barros@example.com | Gestão de Processos | Template de atendimento; na Educação não cria processos, mas pode consultar auditoria |
| Pedro Carvalho / pedro.carvalho@example.com | Financeiro | Template de gestão financeira; também acessa Contabilidade |
| Beatriz Oliveira / beatriz.oliveira@example.com | Controladoria | Consulta, relatórios e auditoria, sem movimentar ou editar |

Marina permanece como administradora principal. O seed usa os mesmos perfis e permissões por unidade da aplicação; não contorna as proteções de remoção do próprio administrador ou do último administrador.

## Roteiros

Os IDs abaixo são internos e estáveis; os números apresentados são gerados pela configuração da prefeitura, a partir da data de abertura. Não use números fixos para localizar os exemplos.

| ID | Cenário |
| --- | --- |
| `pr-1` | Compra simples na triagem, com memorando e anexo de texto |
| `pr-2` | Fila financeira sem responsável, prazo vencido e documentação de apoio |
| `pr-5` | Contrato com passagem por Gestão de Processos, Administração e Jurídico |
| `pr-9` | Compra em instrução, com histórico de formalização e orçamento |
| `pr-11` | Contrato arquivado, disponível para consulta e reabertura autorizada |
| `pr-18` | Fila financeira na fase de conclusão, ainda sem destinatário |
| `pr-19` | Responsável designado, mas ciência ainda pendente; checklist bloqueado |
| `pr-21` | Serviço ao cidadão com diligência fora do fluxo sugerido e orientação para retornar à resposta da unidade |
| `pr-22` | Serviço resolvido na admissibilidade; conclusão antecipada permitida pelo fluxo sugerido |
| `pr-23` | Correspondência com fluxo livre, documento e anexo |
| `pr-24` | Compra concluída, com todas as etapas, destinos, checklists e evidências |
| `pr-25` | Pagamento sob responsabilidade do perfil financeiro personalizado |
| `pr-26` | Atendimento aberto por usuário com template de permissões |
| `pr-27` | Relatório recebido na Controladoria para consulta pelo perfil de controle e transparência |

O seed inclui também prazos próximos, demandas sem prazo, anexos obrigatórios, credores, valores e referências contratuais. Variações de restauração alteram parte dos assuntos e tipos, mantendo catálogos e roteiros essenciais.

## Documentos e arquivos

- Códigos de tipos usam o prefixo da categoria (`XX.XXX`).
- Os tipos de arquivo configuram extensões, retenção, descrição, cor e ícone; não são uploads no cadastro do tipo de processo.
- Há exemplos de PDF, minutas DOC/DOCX, planilhas XLS/XLSX e pacotes ZIP/RAR nas regras dos tipos. Os anexos pré-carregados são PDFs e um texto; não há arquivos Office ou compactados falsos.
- PDFs contêm a identificação da prefeitura, número do processo e descrição da evidência. Seus tamanhos correspondem aos bytes gerados.
- Cada checklist marcado como tendo anexo possui um arquivo vinculado à mesma movimentação.
- Documentos possuem autor, cargo, descrição, margens padrão e modelos com variáveis reconhecidas pelo editor.
- A assinatura deve ser testada pelo botão Assinar: o seed não inventa assinaturas ou certificados.
- Auditoria utiliza as ações reconhecidas pelo sistema, com usuário, unidade, alvo e data.

## Persistência e atualização

O seed novo se aplica a bancos ainda não inicializados. Bancos existentes passam pelas migrações normais, preservando alterações e arquivos locais. Atualizar o código não apaga a demonstração em uso.

Para testar a massa nova, utilize um perfil de navegador vazio ou um contexto novo do Playwright. A função administrativa interna `resetDb()` continua disponível para restauração explícita; ela apaga os dados operacionais e anexos da prefeitura ativa, preservando as demais prefeituras. O botão de restauração não foi recolocado na interface.

Os arquivos do seed têm chaves reservadas por anexo, dentro do armazenamento da prefeitura. São gravados no IndexedDB e podem ser reconstruídos se o navegador não oferecer esse armazenamento. Arquivos enviados pelo usuário continuam usando suas próprias chaves e bytes.
