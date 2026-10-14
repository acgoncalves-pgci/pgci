# Revisão da consulta pública

Escopo: rota de resumo, entrada do leitor e links nos PDFs. O usuário autorizou explicitamente a consulta sem login de assunto, descrição e andamento.

## Resultado

Nenhum bloqueio novo encontrado na tela de consulta. A operação lê o protocolo e devolve uma projeção explícita; não recebe contexto de mutação nem registra ciência ou movimentação. A configuração de consulta pública é verificada antes de carregar o resumo (`src/services/publicConsultation.ts:41`).

## Achado informativo: armazenamento de demonstração

Localização: `src/storage/database.ts:41`, `src/services/api.ts:1121`.

Categoria: integridade, divulgação de informações e elevação de privilégio. Alcance: usuário local do navegador. Os dados e as configurações ainda estão no localStorage; um usuário com acesso ao navegador pode inspecionar ou modificar esses registros diretamente. O frontend não substitui a validação de um servidor, e os registros locais não são compartilhados entre dispositivos.

Para produção, a consulta deve resolver a prefeitura no servidor, aplicar sua configuração de acesso público, retornar somente os campos da projeção e proteger as operações de escrita com autenticação e autorização. Esta etapa mantém o escopo solicitado, sem conectar backend.

## Verificações sem achados

- A entrada é limitada a 2048 caracteres, e números consultados a 80. URLs lidas não são navegadas: somente o parâmetro `numero` é extraído após conferir a rota da prefeitura (`src/services/publicConsultation.ts:9`). Não há destino arbitrário de redirecionamento.
- A projeção não retorna CPF/CNPJ, contato, corpo de documentos, anexos, observações internas ou mensagens de despacho (`src/services/publicConsultation.ts:21`).
- Assunto e descrição são renderizados como texto pelo React, sem execução de HTML (`src/features/consulta/PublicProtocolPage.tsx`).
- A rota pública não oferece operações de escrita; rotas operacionais continuam protegidas por login e permissões (`src/app/App.tsx`).
- Testes verificam que a consulta preserva versões, atribuições e histórico, respeita a configuração de bloqueio e separa as prefeituras.

Fora do escopo: servidor ainda não integrado, autenticação real, limites de requisições e leitura física por modelos específicos de leitores.
