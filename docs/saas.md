# SaaS por prefeitura (frontend)

## Rotas

O acesso padrão é `/saomateusdomaranhao/`, que apresenta o login da prefeitura. As demais páginas usam o mesmo prefixo, por exemplo `/saomateusdomaranhao/documentos` e `/saomateusdomaranhao/esqueci-a-senha`. Links internos, login, logout, retorno ao destino solicitado e QR codes de acesso interno mantêm esse prefixo.

A rota `/` apresenta o site institucional público do PGCI, com recursos, demonstração e seleção da prefeitura para acesso. Ela não abre uma sessão nem carrega os dados operacionais de uma prefeitura. As antigas rotas operacionais sem prefixo redirecionam para a prefeitura padrão, preservando caminho, query string e fragmento. Slugs desconhecidos apresentam “Prefeitura não encontrada”; digitar uma URL não cria uma prefeitura.

O conteúdo do site fica em `src/features/site/`. O contato comercial está em `siteContent.ts` e usa `comercial@pgci.example` como exemplo; substitua pelo endereço oficial quando disponível.

## Consulta por QR code e código de barras

A rota `/<slug>/consulta?numero=<número>` apresenta o resumo público do protocolo, sem login ou ações de edição. Assunto, descrição, situação, unidade, datas e andamento ficam disponíveis, conforme a configuração **Permitir consulta pública** da prefeitura. A projeção de consulta não inclui documentos, anexos, CPF/CNPJ, dados de contato, observações internas nem mensagens de despacho.

Capas, comprovantes e etiquetas novos codificam essa URL no QR code e no CODE128, e também oferecem o link clicável no PDF. Aplicativos de leitura no celular podem abrir a URL; leitores conectados ao computador podem inserir a URL no campo da tela de consulta e confirmar com Enter. Códigos de barras antigos que contêm somente o número continuam aceitos nesse campo. QR codes de PDFs antigos precisam ser regenerados para receber a nova rota.

Como o backend ainda não foi conectado, os protocolos continuam locais ao navegador. A leitura em outro dispositivo depende dos dados disponíveis na demonstração daquele dispositivo; os registros criados localmente ainda não são compartilhados. Quando houver backend, a consulta deverá usar uma projeção pública por prefeitura com o mesmo contrato, validando a configuração no servidor.

## Cadastro provisório sem backend

O cadastro publicado está em `src/saas/municipalities.json`. Para adicionar uma prefeitura:

```powershell
node scripts/register-municipality.mjs --name "Prefeitura de Axixá" --city "Axixá" --state MA --abbreviation PMA
```

O comando gera um ID fixo e um slug automático a partir da cidade, sem acentos ou espaços. Colisões recebem um sufixo numérico. O registro é salvo no arquivo; faça um novo build para disponibilizá-lo. `--dry-run` apenas mostra o resultado, sem modificar o cadastro.

**Preserve o ID e o slug após o cadastro.** Alterar o nome institucional, a cidade, a logo ou a aparência nas configurações não altera a URL. O manifesto conserva o endereço em navegadores novos e versões posteriores do frontend. A primeira entrada é a prefeitura padrão e recebe os dados antigos na migração; mantenha essa ordem até existir uma migração explícita para troca de prefeitura padrão.

`registerTenant()` também permite cadastrar identidades no registro local para testes e protótipos. Esse cadastro fica restrito ao navegador e não publica uma prefeitura para outros usuários. O registro publicado é o manifesto.

## Personalização e dados

Em **Configurações → Login**, altere título e descrição. Por padrão, **Usar cores da prefeitura** mantém o login ligado à paleta de **Aparência**, incluindo tema claro ou escuro. Desative essa opção para definir cores específicas do botão e do painel. O login usa a logo e o nome definidos em **Geral**, onde o endereço imutável está disponível para consulta. O layout se adapta à altura da janela, compactando informações secundárias nas telas menores para manter os controles de acesso visíveis.

Sessão, unidade, escopo, aparência, numeração, configurações e banco de demonstração usam chaves `fluxo-publico:tenant:<id>:...`. Anexos ficam em um banco IndexedDB separado por ID de prefeitura. Os caches de consultas são criados por instância da prefeitura. Trocar de prefeitura por endereço recarrega a aplicação e restaura somente a sessão daquela prefeitura.

Na primeira abertura da prefeitura padrão, os registros, configurações e arquivos legados são copiados para o armazenamento separado. Os originais são preservados e destinos existentes não são sobrescritos. A migração não é repetida após logout ou restauração da demonstração.

## Hospedagem e próximo backend

Use fallback de SPA para `index.html` nas rotas de prefeituras. Mantenha arquivos compartilhados (`/assets`, `/fonts`, `/pdf-assets`) servidos normalmente na raiz do domínio. O Vite já atende às rotas locais com esse comportamento.

Esta etapa usa autenticação e dados de demonstração no navegador. A separação local não é uma barreira de segurança entre clientes no servidor. No futuro backend, o ID e o slug devem ser persistidos com restrição única, criação atômica e bloqueio de alterações; o servidor deverá resolver a prefeitura pela rota e validar sessão, permissões e acesso aos registros e arquivos pelo ID da prefeitura. O contexto frontend já inclui `tenantId` para essa integração.
