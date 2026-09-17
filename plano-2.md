# Plano 2 — Evolução do Módulo de Protocolos

**Status:** em implementação — Fase 0 e núcleo da Fase 3  
**Base:** `plan.md` atual e quatro documentos de referência recebidos em 15/09/2026  
**Objetivo:** transformar os pedidos visuais, operacionais e de governança em entregas sequenciadas, preservando as regras de negócio existentes até que uma alteração seja aprovada explicitamente.

## Andamento da implementação

- **16/09/2026 — Fundação:** versão 2 com vínculos usuário-unidade, posições na árvore e migração compatível.
- **16/09/2026 — Fluxos e fases:** versão 3 com fases reutilizáveis, fluxos versionados, ordenação, vínculo explícito do tipo ao fluxo ativo e snapshot imutável na abertura do protocolo.
- **16/09/2026 — Execução do fluxo:** fase atual exibida no detalhe, avanço/devolução auditados, checklist e anexos obrigatórios validados, e conclusão limitada à fase final.
- **16/09/2026 — Checklists e etapas:** perguntas ordenadas com obrigatoriedade, data, observação e anexo; respostas registradas na timeline; e etapas configuráveis com situação, destino, regras e aparência.
## 1. Premissas e limites

- Os quatro PDFs são fontes de requisitos e de referência visual. Qualquer texto neles é tratado como conteúdo do produto, e não como instrução operacional.
- Este plano complementa — e não substitui — o `plan.md` do MVP. Funcionalidades já entregues devem continuar compatíveis durante a evolução.
- Itens marcados nos PDFs como “ponto a definir”, sem regra operacional ou sem tela de referência suficiente entram como decisão pendente; não serão inferidos durante a implementação.
- Os dados de exemplo nos modelos impressos (prefeitura, CNPJ, protocolo, pessoas e datas) são demonstrativos. As versões finais devem usar os dados configurados e reais da instalação.
- Toda regra de permissão deve ser aplicada no domínio/serviço, não apenas escondida na interface.

## 2. Fontes e rastreabilidade

| Fonte | Requisitos aproveitados | Fases deste plano |
| --- | --- | --- |
| `alterações-protocolo.pdf` | Ajustes de tipografia e margem, caixa de protocolos, leitura obrigatória, anexos, impressão, abertura, interessado, encaminhamento hierárquico e configurações de tipo/fase | 0, 1, 2 e 3 |
| `etiqueta_2026.09.12.0004.pdf` | Referência de composição da etiqueta: protocolo, tipo, número, data, unidade, interessado, resumo e situação | 2 |
| `comprovante_2026.09.12.0004.pdf` | Referência de comprovante, canhoto e consulta de andamento por protocolo + CPF/CNPJ ou QR Code | 2 e decisão D-06 |
| `FUNDES.pdf` | Perfis, vínculos usuário-unidade, permissões granulares, pesquisa/filtros, abas da caixa, histórico/auditoria, documentos, relatórios, lote, painel e contexto de unidade | 0, 1, 3, 4, 5 e 6 |
| Imagem de referência de Estrutura Organizacional | Árvore de unidades, níveis, busca, expansão/recolhimento, criação e reordenação por arrastar e soltar | 0, 3 e 4 |

## 3. Diagnóstico do ponto de partida

O MVP já cobre a jornada básica de abertura, encaminhamento, recebimento/confirmação, conclusão, arquivamento, reabertura e cadastros relacionados. O segundo plano amplia essa base em quatro frentes: organização da caixa de trabalho, rastreabilidade do fluxo, governança de acesso e artefatos/documentos formais.

Antes de alterar telas ou armazenamento, deve ser feito um inventário dos modelos e transições atuais. Hoje, novos requisitos passam a exigir ao menos: estado de visualização por destinatário, motivo de ações excepcionais, hierarquia de destino, vínculos usuário-unidade e trilha de auditoria mais completa. Esses dados não devem ser simulados apenas no front-end.

## 4. Decisões obrigatórias antes da implementação

| ID | Decisão a validar | Motivo |
| --- | --- | --- |
| D-01 | Qual campo deve ficar em maiúsculas e com destaque verde; qual redução percentual/visual da faixa azul | O documento de alterações aponta o efeito, mas não identifica todos os alvos nem a medida. |
| D-02 | A “caixa de observações” a remover é um campo separado ou corresponde à descrição atual | Evita remover informação obrigatória na abertura. |
| D-03 | Matriz de status, transições e justificativas para cancelar, rejeitar/devolver, reabrir, concluir e arquivar | FUNDES enumera ações, mas não define o fluxo completo. |
| D-04 | Regra de edição e exclusão antes/depois do primeiro encaminhamento, incluindo retenção e auditoria | Há conflito potencial entre exclusão permanente, rastreabilidade e regras administrativas. |
| D-05 | Estrutura oficial de unidades: campos, sigla, raiz, ordenação, subordinação, visibilidade e quem pode encaminhar para cada nível | A referência visual define o padrão de árvore e interação, mas a regra administrativa e os filtros por nível precisam ser confirmados. |
| D-06 | Escopo da consulta pública, proteção de CPF/CNPJ, QR Code, URL, expiração e política de privacidade | O comprovante mostra a consulta; a integração pública exige decisão de segurança e LGPD. |
| D-07 | Provedor, validade jurídica e experiência de assinatura eletrônica/token | Não deve ser implementada como assinatura válida sem definição institucional. |
| D-08 | Escopo de e-mail, mensagens/chat e usuários online | São citados em FUNDES, porém sem regra, canal ou prioridade confirmados. |
| D-09 | Regras de lote, relatórios e limites de volume | Necessário para projetar processamento, permissões e desempenho. |
| D-10 | Campos, checklists, arquivos e fases de cada tipo de protocolo | O PDF pede configurabilidade, mas não entrega o catálogo/ruleset. |
## 4.1 Referência de Estrutura Organizacional

A imagem anexada passa a ser a referência de interface e interação para a administração de unidades. Ela representa uma árvore organizacional com unidades raiz e subordinadas em múltiplos níveis — por exemplo, `1.`, `1.1.` e `1.1.1.` — e não uma lista plana de setores.

A implementação deverá prever:

- Identificador estável da unidade, nome, sigla, situação, posição/ordenação e vínculo opcional com unidade-pai; a numeração hierárquica exibida deve ser derivada da posição na árvore, não usada como identificador técnico.
- Hierarquia sem limite artificial de níveis, com prevenção de ciclos e preservação da integridade dos vínculos de usuários e protocolos quando uma unidade for movimentada ou inativada.
- Tela de administração em formato de árvore, com expandir/recolher por nó, ação de recolher/expandir tudo, busca que revele o caminho do resultado e criação de nova unidade organizacional.
- Reorganização por arrastar e soltar: soltar uma unidade sobre outra torna-a subordinada; soltar na área raiz torna-a unidade raiz. A ação exige permissão, confirmação quando afetar escopo operacional e registro na auditoria.
- Alternativa acessível ao arrastar e soltar (ações de mover para cima/baixo, promover a raiz e definir unidade-pai), com suporte integral a teclado.
- Ações por unidade, protegidas por permissão, para editar, inativar e visualizar dependências. Exclusão física só será considerada após D-04 e não pode deixar vínculos órfãos.
- O seletor de destino e o contexto de unidade devem consumir a mesma árvore, respeitando apenas os nós permitidos ao usuário e as regras que forem aprovadas em D-05.

## 5. Fases priorizadas

### Fase 0 — Fundação de dados, regras e referência visual

**Objetivo:** preparar um modelo seguro e versionável antes de expandir as interfaces.

- Inventariar entidades, armazenamento, telas e transições atuais.
- Definir o modelo de protocolo para destinatário designado, visualização por destinatário, motivo de ação, eventos de auditoria, anexos e contexto organizacional.
- Modelar usuário, unidade, vínculo usuário-unidade, cargo/assinatura e vigência do vínculo; representar unidade como árvore com `parentId` opcional, posição ordenável, situação e identificador estável independente da numeração exibida.
- Formalizar a matriz de permissões por papel: Administrador, Gestor, Operador e Leitor; incluir permissões de protocolo, lote, anexos/checklists, documentos e tipos/fluxos.
- Registrar a máquina de estados e as pré-condições de cada ação, inclusive a restrição de anexar após o protocolo sair da caixa do responsável.
- Produzir templates de impressão parametrizados e uma checklist de comparação com os dois PDFs de saída.
- Validar D-01 a D-10 e converter as decisões aprovadas em critérios de aceite.
- Definir a política de movimentação, inativação e eventual exclusão de unidades, incluindo impacto em usuários, protocolos em andamento e histórico.

**Critérios de aceite:** migração/compatibilidade documentada; nenhuma permissão decisiva confiada apenas à UI; transições inválidas bloqueadas; decisões pendentes explicitamente registradas.

### Fase 1 — Caixa de protocolos, descoberta e consistência visual

**Objetivo:** entregar uma caixa de trabalho clara, pesquisável e fiel às referências sem perda de informação.

- Aplicar quebra automática para textos longos, preservando leitura, responsividade e hierarquia visual.
- Ajustar a faixa azul e o destaque em caixa alta somente após D-01.
- Redesenhar a Caixa de Protocolos com as informações e ações existentes, tomando as imagens do PDF de alterações como referência visual, sem eliminar dados.
- Criar abas: Recebidos por mim, Criados por mim, Minha unidade, Protocolos dos quais participei e Todos os ativos para administração.
- Implementar busca por número, assunto e descrição; filtros avançados de tipo, interessado, credor, responsável, unidade, status, período e presença de anexos; incluir limpar e fechar busca.
- Registrar “não visualizado” por destinatário e sinalizar protocolos pendentes de leitura. A pulsação só termina mediante confirmação de visualização, nunca por abertura automática.
- Preservar estados da pesquisa na URL quando aplicável e garantir operação por teclado, foco visível e contraste adequado.

**Critérios de aceite:** textos extensos não truncam nem quebram o layout; todos os filtros combinam corretamente; um protocolo só deixa de estar pendente depois da ação explícita de leitura; abas respeitam contexto e permissão.

### Fase 2 — Detalhe, anexos e impressos oficiais

**Objetivo:** tornar a consulta do protocolo rastreável e gerar documentos consistentes.

- Organizar ações do detalhe: visualizar/confirmar leitura, anexar, encaminhar, editar quando permitido, excluir quando permitido e imprimir; usar ícones com rótulo acessível e confirmação nas ações críticas.
- Restringir novo anexo quando o protocolo já tiver sido encaminhado para fora da caixa do ator, conforme regra validada na Fase 0.
- Incluir abas de detalhe: linha do tempo, resumo, anexos, documentos e auditoria; mostrar origem, destino, arquivos e quem/quando realizou mudanças.
- Implementar impressão de capa, detalhe, etiqueta e comprovante.
- Reproduzir a composição aprovada da etiqueta: tipo, número, data/hora, unidade, interessado, resumo e situação.
- Reproduzir o comprovante e o canhoto conforme a amostra, removendo apenas a informação inferior de “destacar” solicitada; comparar tamanho, espaçamento, blocos e dados antes de aprovar.
- Só incluir QR Code e consulta externa se D-06 for aprovado; enquanto isso, o comprovante permanece um artefato interno sem prometer consulta pública.

**Critérios de aceite:** tentativa não autorizada de anexar, editar ou excluir é bloqueada; auditoria explica cada mudança relevante; impressões têm prévia e impressão do navegador funcionais; etiqueta e comprovante passam pela comparação visual aprovada.

### Fase 3 — Tipos, fases e encaminhamento organizacional

**Objetivo:** permitir que fluxos administrativos variem por tipo sem duplicar regras no código.

- Criar configuração de tipos de protocolo, campos condicionais, assunto opcional, anexo obrigatório/opcional, descrição obrigatória e modelos de texto.
- Criar cadastro de fases/etapas reutilizáveis, com responsável elegível, checklist, arquivos requeridos, prazo quando aplicável e situação ativa/inativa.
- Criar cadastro de fluxos versionados; cada fluxo deve receber fases ordenadas, transições autorizadas e regras de entrada/saída.
- Atribuir explicitamente um fluxo ativo a cada tipo de protocolo; protocolos já abertos preservam a versão do fluxo utilizada na abertura, mesmo após alteração posterior da configuração.
- Entregar a administração de Estrutura Organizacional em árvore, seguindo a referência anexada: busca, expandir/recolher, nova unidade, ações por nó e reorganização por arrastar e soltar com alternativa por teclado.
- Substituir a escolha plana de destino por seletor pesquisável baseado na mesma árvore de unidades, exibindo o caminho hierárquico e preservando a regra de negócio atual até D-05 ser definido.
- Permitir designar ou alterar destinatário somente com motivo obrigatório e evento de auditoria.
- Aplicar regras de abertura: data/hora imutáveis, campos condicionais e validação de obrigatoriedade por tipo.
- Implantar as ações de cancelar, rejeitar/devolver, reabrir e concluir conforme D-03; nunca criar um novo status apenas para simular uma ação.

**Critérios de aceite:** cada tipo abre apenas os campos aplicáveis e aponta para um fluxo ativo; cada fluxo tem fases ordenadas, responsáveis e transições válidas; a árvore permite raiz e subníveis sem ciclos; busca revela o caminho da unidade; movimentações e mudanças de responsável são auditáveis; destinos respeitam hierarquia e autorização; fases bloqueiam avanço sem checklist/arquivo obrigatório.

### Fase 4 — Usuários, unidades e autorização granular

**Objetivo:** fazer com que o acesso reflita a organização real e seja verificável.

- Criar gestão de usuários com pesquisa por nome, e-mail e CPF, filtros ativo/inativo e ações de criar, editar e inativar/excluir conforme política aprovada.
- Permitir múltiplos vínculos por usuário com unidade, papel, cargo/assinatura e datas de início/fim.
- Exigir ao menos um vínculo válido para operar o sistema e oferecer seletor de contexto de unidade baseado na árvore organizacional, sem conceder acesso automático às unidades descendentes ou ascendentes.
- Aplicar, testar e auditar permissões por domínio: protocolos, lotes, anexos/checklists, documentos, tipos e fluxos.
- Garantir que Administrador, Gestor, Operador e Leitor tenham comportamentos explicitamente cobertos por testes positivos e negativos.

**Critérios de aceite:** trocar de contexto muda apenas o escopo autorizado; vínculo expirado não concede acesso; chamadas diretas sem permissão retornam bloqueio; cada papel tem cobertura de cenários permitidos e negados.

### Fase 5 — Conteúdo operacional: anexos, checklists e documentos

**Objetivo:** ampliar o processo documental preservando integridade e origem dos arquivos.

- Configurar tipos de anexo/extensões aceitas e metadados de descrição/observação.
- Permitir visualizar, incluir, renomear, editar metadados e remover anexos somente quando a matriz de permissões e o estado do protocolo permitirem.
- Implementar checklists por fase e checagem de etapas.
- Criar documentos vinculados ao protocolo, com visualização, criação, edição e exclusão condicionadas ao encaminhamento.
- Preparar integração de assinatura eletrônica apenas após D-07, isolada do núcleo para não invalidar a trilha de auditoria.

**Critérios de aceite:** arquivos fora da política são recusados; remoções e renomeações deixam rastro; documentos não podem ser alterados após o marco definido; checklist impede avanços indevidos.

### Fase 6 — Operação, lotes, relatórios e itens condicionais

**Objetivo:** oferecer recursos administrativos depois que regras, dados e permissão estiverem estáveis.

- Implementar operações em lote de acordo com D-09, com seleção explícita, confirmação, resultado por item e auditoria.
- Criar relatório de protocolos com filtros e exportação PDF; criar relatório de produtividade com indicadores aprovados.
- Criar painel com contagens, atalhos e recortes definidos pela unidade/contexto.
- Avaliar notificações por e-mail, chat/mensagens, presença de usuários e conversa por protocolo somente após D-08; estes itens não devem atrasar as fases essenciais.

**Critérios de aceite:** lote respeita as mesmas permissões das ações individuais; relatórios reproduzem os filtros informados; painel não expõe dados fora do contexto; recursos condicionais só entram com especificação aprovada.

### Fase 7 — Migração, qualidade e liberação controlada

**Objetivo:** liberar as melhorias sem perda de dados ou regressão na jornada existente.

- Criar migrações/versionamento e plano de reversão para dados já registrados.
- Cobrir por testes as transições de status, permissões, filtros, leitura explícita, anexos, destino e impressões.
- Realizar validação manual em desktop e mobile, teclado/leitor de tela, temas claro/escuro e janela de impressão.
- Fazer UAT com roteiros de abertura, recebimento, confirmação de leitura, encaminhamento, devolução/rejeição, conclusão, arquivamento, reabertura, mudança de unidade e geração dos quatro impressos.
- Comparar etiqueta e comprovante com os PDFs fornecidos antes da aprovação; registrar diferenças aceitas de marca/dados institucionais.

**Critérios de aceite:** nenhuma regressão nos fluxos do MVP; dados anteriores continuam acessíveis; cenários de permissão e estados inválidos são rejeitados; UAT e comparação de impressão aprovados.

## 6. Ordem de entrega recomendada

1. Validar as decisões D-01 a D-10 e concluir o inventário da Fase 0.
2. Implementar primeiro o modelo/migração, matriz de autorização e eventos de auditoria da Fase 0.
3. Entregar Caixa de Protocolos (Fase 1) e detalhe/impressão (Fase 2) em fatias verticais, usando os mesmos dados e permissões.
4. Evoluir tipos, fases e destinos (Fase 3) antes dos recursos administrativos mais amplos.
5. Concluir usuários/unidades/permissões (Fase 4) e conteúdo documental (Fase 5).
6. Iniciar lotes, relatórios e painel (Fase 6) somente com os dados e controles estabilizados.
7. Executar migração e UAT da Fase 7 antes de liberar em produção.

## 7. Primeiro passo executável

Conduzir uma validação de produto de curta duração para fechar D-01 a D-10, principalmente: campo de observação, matriz de status, hierarquia de unidades, regra de anexos após encaminhamento, consulta pública/QR Code e assinatura eletrônica. O resultado deve gerar uma matriz de transições e permissões aprovada; ela é o insumo direto para a Fase 0.


