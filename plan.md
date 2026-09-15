# Plano de implementação pendente — Fluxo Público

## Leitor e objetivo

Este plano é para a pessoa que continuar o desenvolvimento do MVP. Ao final das etapas prioritárias, ela deve conseguir executar todo o roteiro de aceite do produto sem encontrar tela apenas de consulta, ação sem efeito ou regra ausente.

## Estado atual

A base já oferece navegação, sessão de demonstração, dados fictícios, persistência no navegador, painel, abertura de protocolo, tramitação, ciência, conclusão, arquivamento, reabertura, documentos simples e anexos. A implementação atual é uma demonstração funcional do percurso principal, mas ainda não cobre por inteiro o escopo solicitado.

## Prioridade 0 — concluir os critérios de aceite

### 1. Completar os cadastros administrativos

- Concluído: Pessoas agora possui busca, cadastro, edição por admin, ativação/inativação, normalização e validação de CPF/CNPJ, e validação de e-mail e telefone.
- Concluído: Estrutura agora oferece árvore pesquisável com expandir/recolher, criação e edição por admin, prevenção de ciclos e bloqueios de inativação por filhos, usuários ou protocolos ativos.
- Concluído: Tipos de protocolo agora possuem criação e edição administrativas de prazo, cor e configuração independente de habilitado/obrigatório para interessado, credor e valor. Protocolos existentes preservam seu snapshot de configuração.
- Concluído: Tipos de documento agora permitem criação, edição e ativação/inativação administrativas.
- Concluído: Usuários agora permitem criação e edição de vínculo com unidade; a inativação bloqueia o usuário atual, o último admin ativo e responsáveis por protocolos ativos.
- Concluído: Serviços mockados agora exigem usuário ativo e contexto de unidade válido; mutações administrativas também exigem papel ADMIN, independentemente dos controles visuais.

### 2. Completar as ações de protocolo

- Concluído: Admin no contexto da unidade atual pode designar responsável ativo; a operação encerra a atribuição anterior e reinicia o ciclo de ciência.
- Concluído: A API e a interface exigem que o admin atue no contexto da unidade atual do protocolo; o operador permanece limitado à sua unidade de vínculo.
- Concluído: Protocolos possui filtros por tipo, unidade, responsável e período; ordenação local e paginação de 10 ou 20 itens, com todos os valores mantidos na URL.
- Concluído: A listagem normaliza a página atual quando filtros reduzem o total de resultados.
- Concluído: A listagem destaca ciência pendente e a linha do tempo informa unidade e responsável em cada atribuição.

### 3. Completar documentos e anexos

- Concluído: Documento aceita destinatário opcional ativo e o exibe na visualização e impressão.
- Concluído: O serviço bloqueia a criação de documento avulso fora da unidade de vínculo do usuário, inclusive quando o contexto é manipulado.
- Concluído: Anexos permite selecionar e persistir de um a cinco arquivos em uma única operação; a persistência é atômica e remove blobs já gravados se a operação falhar.
- Concluído: Anexos possui visualização em diálogo; PDF e imagem usam URL temporária revogada ao fechar, TXT é renderizado apenas como texto seguro, e o download preserva o nome original.
- Concluído: Anexos traduz quota, indisponibilidade e falhas de IndexedDB em mensagens específicas, informa arquivo ausente e remove blobs órfãos antes e após operações.

### 4. Persistência e recuperação

- Concluído: Dados locais com schema incompatível ou JSON inválido mostram uma tela de recuperação com ação explícita para restaurar a demonstração.
- Adiado por decisão do usuário: Versionar migrações do armazenamento e testar restauração, armazenamento em outra aba e mudança de schema.
- Concluído: O anexo inicial possui contingência em memória e permanece disponível na primeira abertura mesmo quando o IndexedDB é bloqueado.

## Prioridade 1 — qualidade de interface e acessibilidade

- Concluído: Input, Select, Checkbox e Switch foram criados como primitives acessíveis sobre controles nativos e aplicados aos fluxos de protocolo, documentos e cadastros. O diálogo agora possui animações de abertura e fechamento, sem perder foco preso, Escape e retorno ao disparador.
- Concluído: Protocolos, documentos, pessoas e usuários possuem cartões equivalentes no mobile; filtros e ações foram preservados.
- Concluído: Toasts globais anunciam sucesso e erro; painel, listagens e detalhes têm skeletons distintos, e o painel informa quando não há movimentações.
- Concluído: Diálogos têm foco inicial, foco preso, Escape e retorno ao disparador; o shell inclui link de salto, landmarks, foco visível e respeito a redução de movimento.
- Em andamento: contraste foi reforçado em textos auxiliares, estados, selos, foco e feedback; layouts estreitos receberam ajustes de cabeçalho e abas. O Playwright valida navegação e overflow em mobile e desktop; permanece a revisão visual manual, incluindo 320 px.
- Concluído: A aplicação foi separada em features de documentos, protocolos e cadastros, com queries e primitives compartilhadas; App.tsx concentra shell, rotas e fluxos remanescentes.
- Em andamento: prévias de impressão de protocolo e documento foram implementadas e o CSS oculta menus e ações ao imprimir; falta validação visual manual do resultado impresso, coberta pela pendência de revisão visual acima.

## Prioridade 2 — dados, testes e manutenção

- Concluído: Seeds agora possuem 20 protocolos e testes cobrem fila sem responsável, ciência pendente, vencido, prazo em 24 horas, sem prazo, concluído, arquivado, passagem por três unidades, documento e anexo acessíveis.
- Concluído: Testes de domínio cobrem designação, encaminhamento inválido, ciência única por atribuição, reabertura, acesso de operador/admin e bloqueios de inativação.
- Concluído: Teste de interface percorre abertura → tramitação → ciência → documento/anexo → conclusão e confirma a persistência após recarga.
- Concluído: Testes do adaptador IndexedDB cobrem gravação, leitura, remoção, limpeza de órfãos e indisponibilidade do armazenamento.
- Concluído: CI executa Playwright em desktop (1440 px) e mobile (Pixel 5), validando navegação e ausência de overflow horizontal.

## Ordem recomendada

1. Cadastros e serviços mockados correspondentes.
2. Designação, filtros e regras restantes de protocolo.
3. Documento/anexo e recuperação de persistência.
4. Componentes, acessibilidade e responsividade.
5. Seeds, testes de domínio, testes de interface e CI.

Cada etapa deve manter `typecheck`, `lint`, `test` e `build` aprovados. Antes de considerar uma etapa concluída, percorra também o roteiro de demonstração na interface.








