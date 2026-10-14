# Fluxo Público

MVP frontend para demonstração de gestão de processos, documentos e cadastros, com acesso SaaS por prefeitura e login demonstrativo. Não há backend, API remota ou dados reais.

## SaaS por prefeitura

Na rota **`/`**, o site institucional apresenta o PGCI, seus recursos e o acesso aos ambientes das prefeituras.

O acesso padrão é **`/saomateusdomaranhao/`**. Cada prefeitura possui um slug automático, único e imutável, com sessão, configurações, dados e anexos locais separados. Em **Configurações → Login**, personalize a tela de acesso da prefeitura.

Consulte [docs/saas.md](docs/saas.md) para cadastrar outras prefeituras sem backend, entender a migração dos dados atuais e configurar a hospedagem das rotas.

## Executar

```bash
npm install
npm run dev
```

Comandos de qualidade:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

## Próximas etapas

O recorte de trabalho pendente, com prioridades e ordem recomendada, está em [plan.md](plan.md).

## Demonstração

Abra **`/saomateusdomaranhao/`** e entre com **`marina.duarte@example.com`** e senha **`Pgci@2026`**. Marina é a administradora principal. Os demais usuários utilizam seus e-mails `@example.com` e a mesma senha demonstrativa.

O seed reúne **27 processos**, **9 unidades** com hierarquia, cores e ícones, **9 usuários**, **7 perfis**, **11 tipos de processo** com códigos por categoria e regras de arquivos, **12 documentos** e modelos próprios para cada tipo de documento. Há filas sem responsável, ciência pendente, prazos vencidos, processos concluídos e arquivados, compras com todas as etapas e fluxos sugeridos com movimentações livres.

Os anexos PDF possuem conteúdo fictício e bytes disponíveis para visualização, impressão, download e teste da assinatura simulada. A numeração segue a configuração da prefeitura, com sequência diária por padrão. Consulte [docs/mock-seed.md](docs/mock-seed.md) para o roteiro e detalhes da massa.

Novos ambientes recebem a massa atualizada. A leitura de bancos locais existentes preserva registros e arquivos; não restaura a demonstração automaticamente.

## Persistência

Registros, histórico, numeração configurável e contexto de demonstração ficam em `localStorage`, em um documento JSON versionado e separado por prefeitura. Os bytes de anexos ficam em IndexedDB; metadados ficam no JSON. Em outra aba, eventos de armazenamento invalidam as consultas da aplicação. Isso é uma demonstração local por navegador, não colaboração em tempo real.

## Futuro backend Node.js

A interface depende de contratos assíncronos em `src/services/api.ts`. Para usar uma API Node.js, substitua a implementação mock por adaptadores HTTP que conservem tipos, contexto, paginação, `expectedVersion` e erros de domínio. As transições e a autorização devem ser novamente aplicadas de forma atômica no servidor.

## Limitações deliberadas

Login e assinatura são simulações locais. Perfis, permissões por unidade, manutenção dos cadastros, edição de documentos e consulta pública estão disponíveis na demonstração. Não há autenticação remota, assinatura definitiva, sincronização entre dispositivos, execução BPMN nem integrações externas. A retenção dos tipos de arquivo é uma configuração, sem eliminação automática.


## Relatórios e capa do processo

O menu **Relatórios**, logo abaixo de **Dashboard**, reúne as abas de processos, relatório individual e produtividade. Os filtros respeitam o escopo do usuário e as datas de abertura no fuso de São Paulo. Os PDFs abrem no modal com controles de impressão, download e assinatura simulada; a capa também está disponível em **Ações → Imprimir capa** no processo.

Em **Configurações → Geral**, envie e salve a logo e os dados do timbre. QR code e código de barras levam à consulta pública da prefeitura, em **`/saomateusdomaranhao/consulta?numero=...`**, quando habilitada. O resumo exibe assunto, descrição e andamento, sem permitir edição. A capa inclui dados do processo, informações complementares, movimentações, códigos de consulta e paginação automática.
