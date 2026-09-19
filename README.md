# Fluxo Público

MVP frontend para demonstração de gestão de processos, documentos e cadastros da **Prefeitura de Vila Exemplo**. Não há backend, login, API remota ou dados reais.

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

A aplicação abre no painel operacional da usuária Clara (Processo Geral). Abra um processo, encaminhe-o ao Financeiro sem destinatário, troque o usuário do topo para Rafael, assuma e dê ciência. Crie um documento ou anexo, encaminhe ao Jurídico, dê ciência como Luísa e conclua. Depois, arquive e selecione Marina (admin) para reabrir.

O menu lateral inclui **Restaurar demonstração**; a ação confirma antes de limpar somente os dados `fluxo-publico:*` da aplicação.

## Persistência

Registros, histórico, numeração anual e contexto de demonstração ficam em `localStorage`, em um documento JSON versionado. Os bytes de anexos ficam em IndexedDB; metadados ficam no JSON. Em outra aba, eventos de armazenamento invalidam as consultas da aplicação. Isso é uma demonstração local por navegador, não colaboração em tempo real.

## Futuro backend Node.js

A interface depende de contratos assíncronos em `src/services/api.ts`. Para usar uma API Node.js, substitua a implementação mock por adaptadores HTTP que conservem tipos, contexto, paginação, `expectedVersion` e erros de domínio. As transições e a autorização devem ser novamente aplicadas de forma atômica no servidor.

## Limitações deliberadas

A primeira entrega não implementa autenticação, assinatura, portal público, fluxos BPMN, integrações, ações em lote ou edição posterior de documentos. Os cadastros aparecem prontos para demonstração; sua manutenção administrativa extensa fica como próxima etapa.


## Relatórios e capa do processo

O menu **Relatórios**, logo abaixo de **Dashboard**, reúne as abas de processos, relatório individual e produtividade. Os filtros respeitam o escopo do usuário e as datas de abertura no fuso de São Paulo. Os PDFs são gerados e baixados no navegador; a capa também está disponível em **Ações → Imprimir capa** no processo.

Em **Configurações → Geral**, envie e salve a logo e os dados do timbre. Em **Portal**, salve o endereço de consulta existente. O QR code usa esse endereço com o parâmetro `numero`; sem endereço, ou com consulta pública desabilitada, aponta para o detalhe do processo neste sistema. Essa configuração não publica nem cria um portal externo. A capa inclui dados do processo, informações complementares, movimentações, QR code, código de barras e paginação automática.
