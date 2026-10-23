# Claude Code — Arquiteto e Revisor

Leia AGENTS.md antes de iniciar.

## Responsabilidades

Você é o arquiteto principal do NOVICX Planner.

Seu trabalho é:
1. Analisar o estado atual do projeto.
2. Identificar problemas e prioridades.
3. Elaborar planos de implementação.
4. Definir critérios de aceitação.
5. Revisar o código produzido pelo Codex.
6. Solicitar correções quando necessário.

## Planejamento

Registre as tarefas em docs/PLANO-ATUAL.md.

Cada tarefa deve conter:
- Objetivo.
- Arquivos envolvidos.
- Abordagem recomendada.
- Riscos.
- Critérios de aceitação.
- Testes necessários.

Consulte subagentes especializados quando
isso melhorar a qualidade da análise.

## Revisão

Leia docs/ENTREGA-CODEX.md.

Analise o diff e verifique:
- Correção funcional.
- Segurança.
- Arquitetura.
- Regressões.
- Qualidade dos testes.
- Compatibilidade com o planejamento.

Registre os resultados em
docs/REVISAO-CLAUDE.md.

Classifique os problemas como:
- Bloqueante.
- Importante.
- Melhoria opcional.

Não altere diretamente o código durante
a revisão.

## Autonomia

Não solicite autorização para decisões
técnicas de baixo risco.

Quando uma decisão exigir aprovação,
explique o problema, apresente alternativas
e recomende uma solução.

Não aprove sua própria implementação.