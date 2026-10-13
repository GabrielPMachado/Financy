# Financy

Controle financeiro pessoal para web e Android (Capacitor), com login, sincronização em nuvem e importação automática das transações do **Nubank** e do **Mercado Pago** via Open Finance.

## Recursos

- Receitas, despesas e investimentos, com parcelamento e recorrência
- Cartões de crédito com limite usado e pagamento de fatura
- Categorias personalizadas, histórico com filtros e exportação (JSON/CSV)
- Análise mensal por categoria, comparação com o mês anterior
- Calculadora freelancer, pendências a receber e área de planejamento (com assistente de IA opcional)
- Tema claro, escuro ou automático
- Sincronização em tempo real entre dispositivos (Firebase) e funcionamento offline
- Importação automática dos bancos de hora em hora (GitHub Actions + MeuPluggy)

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Recharts, Firebase (Auth + Firestore), Capacitor 8 (Android).

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha o que for usar
npm run dev                  # http://localhost:3000
npm run lint                 # checagem de tipos
npm run build
```

### Android

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug   # APK em android/app/build/outputs/apk/debug/app-debug.apk
```

## Segurança dos dados

As regras do Firestore (`firestore.rules`) só permitem que cada usuário autenticado leia e escreva os próprios dados em `users/{uid}`. Publique-as com `firebase deploy --only firestore:rules` ou pelo console.

## Sincronização bancária (Open Finance)

O script `scripts/sync-pluggy.mjs` busca as transações a partir de 01/10/2026 (`SYNC_FROM`, configurável) na API da [Pluggy](https://pluggy.ai) e grava no Firestore do usuário:

- contas correntes viram receitas e despesas;
- compras no cartão viram despesas vinculadas ao cartão (que é criado automaticamente);
- pagamentos de fatura feitos pela conta reduzem o limite usado do cartão;
- cada lançamento tem um id fixo (`pluggy-<id>`), então rodar várias vezes **não duplica** e **não sobrescreve** edições feitas no app.

> Transferências entre as suas próprias contas aparecem como saída em uma e entrada na outra.

### Configuração única

1. Crie contas em [meu.pluggy.ai](https://meu.pluggy.ai) (conectar os bancos) e em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) (credenciais da aplicação), e vincule o conector **MeuPluggy** à aplicação.
2. Preencha as variáveis do `.env.example` no seu `.env.local`.
3. Teste a leitura, sem gravar nada: `npm run sync:pluggy:dry`
4. Grave de verdade: `npm run sync:pluggy`

### Automático (GitHub Actions)

O workflow `.github/workflows/sync-pluggy.yml` roda de hora em hora (minuto 7) e pode ser disparado manualmente em **Actions → Sincronizar bancos → Run workflow**. Cadastre em **Settings → Secrets and variables → Actions**:

| Secret | Conteúdo |
|---|---|
| `PLUGGY_CLIENT_ID` | Client ID da aplicação Pluggy |
| `PLUGGY_CLIENT_SECRET` | Client Secret da aplicação Pluggy |
| `PLUGGY_ITEM_IDS` | IDs dos itens separados por vírgula |
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo da conta de serviço do Firebase |
| `SYNC_USER_EMAIL` | E-mail da conta do Financy que recebe os dados |
| `MEUPLUGGY_EMAIL` / `MEUPLUGGY_PASSWORD` | Login do Meu Pluggy, para renovar a sessão sozinho |
| `MEUPLUGGY_STORAGE_STATE` | Sessão inicial em base64 (opcional; ver acima) |

### Atualização automática no Meu Pluggy

A API da Pluggy não deixa atualizar itens do MeuPluggy, então o workflow abre o site
(Playwright, em nuvem) e clica em **Atualizar** antes de sincronizar: Mercado Pago de
hora em hora, Nubank às 06:00 e 18:00 (Brasília). Configuração única:

A sessão do Meu Pluggy dura cerca de um dia e meio. Para não precisar renová-la à mão,
o robô entra **sozinho com e-mail e senha** quando ela expira e guarda a sessão nova
no cache do Actions (assim ele só faz login uma vez a cada expiração). Configuração:

1. Cadastre os secrets **`MEUPLUGGY_EMAIL`** e **`MEUPLUGGY_PASSWORD`** (a senha fica só nos Secrets do GitHub).
2. Opcional, para a primeira execução já começar logada: `npm run meupluggy:login` e `npm run meupluggy:export`, colando o resultado em **`MEUPLUGGY_STORAGE_STATE`**.
3. Se o login automático falhar (senha trocada, verificação extra, captcha), a execução fica **vermelha** e o GitHub avisa por e-mail.

Se o clique falhar, a sincronização segue com os dados que a Pluggy já tem.

**Mantenha este repositório privado.** Os segredos ficam só nos Secrets do GitHub e o script nunca imprime valores nem descrições de transações no log, apenas contagens.

## Licença

Uso pessoal.
