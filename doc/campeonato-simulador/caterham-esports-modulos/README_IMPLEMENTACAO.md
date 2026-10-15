# Caterham Esports Brasil — Pacote de módulos para implementação

Este pacote contém somente os módulos que ainda precisam ser integrados ao site.

## O que NÃO está neste pacote

### Inscrição / seletiva
O módulo de inscrição já foi enviado anteriormente e deve permanecer como está.

### Regulamento
O regulamento será enviado separadamente em PDF.
O desenvolvedor deve apenas disponibilizá-lo como link no site.

Sugestão de URL pública:

`/caterham-esports/regulamento.pdf`

ou outra URL definida pela estrutura do site.

---

# 1. Estrutura pública desejada

As funcionalidades devem ser páginas separadas no site real.

## Página de protestos

URL sugerida:

`/caterham-esports/protestos/`

Conteúdo:
- formulário de protesto;
- Pix;
- upload do replay `.rpy`;
- upload do comprovante;
- dados do incidente.

## Classificação Caterham Academy

URL sugerida:

`/caterham-esports/classificacao/academy/`

Conteúdo:
- tabela exclusiva do campeonato Academy;
- alternância:
  - Sem descartes
  - Com 2 descartes

## Classificação Caterham 420R

URL sugerida:

`/caterham-esports/classificacao/420r/`

Conteúdo:
- tabela exclusiva do campeonato 420R;
- alternância:
  - Sem descartes
  - Com 2 descartes

## Página raiz da classificação

Opcional:

`/caterham-esports/classificacao/`

Pode funcionar como seletor:

- Caterham Academy
- Caterham 420R

Também é aceitável não colocar essa página no menu e apontar diretamente para as duas tabelas.

---

# 2. Menu público sugerido

Estrutura recomendada:

```text
Caterham Esports
├── Inscrição
├── Classificação
│   ├── Academy
│   └── 420R
├── Protestos
└── Regulamento
```

Importante:

- NÃO incluir links para Admin;
- NÃO incluir links diretos para endpoints internos;
- os painéis administrativos não devem aparecer no site público.

---

# 3. Módulo de Protestos

Pasta deste pacote:

`protestos/`

## Formulário

Campos implementados:
- nome;
- e-mail;
- Customer ID iRacing;
- categoria;
- etapa;
- bateria;
- volta;
- carros/pilotos envolvidos;
- descrição do incidente;
- fundamento do protesto;
- arquivo `.rpy`;
- comprovante de pagamento.

## Taxa

Taxa regulamentar:

`R$ 50,00`

O sistema gera:
- Pix Copia e Cola;
- QR Code;
- `txid` individual por protesto.

## Configuração Pix

Configurar no servidor:

```text
CATERHAM_PROTEST_PIX_KEY=...
CATERHAM_PROTEST_PIX_NAME=...
CATERHAM_PROTEST_PIX_CITY=...
CATERHAM_PROTEST_FEE=50.00
```

## Validação do inscrito

O módulo pode consultar:

`/caterham-esports/storage/registrations.json`

já criado pelo módulo de inscrição enviado anteriormente.

Isso permite conferir:
- Customer ID;
- e-mail;
- categoria.

## Status desportivo

Os status são:

- Recebido
- Em análise
- Procedente
- Improcedente
- Não admitido

Não existe "Taxa devolvida" como status desportivo.

## Situação financeira

É separada do julgamento:

- Comprovante pendente
- Pagamento verificado
- Devolução pendente
- Devolvido

Quando o protesto é marcado como **Procedente**, o sistema passa automaticamente para:

`Devolução pendente`

Depois que o Pix de retorno for realmente realizado, o administrador marca:

`Devolvido`

## Admin de protestos

Caminho técnico atualmente incluído no módulo:

`/caterham-esports/protestos/admin/`

IMPORTANTE:
- não adicionar link público para esse endereço;
- o painel usa token administrativo;
- está configurado com `noindex`, `nofollow`, `noarchive`.

Preferência de produção:

```text
admin.seudominio.com/...
```

ou proteção adicional por:
- autenticação HTTP;
- VPN;
- allowlist de IP;
- outro mecanismo disponível na hospedagem.

---

# 4. Módulo de Classificação

Pasta deste pacote:

`classificacao/`

Academy e 420R são campeonatos independentes no iRacing.

Por isso, após cada etapa haverá dois arquivos distintos:

```text
eventresult-Academy-EtapaX.json
eventresult-420R-EtapaX.json
```

## Upload

No painel administrativo selecionar:

1. Campeonato:
   - Academy
   - 420R

2. Etapa:
   - 1 a 5

3. Arquivo:
   - `eventresult.json` correspondente àquela categoria.

Um arquivo de Academy nunca deve atualizar o 420R e vice-versa.

## Duas baterias por JSON

Cada `eventresult.json` da etapa deve conter as duas corridas.

O parser procura duas sessões Race, normalmente:

- HEAT 1
- FEATURE

que são tratadas como:

- Bateria 1
- Bateria 2

---

# 5. Pontuação

Tabela implementada:

```text
P1  = 31
P2  = 29
P3  = 28
P4  = 27
...
P30 = 1
```

Para receber pontos, o piloto precisa completar pelo menos 75% da distância do vencedor.

Quando 75% resultar em fração de volta, o valor é arredondado para baixo.

---

# 6. Descartes

Cada campeonato possui 2 descartes.

Na página pública existem dois modos:

## Sem descartes

Mostra:
- pontuação bruta;
- classificação pela soma de todos os resultados.

## Com 2 descartes

Mostra:
- pontuação líquida;
- baterias descartadas destacadas;
- classificação reordenada considerando os descartes.

Antes do fim do campeonato, esse modo é uma projeção considerando apenas baterias já realizadas.

Importante:
- baterias futuras não entram como zero;
- ausência em bateria já realizada pode ser descartada;
- DQ não pode ser descartada.

Após as 10 baterias, o modo com descartes passa a representar a classificação final regulamentar.

---

# 7. Critérios de desempate

Implementados nesta ordem:

1. maior número de vitórias;
2. maior número de segundos lugares;
3. maior número de terceiros lugares;
4. sucessivamente as demais posições;
5. melhor resultado na última bateria válida;
6. regressivamente pelas baterias anteriores.

---

# 8. Ajustes pós-prova

O JSON do iRacing é tratado como resultado-base do servidor.

O painel permite aplicar decisões posteriores dos Comissários:

- alteração de posição;
- perda de pontos;
- DQ;
- nota administrativa.

A classificação pública é recalculada após o ajuste.

Isso permite refletir decisões oriundas de:
- protestos;
- penalizações;
- revisão dos Comissários.

O JSON original não precisa ser alterado.

---

# 9. Admin da classificação

Caminho técnico incluído:

`/caterham-esports/classificacao/admin/`

NÃO adicionar esse link no site público.

O painel usa:
- `CATERHAM_ADMIN_TOKEN`;
- `noindex`;
- `nofollow`.

Preferência:
usar subdomínio ou host administrativo separado.

---

# 10. Permissões do servidor

O PHP precisa conseguir escrever em:

```text
/caterham-esports/protestos/storage/
/caterham-esports/classificacao/storage/
/caterham-esports/classificacao/public/
```

As pastas `storage/` NÃO devem ser acessíveis publicamente.

O pacote já possui `.htaccess` onde aplicável, mas em Nginx ou outra infraestrutura
o bloqueio deve ser configurado explicitamente.

---

# 11. Token administrativo

Configurar no ambiente:

```text
CATERHAM_ADMIN_TOKEN=SEGREDO_LONGO_E_UNICO
```

Não usar o valor de teste em produção.

---

# 12. HTTPS

Todos os formulários e painéis devem ser servidos por HTTPS.

Isto é especialmente importante porque há:
- upload de arquivos;
- dados pessoais;
- comprovante de pagamento;
- token administrativo.

---

# 13. Arquivos do pacote

```text
/
├── README_IMPLEMENTACAO.md
├── MAPA_DE_URLS.txt
├── protestos/
└── classificacao/
```

O módulo de inscrição NÃO está incluído porque já foi enviado anteriormente.

---

# 14. Checklist de implementação

## Público

- [ ] manter a página de inscrição já enviada;
- [ ] criar página pública de Protestos;
- [ ] criar página pública de Classificação Academy;
- [ ] criar página pública de Classificação 420R;
- [ ] adicionar link para Regulamento PDF;
- [ ] não expor links administrativos.

## Protestos

- [ ] configurar Pix;
- [ ] configurar storage;
- [ ] confirmar leitura do `registrations.json`;
- [ ] testar upload `.rpy`;
- [ ] testar upload do comprovante;
- [ ] testar julgamento Procedente → Devolução pendente.

## Classificação

- [ ] importar um JSON Academy;
- [ ] importar um JSON 420R;
- [ ] confirmar independência das duas tabelas;
- [ ] testar Sem descartes;
- [ ] testar Com 2 descartes;
- [ ] testar DQ;
- [ ] testar perda de pontos;
- [ ] testar alteração de posição.

## Segurança

- [ ] definir token real;
- [ ] bloquear pastas storage;
- [ ] remover qualquer link público para Admin;
- [ ] usar HTTPS;
- [ ] se possível, servir Admin em host/subdomínio separado.

---

# 15. Observação final

O layout pode ser adaptado ao header/footer/identidade visual do site existente.

O mais importante é preservar:
- endpoints;
- nomes dos campos;
- estrutura de storage;
- lógica de cálculo;
- separação Academy / 420R;
- ausência de links públicos para os painéis administrativos.
