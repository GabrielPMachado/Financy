# Changelog

Todas as mudanças relevantes do Financy ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). A versão é a mesma do `package.json`.

## [2.1.0] - 2026-11-20

### Adicionado
- Ajustes › Contas e conexões: conta Financy, Órbita, bancos (token do GitHub) e notificações num lugar só, com o estado de cada um. Tocar abre os botões para entrar/conectar e para testar a conexão de verdade, com o resultado logo abaixo.
- Notificações no app do iPhone: lembrete um dia antes do vencimento da fatura de cada cartão e de cada dívida planejada, às 9h, com botão de notificação de teste.
- O Financy mostra quando o Órbita foi visto pela última vez (o Órbita avisa ao abrir).

### Mudado
- O token do GitHub e o "Conectar ao Órbita" passaram para Contas e conexões.

## [2.0.0] - 2026-11-16

O Financy passa a ser um app para web e iPhone, com app nativo e ligado ao Órbita.

### Removido
- Versão Android: o Financy é só para web e iPhone. Por isso a versão sobe para 2.0.0.

### Adicionado
- **App nativo para iPhone** (Capacitor) com links `financy://`, gerado como `.ipa` pelo GitHub Actions para instalar pelo Sideloadly.
- Ligação com o **Órbita**: botão do Órbita, categoria das compras do Apple Pay e aparência compartilhada (cores, roda de intensidade e estilos de ícone).
- Ícone novo (cartão), irmão do ícone do Órbita, em 5 estilos e 6 cores, com versões escura e tingida do iOS 18.
- Estilos Vidro e Gradiente para os ícones das listas.

### Alterado
- Menu inferior no mesmo desenho do Órbita (Início, Contas, Análise, Ajustes); chaves e sincronização manual ficam em Ajustes › Avançado, e sai o botão de sincronizar do topo.
- Compra do Apple Pay vinda do Órbita é trocada pela compra do banco, sem duplicar.

### Corrigido
- A sessão do Meu Pluggy é salva mesmo quando a sincronização falha.

## [1.3.0] - 2026-11-02
<!-- commit: 2d9a527fcf88e9efd0625a9e5ac9fdef537ce9c4 -->

### Adicionado
- Login automático no Meu Pluggy pelo link mágico do e-mail (Gmail): a sincronização roda inteira na nuvem, sem depender do PC.
- Mercado Pago e Nubank atualizados de hora em hora.
- Aviso no celular (ntfy) ao fim das sincronizações manuais, com quantos lançamentos entraram ou o motivo da falha. Só contagens saem do GitHub.
- Transferências entre contas próprias ficam fora de receitas, despesas e gráficos (o saldo continua igual).
- Efeito de vidro (Liquid Glass) na barra de navegação, no cabeçalho e nos botões.

### Alterado
- O botão de sincronizar do topo atualiza os dois bancos.

### Removido
- Formas de sincronizar que dependiam do PC (tarefas agendadas do Windows e exportação manual da sessão).

### Corrigido
- Aviso do ntfy que não chegava ao celular.
- Altura da barra de navegação inferior e área segura no iPhone.

## [1.2.0] - 2026-10-29
<!-- commit: 714d65ab3a2fdef3a5379e7d3aa6bebd4196c328 -->

### Adicionado
- Atalhos do iPhone: resumo do mês e novo trabalho freelancer, pela fila rápida no Firestore.
- Resumo em cartão com mini gráficos (saldo dos últimos dias, anel de gasto e categorias), pensado para o popup de vidro do iOS.
- Ilha de resumo (`?action=resumo`) e lançamento rápido (`?action=quick-add`).
- Login por redirecionamento no iPhone.

## [1.1.0] - 2026-10-20
<!-- commit: 42954119e8e1d0b96c87b82e13150ec13517b978 -->

### Adicionado
- **PWA** publicado no Firebase Hosting, instalável pela Tela de Início do iPhone.
- Calculadora freelancer com feriados nacionais, do RS e de Porto Alegre pagando como domingo.
- Sincronização rápida e por banco, com mensagens de erro pela causa.
- Login automático no Meu Pluggy quando a sessão expira, com sessão em cache e renovação automática.

### Corrigido
- Renovação da sessão confere o token do GitHub antes e avisa cada falha com mensagem própria.

## [1.0.0] - 2026-10-11
<!-- commit: a693173beb6b1a3569a20dd614e2444a1df4ba27 -->

Reescrita completa: primeira versão estável.

### Adicionado
- App React + Capacitor (web e Android) com Firebase Auth e Firestore, regras por usuário e funcionamento offline.
- Redesign inspirado em apps de banco, com tema claro, escuro ou automático.
- **Sincronização bancária via Open Finance** (Pluggy + Meu Pluggy): Nubank e Mercado Pago importados de hora em hora pelo GitHub Actions, com o Meu Pluggy atualizado na nuvem antes de cada importação.
- Botão Sincronizar agora no app, que dispara o workflow.
- Horário nas transações e vínculo do Pix recebido ao pagamento freelance.

### Alterado
- A importação considera só transações a partir de 01/10/2026 e cria lançamentos de saldo inicial para o saldo do app bater com o dos bancos.

## Antes do 1.0

- **2026-07-17**: versão inicial em Vite e uma segunda versão (V2), substituídas pela reescrita do 1.0.

[2.0.0]: https://github.com/GabrielPMachado/Financy/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/GabrielPMachado/Financy/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/GabrielPMachado/Financy/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/GabrielPMachado/Financy/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/GabrielPMachado/Financy/releases/tag/v1.0.0
