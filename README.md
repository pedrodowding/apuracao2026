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


## V14: Observatório de Padrões no Detalhamento Profundo

A seção **Explorar > Detalhamento Profundo > Observatório de Padrões** oferece duas análises complementares.

### Zonas eleitorais com consulta oficial

1. Escolha UF e município.
2. Clique **Comparar os dois turnos**. A rota `/api/forensics/zones?uf=RJ&city=<codigo-TSE>&round=1|2` busca primeiro a lista oficial de zonas no arquivo EA12, depois os JSON unificados por zona do TSE (`-u.json`).
3. Compare os votos de Lula (13) e Flávio (22), o saldo `votos13 - votos22` e sua alteração entre o primeiro e segundo turno.
4. Filtre por **votação exclusiva** (100% dos válidos para um candidato na zona) ou **desvio territorial** (variação em pontos percentuais em relação à média das zonas consultadas no município). O filtro mínimo de votos impede que uma seção/zona pequena domine a visão por mero tamanho amostral.
5. **Impacto relativo ao padrão local** = saldo real da zona menos `(2 × proporção de Lula no município − 1) × votos válidos dos dois candidatos na zona`. O impacto relativo de todas as zonas consultadas soma aproximadamente zero. Não são votos adulterados; é uma decomposição de heterogeneidade geográfica.

A consulta é por **município**, não um rastreamento automático das 6 mil zonas nacionais. A API limita a 140 zonas por município, realiza consultas em lotes de oito e informa zonas ausentes, truncamento e cobertura por turno. Não trate amostras de cobertura incompleta como totais nacionais ou estaduais.

### Seções e urnas a partir de CSV oficial

1. Baixe o arquivo de **Votação por seção eleitoral**, disponibilizado em [Resultados 2026 do TSE](https://dadosabertos.tse.jus.br/dataset/resultados-2026).
2. Extraia o arquivo CSV do ZIP e selecione a UF no painel.
3. Importe o CSV do 2º turno. Para comparar alterações por seção, importe também o CSV do 1º turno da mesma UF.
4. Filtre seções **100%** ou **95% ou mais** para um candidato, selecione mínimo de votos, pesquise município/zona/seção e exporte os resultados filtrados.

A leitura do arquivo ocorre no **navegador** via streaming; nada é enviado para o servidor. Um arquivo CSV maior que 350 MB é recusado para reduzir risco de exaustão de memória no dispositivo. A comparação por seção usa a chave `UF + município + zona + seção`; se não houver seção pareada, a variação é mostrada como indisponível. Os números dependem integralmente da completude e integridade do arquivo importado, que não é verificado criptograficamente pelo site.

**Critério de interpretação:** votação unânime, concentração de votos e mudança de saldo não provam irregularidade eleitoral. Investigações de divergência documental precisam confrontar o boletim de urna e os dados de totalização oficiais. A referência nacional do TSE (110 seções com votação exclusivamente para um candidato) aparece no painel separada do resultado do CSV do usuário.
