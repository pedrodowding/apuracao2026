# Apuração Brasil 2026 · Vercel

Painel Next.js para resultado presidencial de segundo turno do TSE, com consulta nacional, estadual, agregação regional, histórico local e verificação de reversão matemática.

## Instalar e desenvolver

```bash
npm install
npm run build
npm run dev
```

## Publicar na Vercel

1. Faça upload desta pasta na raiz de um novo repositório GitHub.
2. Na Vercel, escolha **New Project**, importe o repositório e execute **Deploy**.
3. A rota `/api/results?uf=br` consulta os JSON oficiais do TSE. A variável opcional `TSE_ELECTION_ID` usa `6258` por padrão.
4. Confira a resposta real do TSE e a leitura dos campos antes de divulgar publicamente.

## Fonte e limites

- Fonte: `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json` (abrangência variável por UF).
- Conforme especificações EA20 e informações técnicas do TSE: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
- Não existem números mockados. Caso a fonte falhe, um aviso aparece.
- A apuração regional é a soma das UFs disponíveis; o painel exibe cobertura em quantidade de UFs.
- Reversão matemática: se existir eleitorado apto e comparecimento, calcula limite máximo conservador de votos restantes. Não confundir com probabilidade de vitória, projeção estatística ou estimativa de comparecimento futuro.
- Histórico temporal armazenado no navegador do visitante (localStorage), sem banco de dados nem sincronização entre visitantes.
- A visão por município e comparação histórica de 2022 **não estão implementadas** nesta versão.
- O esquema EA20 precisa ser validado em uma resposta real de produção. Ambiente sem acesso à rede não permite essa verificação.

## V3: Cenários estatísticos condicionais

Inclui `lib/scenarios.ts` e um quadro de sensibilidade com sete distribuições hipotéticas dos votos ainda não contabilizados (0%, 25%, 40%, 50%, 60%, 75%, 100% para a candidatura numericamente atrás). Apresenta ponto de equilíbrio, teto de votos potenciais e impossibilidade matemática de reversão quando demonstrável. **Não apresenta probabilidades de vitória**, pois não há calibração histórica e os dados restantes não são amostra aleatória. O cálculo depende da disponibilidade e interpretação correta de `eligible` e `turnout` da API do TSE. Caso não estejam disponíveis, o painel informa a limitação.
