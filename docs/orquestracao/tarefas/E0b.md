# E0b — Selo de demonstração só no mock

- **Dono:** Claude · **Revisão:** CXR (`high`) · **Base:** commit anterior a E0b em `claude/ciclo-3` · **Faixa:** commit de E0b

## Objetivo
Com dados reais (`VITE_DATA_SOURCE=supabase`) nenhuma tela pode dizer "Modo demonstração — dados fictícios".

## Arquivos
`src/components/common/States.tsx` (`DemoTag`), `src/components/common/States.test.tsx` (novo).
Usos (inalterados): `AdminWorkspace.tsx:99`, `ClientWorkspace.tsx:107`, `LoginScreen.tsx:209`.

## Abordagem
`DemoTag` retorna `null` quando `!isMockMode()`. Um ponto só cobre os três usos; os cabeçalhos são flex, então a ausência não deixa buraco.

## Critérios de aceite
1. Em modo mock o selo aparece com o texto atual.
2. Em modo supabase o componente não renderiza nada (DOM vazio).
3. Nenhuma outra tela muda; visual do mock idêntico.

## Testes
`npx vitest run --maxWorkers=2 src/components/common/States.test.tsx` · `npx tsc --noEmit` · `npm run lint`.
