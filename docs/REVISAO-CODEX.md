# Revisão Codex — Ciclo 2 (X4, recorte C1–C7)

- **Data:** 2026-10-24
- **Branch revisada:** `claude/ciclo-2` em `9b48735`
- **Base do diff:** `codex/ciclo-2` em `5df38b9`
- **Escopo deste parecer:** as cinco migrations em `supabase/migrations/`,
  `scripts/db-test-remote.mjs`, `scripts/e2e-remote-setup.mjs` e
  `src/services/supabase/flow.it.ts`.
- **Resultado:** alterações solicitadas — 0 bloqueantes, 4 importantes e
  2 melhorias.

## Importantes

### I1 — O runner remoto não impõe a transação da qual depende

**Arquivo:** `scripts/db-test-remote.mjs:43-48`

O runner só exige que o arquivo termine em `finish(); rollback;`, remove esse
`rollback` e confia que a exceção do bloco final reverta tudo. Ele não verifica
que o primeiro comando efetivo é `begin` nem recusa `commit`/`rollback` antes do
final. Assim, um teste futuro pode gravar algo antes de `begin` ou confirmar uma
transação intermediária; o marcador final ainda pode ser encontrado e o runner
pode reportar sucesso depois de persistir dados.

Os três testes atuais começam com `begin;` e não contêm outro encerramento de
transação além do `rollback` final, portanto o conjunto atual está protegido.
Isso não torna verdadeira a garantia declarada pelo próprio runner para todos
os arquivos que ele aceita.

**Correção esperada:** fazer o runner impor uma única transação — por exemplo,
validar o início e rejeitar qualquer controle transacional intermediário, ou
usar um modo de execução que envolva todo o arquivo em uma transação controlada
pelo runner. Adicionar um teste do runner com um `commit` intermediário.

### I2 — A limpeza E2E ignora falhas e pode deixar resíduos sem falhar a suíte

**Arquivo:** `src/services/supabase/flow.it.ts:85-94`

`storage.remove(...)` e `from("posts").delete()` retornam `{ error }`; essas
respostas são ignoradas. Se a remoção do Storage falhar, o hook continua e pode
apagar as linhas `post_media` por cascata ao excluir o post, perdendo inclusive
os caminhos necessários para uma nova tentativa. Se o `delete` do post falhar,
o teste também pode terminar verde com a publicação persistida.

**Correção esperada:** verificar e lançar cada `error`, só remover a linha do
post depois de confirmar a remoção dos objetos e manter/registrar os caminhos
criados independentemente da consulta final. Um erro de limpeza precisa tornar
a suíte vermelha.

### I3 — O setup cria identidades para usuários fora das três fixtures exatas

**Arquivo:** `scripts/e2e-remote-setup.mjs:72-78`

A inserção em `auth.identities` seleciona todo `auth.users` cujo UUID satisfaz
`ee2e0000-%`. Isso é mais amplo que os três IDs declarados nas linhas 65–68 e
contraria o contrato do arquivo de nunca tocar outras linhas. Um usuário de
outro teste que reutilize esse prefixo receberá uma identidade por efeito deste
setup.

**Correção esperada:** restringir a seleção aos três UUIDs exatos (idealmente
reutilizando o mesmo `values`/CTE) e testar que um quarto UUID com o prefixo não
é alterado.

### I4 — `reorder_post_media` não valida que os IDs formam um conjunto exato

**Arquivo:** `supabase/migrations/20261023120100_rls.sql:244-258`

A RPC compara o tamanho do array com a quantidade de mídias e verifica apenas
que cada elemento informado pertence ao post. Ela não rejeita IDs duplicados.
Para duas mídias, `[A, A]` passa pela condição mesmo omitindo `B`; o
`UPDATE ... FROM` fica sujeito a uma correspondência duplicada e pode terminar
em ordem incorreta ou em violação tardia da restrição única, em vez do erro
`22023` prometido pela validação.

**Correção esperada:** exigir `count(distinct id) = count(*)` e igualdade entre
os dois conjuntos antes do update, com pgTAP para duplicata, ID ausente e ID de
outro post. Como a migration já foi aplicada no remoto, corrigir por uma nova
migration aditiva com `create or replace function`, sem editar o histórico
aplicado.

## Melhorias

### M1 — Concentrar as três travas do E2E no setup

**Arquivos:** `scripts/e2e-remote-setup.mjs:13-37`,
`src/services/supabase/flow.it.ts:30-37`

O alvo de escrita do setup está corretamente preso ao ref
`smhrcfiwpqhumdclzdre`; o teste, por sua vez, exige a URL exata e prefixo
`sb_publishable_`. A defesa está dividida: o setup aceita qualquer URL/chave não
vazias e pode criar fixtures antes de o comando de teste rejeitar o arquivo.
Reutilizar uma validação comum no setup e no teste evita divergência e faz o
erro ocorrer antes de qualquer escrita. A chave não é usada pelo setup, então
isto é endurecimento, não vazamento atualmente explorável.

### M2 — Não interpolar a senha diretamente no SQL privilegiado

**Arquivo:** `scripts/e2e-remote-setup.mjs:46-50`

A senha gerada pelo script usa um alfabeto seguro, mas um valor já existente em
`.env.e2e.local` é interpolado sem escape numa string SQL. Uma aspa quebra o
setup; conteúdo deliberadamente construído vira SQL dentro do lote
privilegiado. Passar o valor como parâmetro seguro ou, no mínimo, escapar o
literal elimina a fragilidade.

## Controles validados

- Consulta somente de leitura ao catálogo do projeto dev confirmou RLS ativa
  nas sete tabelas de `public` e as políticas esperadas em `public` e
  `storage.objects`.
- `is_admin`, `current_client_id`, `set_post_published`, `assign_plan` e
  `reorder_post_media` são `security definer`, pertencem a `postgres`, usam
  `search_path=""`, recusam `anon` e só expõem `EXECUTE` a `authenticated` e
  `service_role`.
- `handle_new_user`, `handle_user_email_confirmed` e `set_updated_at` não são
  executáveis por `anon` nem `authenticated`; os dois triggers em `auth.users`
  estão instalados com os eventos e a condição da migration.
- As políticas de leitura isolam cliente, rascunhos e Storage pelo vínculo real
  da sessão; as mutações administrativas diretas permanecem condicionadas a
  `is_admin()`.
- O fluxo remoto exige a URL exata do projeto e chave com prefixo
  `sb_publishable_`; `.env.e2e.local` está ignorado pelo Git.
- O cleanup usa o `postId` criado na própria execução e os caminhos associados
  a esse post, sem buscas destrutivas por título, e-mail ou prefixo amplo. O
  problema é a falta de propagação de erros descrita em I2, não o alvo normal.

## Verificações executadas

- diff completo `codex/ciclo-2...claude/ciclo-2` dos arquivos do escopo;
- inspeção exaustiva dos controles de transação nos três `*.test.sql`;
- consulta somente de leitura a `pg_proc`, `pg_tables`, `pg_trigger` e
  `pg_policies` no projeto dev vinculado;
- `git diff --check codex/ciclo-2...HEAD`: sem erros.

Não executei `db:test:remote` nem `test:supabase:remote`: ambos escrevem no
projeto dev durante a execução, e o objetivo desta revisão inclui justamente
validar as garantias de reversão/limpeza antes de confiar nelas novamente.
