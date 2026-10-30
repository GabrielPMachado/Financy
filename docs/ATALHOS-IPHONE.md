# Atalhos do iPhone: tocar nas costas

Dois Atalhos do app **Atalhos**, ligados ao gesto de tocar nas costas do iPhone. Eles mostram uma caixa nativa do iOS **sem abrir o Safari nem o app**:

| Gesto | Atalho | O que faz |
|---|---|---|
| 2 toques | **Novo trabalho** | Pergunta o dia, a hora de início, a hora de fim e se comeu pizza, e registra o trabalho freelancer. |
| 3 toques | **Resumo** | Mostra o saldo, entradas e gastos do mês, pendentes e os últimos lançamentos. |

## Como funciona

- O Atalho entra no Firestore (o banco do Financy) com uma **chave** da sua conta, que você copia em *Ajustes › Atalho do iPhone › Copiar chave do Atalho*.
- **Resumo:** o app e o sincronizador de bancos mantêm um resumo pronto em `users/{uid}/resumo/atual`. O Atalho só lê e mostra o campo `texto` (com "Atualizado às HH:MM").
- **Novo trabalho:** o Atalho coloca o trabalho numa fila (`trabalhosRapidos`). O app a esvazia assim que estiver aberto, somando o dia na **semana pendente** certa, com as mesmas regras da calculadora (R$ 15 e R$ 18 por hora, domingo e feriado a R$ 18, alimentação, pizza). Se o app estiver fechado, o trabalho espera na fila e entra na próxima vez que você abrir o app. Enviar o mesmo trabalho duas vezes não soma em dobro.
- Nada fica fora do seu Firestore. A chave só abre os **seus** dados (as regras do Firestore garantem isso).

## Antes de começar

1. Com o app publicado (o push na `main` publica sozinho, veja o README), abra uma vez o `https://financy-2d.web.app` no iPhone, já logado, para o resumo ser criado.
2. No iPhone, em *Ajustes* do app, toque em **Copiar chave do Atalho**. A chave fica na área de transferência.

Dados usados nas ações (não são segredos):

- **Chave de API:** `AIzaSyDepvsTarS6FfS-nGNz51EVOlOR0yK5yOg`
- **Projeto:** `financy-2d`

## Começo comum aos dois Atalhos (ações 1 a 4)

1. **Texto**: cole a chave copiada.
2. **Obter conteúdo de URL**
   - URL: `https://securetoken.googleapis.com/v1/token?key=AIzaSyDepvsTarS6FfS-nGNz51EVOlOR0yK5yOg`
   - Método: **POST**
   - Corpo da solicitação: **Formulário** com dois campos de texto: `grant_type` = `refresh_token` e `refresh_token` = *Texto* (a ação 1).
3. **Obter valor do dicionário**: chave `id_token` do *Conteúdo da URL*. **Definir variável** `idt`.
4. **Obter valor do dicionário**: chave `user_id` do *Conteúdo da URL* (da ação 2). **Definir variável** `uid`.

## Atalho "Resumo" (3 toques)

5. **Obter conteúdo de URL**
   - URL: `https://firestore.googleapis.com/v1/projects/financy-2d/databases/(default)/documents/users/` + variável `uid` + `/resumo/atual`
   - Método: **GET**
   - Cabeçalho: `Authorization` = `Bearer ` + variável `idt` (com um espaço depois de Bearer)
6. **Obter valor do dicionário**: chave `fields.texto.stringValue`.
7. **Mostrar alerta**, com a mensagem sendo o *Valor do dicionário* (popup de vidro do iOS, só um botão OK). O texto já vem com mini gráfico do saldo, barra de gasto e categorias em caracteres.
   - *Título opcional:* antes do alerta, **Obter valor do dicionário** com a chave `fields.titulo.stringValue` (algo como `Financy · 30 out`) e use como título. Se preferir, deixe `Financy` fixo.

**Versão em cartão de tela cheia (opcional):** no lugar das ações 6 e 7, use **Obter valor do dicionário** com a chave `fields.html.stringValue`, depois **Definir nome** (do item) para `resumo.html` e **Visualização rápida**. Abre uma página escura com gráficos em SVG, mas **não é o popup de vidro**.

## Atalho "Novo trabalho" (2 toques)

5. **Perguntar** (tipo **Data**): "Dia do trabalho". Depois **Formatar data**, formato **Personalizado** `yyyy-MM-dd`. **Definir variável** `dia`.
6. **Perguntar** (tipo **Hora**): "Início". **Formatar data**, personalizado `HH:mm`. **Definir variável** `ini`.
7. **Perguntar** (tipo **Hora**): "Fim". **Formatar data**, personalizado `HH:mm`. **Definir variável** `fim`.
8. **Escolher do menu** "Comeu pizza?": em *Sim*, **Texto** `true` e **Definir variável** `pizza`; em *Não*, **Texto** `false` e **Definir variável** `pizza`.
9. **Texto** (uma linha só), trocando cada nome entre colchetes pela variável:

   ```
   {"fields":{"date":{"stringValue":"[dia]"},"inicio":{"stringValue":"[ini]"},"fim":{"stringValue":"[fim]"},"comeuPizza":{"booleanValue":[pizza]}}}
   ```

10. **Obter conteúdo de URL**
    - URL: `https://firestore.googleapis.com/v1/projects/financy-2d/databases/(default)/documents/users/` + variável `uid` + `/trabalhosRapidos`
    - Método: **POST**
    - Cabeçalhos: `Authorization` = `Bearer ` + variável `idt` e `Content-Type` = `application/json`
    - Corpo da solicitação: **Arquivo**, com o *Texto* da ação 9.
11. **Obter valor do dicionário**: chave `name`.
12. **Se** esse valor *tem algum valor*: **Mostrar notificação** "Trabalho registrado. Entra nas pendências quando você abrir o app." **Senão**: **Mostrar resultado** com o *Conteúdo da URL* da ação 10 (é a mensagem de erro).

## Ligar ao gesto

*Ajustes › Acessibilidade › Toque › Tocar nas costas*: em **Toque duplo** escolha *Novo trabalho* e em **Toque triplo** escolha *Resumo*. Exige iPhone 8 ou mais novo, com iOS 14 ou superior. Capas grossas atrapalham o gesto.

## Se algo der errado

| O que aparece | Causa e solução |
|---|---|
| `INVALID_REFRESH_TOKEN` | A chave foi colada errada ou foi revogada. Copie de novo em *Ajustes › Atalho do iPhone*. |
| `404 NOT_FOUND` ao ler o resumo | O resumo ainda não existe. Abra o app uma vez (já publicado) ou espere o próximo sync dos bancos. |
| `403` / `PERMISSION_DENIED` | O `uid` ou o token estão errados (confira as ações 3 e 4) ou o `Bearer ` está sem o espaço. |
| `Requests from referer <empty> are blocked` | A chave de API está restrita a sites. Adicione o cabeçalho `Referer` = `https://financy-2d.web.app/` nas duas chamadas ao Firestore e ao securetoken. |
| `INVALID_ARGUMENT` ao enviar o trabalho | O JSON da ação 9 está quebrado (aspas ou colchetes no lugar errado) ou `pizza` não ficou `true`/`false`. |
| Trabalho não aparece nas pendências | Abra o app: a fila só é esvaziada com o app aberto. Se ainda não aparecer, confira as horas (`HH:mm`) e a data (`yyyy-MM-dd`): trabalhos mal formados são descartados. |

## Segurança

- A chave do Atalho dá acesso de leitura e escrita aos seus dados. **Não compartilhe o Atalho** (o link do iCloud leva a chave junto) e não deixe o iPhone desbloqueado.
- Para invalidar a chave (Atalho compartilhado por engano, iPhone perdido): `node scripts/revoke-shortcut-key.mjs conta-de-servico.json` (precisa da conta de serviço do Firebase e do `SYNC_USER_EMAIL`). Depois entre de novo no app e copie uma chave nova. O Firestore ainda aceita um token já emitido por até 1 hora.
