# NOVICX Planner — Regras dos Agentes

## Objetivo

Desenvolver e manter o NOVICX Planner, um PWA
para clientes da NOVICX consultarem publicações,
salvarem artes e copiarem legendas.

Stack atual:
React, TypeScript, Vite, Tailwind e shadcn/ui.

O projeto utiliza dados fictícios nesta fase.
Não integrar Supabase sem autorização.

## Hierarquia

Claude Code:
- Arquiteto principal.
- Responsável pelo planejamento.
- Responsável pela revisão independente.
- Pode delegar análises a subagentes.

Codex:
- Responsável pela implementação.
- Pode delegar tarefas a agentes especializados.
- Executa testes e corrige problemas.
- Documenta alterações realizadas.

## Autonomia

Os agentes podem, sem autorização adicional:
- Corrigir bugs.
- Refatorar código de baixo risco.
- Criar e executar testes.
- Melhorar organização interna.
- Implementar tarefas previstas no plano aprovado.
- Escolher soluções técnicas equivalentes.
- Corrigir problemas identificados na revisão.

## Aprovação obrigatória

Solicitar autorização antes de:
- Alterar significativamente o design aprovado.
- Ampliar o escopo do produto.
- Contratar serviços ou gerar custos.
- Modificar ambientes de produção.
- Aplicar migrations em bancos remotos.
- Alterar permissões sensíveis.
- Excluir dados ou arquivos importantes.
- Executar operações destrutivas no Git.

## Segurança

- Nunca expor credenciais.
- Nunca colocar service_role no frontend.
- Não executar comandos destrutivos sem aprovação.
- Não alterar dados reais de clientes.
- Não conectar serviços externos sem autorização.

## Qualidade

- Preservar o visual existente.
- Executar build, lint e testes disponíveis.
- Não afirmar que testes passaram sem executá-los.
- Registrar falhas e limitações.
- Fazer commits pequenos e descritivos.
- Não modificar arquivos simultaneamente
  com outro agente.

## Fluxo

1. Claude analisa e planeja.
2. Codex implementa.
3. Codex registra a entrega.
4. Claude revisa.
5. Codex corrige os problemas.
6. Claude valida novamente.
7. O ciclo termina quando os critérios
   de aceitação forem cumpridos.

Se surgir uma decisão que exige autorização,
interromper somente a parte afetada.