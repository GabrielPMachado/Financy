# Financy

Controle financeiro pessoal para web, iPhone (PWA) e Android (Capacitor), com login, sincronização em nuvem e importação automática das transações do **Nubank** e do **Mercado Pago** via Open Finance.

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

### iPhone (PWA, sem App Store)

O workflow `.github/workflows/deploy-web.yml` publica o app em **https://financy-2d.web.app** (Firebase Hosting) a cada push na `main` que muda o app, ou manualmente em **Actions → Publicar site → Run workflow**. Usa o mesmo secret `FIREBASE_SERVICE_ACCOUNT`; se der erro de permissão, dê à conta de serviço o papel **Administrador do Firebase Hosting** (Google Cloud → IAM).

No iPhone: abra o endereço no **Safari** → Compartilhar → **Adicionar à Tela de Início**. Abre em tela cheia, com ícone, e se atualiza sozinho a cada publicação.

- Login com Google no app instalado: adicione `https://financy-2d.web.app/__/auth/handler` em *URIs de redirecionamento autorizados* do cliente OAuth "Web client (auto created by Google Service)" (Google Cloud → APIs e serviços → Credenciais). E-mail e senha funcionam sem isso.
- O site é público, então o build não embute o token do GitHub: cole-o em Ajustes > Bancos para usar *Sincronizar agora*.
- O atalho de lançamento rápido (sobreposição) é só do Android.

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
| `MEUPLUGGY_EMAIL` | E-mail da conta do Meu Pluggy (um Gmail), para o robô entrar sozinho |
| `GMAIL_APP_PASSWORD` | [Senha de app](https://myaccount.google.com/apppasswords) desse Gmail: o robô pede o e-mail de acesso do Meu Pluggy e lê o código/link |
| `MEUPLUGGY_PASSWORD` | Opcional: em vez da senha de app, para contas com senha |
| `NTFY_TOPIC` | Opcional: tópico do app [ntfy](https://ntfy.sh) que recebe um push ao fim de cada sync manual (banco atualizado e quantos lançamentos entraram, ou o motivo da falha; nunca valores). Use um nome difícil de adivinhar |

### Atualização automática no Meu Pluggy

A API da Pluggy não deixa atualizar itens do MeuPluggy, então o workflow abre o site
(Playwright, em nuvem) e clica em **Atualizar** antes de sincronizar: Mercado Pago e
Nubank, de hora em hora.

O robô guarda a sessão do Meu Pluggy no **cache do Actions** e a renova a cada execução.
Quando ela expira (o Meu Pluggy desloga a cada ~1 dia e meio), ele **entra sozinho**: pede o
e-mail de acesso do Meu Pluggy e abre o link que chega no Gmail (lido por IMAP com a senha de
app em `GMAIL_APP_PASSWORD`). Não precisa do PC.

Se o clique falhar, a sincronização segue com os dados que a Pluggy já tem.

#### Velocidade e horário

- **No app** (Ajustes > Bancos): *Buscar agora* (~30 s, sem pedir atualização ao Meu Pluggy), *Atualizar Mercado Pago*, *Atualizar Nubank* ou os dois. O botão de atualizar do topo atualiza só o Mercado Pago.
- **Pelo iPhone:** o Atalho dispara o workflow pela API do GitHub; com o secret `NTFY_TOPIC`, o resultado chega como push no app ntfy.

#### Mensagens de erro

O app mostra uma mensagem diferente para cada causa (token inválido, sem permissão, workflow desatualizado, sem internet, sessão do Meu Pluggy expirada, Meu Pluggy fora do ar, Pluggy recusou o Client ID/Secret, falha ao gravar no Firestore…). Elas vêm das etapas `Falha [codigo]` do workflow, traduzidas em `src/lib/syncErrors.ts`.

**Mantenha este repositório privado.** Os segredos ficam só nos Secrets do GitHub e o script nunca imprime valores nem descrições de transações no log, apenas contagens.

## iPhone (PWA + "Tocar nas costas")

O Financy funciona no iPhone como PWA (sem Mac e sem App Store), com uma "ilha" de resumo no
estilo da Dynamic Island que abre com o gesto de tocar nas costas do aparelho.

1. **Publicar:** é automático. O workflow `deploy-web.yml` (veja *iPhone (PWA, sem App Store)* acima) publica em `https://financy-2d.web.app` a cada push na `main` que muda o app.
2. **Instalar**: no Safari do iPhone, abra o endereço, entre na conta e use Compartilhar › *Adicionar à Tela de Início*.
3. **Atalhos com o gesto de tocar nas costas** (sem abrir o Safari): 2 toques registram um trabalho freelancer e 3 toques mostram o resumo, ambos em caixas nativas do iOS. Passo a passo em [docs/ATALHOS-IPHONE.md](docs/ATALHOS-IPHONE.md).
   - *Alternativa que abre o app:* um Atalho com **Abrir URLs** em `https://financy-2d.web.app/?action=resumo` (ilha de resumo) ou `?action=quick-add` (lançamento rápido).

Limites do iOS: a ação **Abrir URLs** abre no Safari, não no app da Tela de Início, e os dois guardam o login separadamente (entre uma vez nos dois). Os Atalhos da pasta `docs` não dependem desse login: usam a chave de *Ajustes › Atalho do iPhone*. A Dynamic Island de verdade (Live Activity) exige app nativo, Mac e Xcode.

## Licença

Uso pessoal.
