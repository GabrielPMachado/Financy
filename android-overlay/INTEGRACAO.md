# Integrando o overlay de lançamento rápido ao Financy

Eu não consigo rodar Android Studio/Gradle aqui, então não testei a
compilação — mas o código segue a API padrão do Android (`WindowManager`,
`Settings.canDrawOverlays`, `Foreground Service`) e do Capacitor, então
deve compilar com pequenos ajustes de nomes de pacote se necessário.

## O que muda no projeto
Hoje o Financy é um site puro (Vite). Pra ter um `Service` Android rodando
por trás, ele precisa ser empacotado com **Capacitor** (o app web continua
exatamente igual — Capacitor só embrulha ele num app nativo e permite
plugar código Kotlin).

## Passo 1 — Adicionar Capacitor ao projeto
Dentro da pasta do projeto (`financy-pronto-para-apk`, que te mandei antes):

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap init "Financy" "com.financy.app" --web-dir=dist
npm run build
npx cap add android
npx cap sync
```

Isso cria a pasta `android/` com um projeto Android Studio completo.

## Passo 2 — Copiar os arquivos nativos
Copie os arquivos desta pasta (`android-overlay/`) assim:

```
android-overlay/java/com/financy/overlay/*.kt
  → android/app/src/main/java/com/financy/overlay/*.kt

android-overlay/react-side/quickAddOverlay.ts
  → src/native/quickAddOverlay.ts   (no projeto React)
```

## Passo 3 — Registrar o plugin
No arquivo `android/app/src/main/java/.../MainActivity.java` (ou `.kt`),
registre o plugin **antes** do `super.onCreate`:

```java
import com.financy.overlay.QuickAddOverlayPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(QuickAddOverlayPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
```

## Passo 4 — Mesclar o AndroidManifest.xml
Abra `android/app/src/main/AndroidManifest.xml` e copie as permissões e a
tag `<service>` de `AndroidManifest-additions.xml` para os lugares
indicados nos comentários.

## Passo 5 — Instalar o pacote JS do Capacitor no React
```bash
npm install @capacitor/core
```
E chame `src/native/quickAddOverlay.ts` de algum botão da UI (por exemplo,
em Configurações: "Ativar lançamento rápido flutuante"). O arquivo já tem
um exemplo comentado de como pedir a permissão e iniciar o overlay.

## Passo 6 — Build final
```bash
npm run build
npx cap sync android
npx cap open android
```
Isso abre o Android Studio. De lá: **Build → Generate Signed Bundle / APK**.

## Como funciona na prática
1. Usuário toca em "Ativar lançamento rápido" dentro do app.
2. App pede a permissão **"Exibir sobre outros aplicativos"** (o Android
   abre a tela de sistema pra isso — não existe diálogo in-app, é uma
   exigência de segurança do próprio Android).
3. Depois de concedida, `startQuickAdd()` liga o `OverlayService`, que
   fica rodando como *foreground service* (por isso a notificação
   permanente — também é exigência do Android, não dá pra rodar em
   segundo plano sem avisar o usuário).
4. Toda vez que o serviço é acionado, ele desenha um card flutuante no
   centro da tela, por cima do que estiver aberto (Chrome, YouTube,
   WhatsApp etc.), sem tirar o app de baixo da tela — usa
   `FLAG_NOT_TOUCH_MODAL`, então o resto da tela continua "vivo" ao redor.
5. Pergunta um item por vez: Tipo → Valor → Categoria → Descrição →
   Confirmar.
6. Ao salvar, grava direto no mesmo documento do Firestore que o app web
   usa (`users/meu_financeiro_principal`), então na próxima vez que você
   abrir o app a transação já está lá — sem precisar abrir o app durante
   o lançamento.

## Passo 7 — Ativar o ladrilho de Configurações Rápidas
Sobre o botão de power: **não dá pra usar** — o Android não entrega esse
evento pra nenhum app de terceiros por segurança (nem com Accessibility
Service, nem com permissões especiais; só o fabricante controla esse
gesto, e é sempre hardcoded pra abrir câmera). A alternativa que
implementei — e que é uma API oficial e suportada — foi um
**Quick Settings Tile**: o ladrilho que aparece quando você puxa a barra
de notificações duas vezes.

Depois de instalar o APK, o usuário precisa (uma única vez — isso é regra
do Android pra qualquer app, não dá pra pular):
1. Puxar a barra de notificações duas vezes (abre o painel completo).
2. Tocar no ícone de lápis/editar.
3. Arrastar o ladrilho **"Lançamento rápido"** para a área de ladrilhos
   ativos.
4. Depois disso, é só puxar a barra 1x e tocar no ladrilho — 2 gestos, de
   dentro de qualquer app.

Adicionei `QuickAddTileService.kt` (o ladrilho em si) e
`OverlayTrampolineActivity.kt` (uma activity invisível que só existe para
fechar o painel de notificações da forma correta antes do overlay
aparecer — o Android bloqueou o jeito antigo de fazer isso via broadcast
a partir da versão 12). Ambos já estão registrados no
`AndroidManifest-additions.xml` atualizado.

## Passo 8 — Ícone real do app (launcher)
Copie a pasta `launcher-icon/` (deste mesmo zip) para dentro de
`android/app/src/main/res/`, mesclando com o que já existe — ou seja,
copie o CONTEÚDO de cada subpasta (`mipmap-mdpi/`, `mipmap-hdpi/`, etc.)
para dentro da pasta de mesmo nome já existente em `res/`, sobrescrevendo
os arquivos `ic_launcher.png` / `ic_launcher_round.png` /
`ic_launcher_foreground.png` que já estão lá (os do Capacitor por padrão).

Isso inclui:
- `mipmap-mdpi/`, `mipmap-hdpi/`, `mipmap-xhdpi/`, `mipmap-xxhdpi/`, `mipmap-xxxhdpi/`
  → ícone legado (`ic_launcher.png`, `ic_launcher_round.png`) e o
  foreground do ícone adaptativo (`ic_launcher_foreground.png`).
- `mipmap-anydpi-v26/ic_launcher.xml` e `ic_launcher_round.xml` → ícone
  adaptativo (Android 8+, o que gera aquele efeito de "recorte" redondo
  ou quadrado dependendo do launcher do fabricante).
- `values/ic_launcher_background.xml` → cor de fundo do ícone adaptativo.
  Se seu projeto já tiver um `values/colors.xml` ou já usar o nome
  `ic_launcher_background`, cole só a linha da cor lá dentro em vez de
  criar um arquivo novo, pra não duplicar o recurso.

Depois de colar os arquivos, `npx cap sync android` e reinstale o app —
o ícone na tela inicial do celular já aparece atualizado.

## Sobre a paridade com o app web
O wizard do overlay agora segue exatamente a mesma ordem de etapas do
modal "Pop-up Rápido" do app web (que também foi simplificado pra ter
só o modo passo a passo, sem o modo "formulário completo"):

**Tipo → Valor → Categoria → Data → Descrição → Confirmar**

A etapa de Data tem os botões rápidos "Hoje" / "Ontem" e um campo pra
digitar outra data manualmente (DD/MM/AAAA) — no overlay não dá pra usar
um calendário visual completo (isso exigiria muito mais código nativo
pra pouco ganho), mas o resultado funcional é o mesmo.

## Nova seção "Meus Cartões" no overlay
Na tela inicial do overlay (etapa Tipo), agora tem um botão **"💳 Ver
Cartões"** que abre uma lista com todos os seus cartões, mostrando o
quanto já foi usado no mês atual (mesma lógica do app web) e um botão
**"Pagar Fatura"** por cartão — que funciona igual ao do painel web:
cria uma despesa separada (sem vínculo a cartão), que essa sim conta no
total do mês.

## Limitações / pontos de atenção
- **Permissão de overlay**: em alguns fabricantes (Xiaomi, Samsung) o
  Android some com o app da lista se ele ficar muito tempo sem abrir —
  teste a persistência depois de instalar.
- **Firestore sem autenticação**: o código grava direto usando a mesma
  API key pública do projeto, do jeito que o app web já faz hoje (sem
  login). Se algum dia você adicionar autenticação, esse arquivo
  (`FirestoreSync.kt`) precisa de ajuste.
- Não testei compilação real — se der erro de import/versão de
  dependência do Capacitor, me manda o log do Android Studio que eu
  ajusto.
