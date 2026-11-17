# Changelog

Todas as mudanças relevantes do Financy ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). A versão é a mesma do `package.json`.

## [1.0.0] - 2026-11-16

Primeira versão estável: o Financy vira um app de finanças pessoais para web e iPhone, com os bancos entrando sozinhos via Open Finance.

### Adicionado
- **App nativo para iPhone** (Capacitor) com links `financy://`, gerado como `.ipa` pelo GitHub Actions para instalar pelo Sideloadly.
- **PWA** publicado no Firebase Hosting a cada push na `main`, instalável pela Tela de Início do iPhone.
- **Sincronização bancária via Open Finance** (Pluggy + Meu Pluggy): Nubank e Mercado Pago importados de hora em hora pelo GitHub Actions, com login automático no Meu Pluggy pelo link do e-mail.
- Botão de sincronizar no app, que dispara o workflow e atualiza os dois bancos.
- Aviso no celular (ntfy) ao fim das sincronizações manuais, com quantos lançamentos entraram ou o motivo da falha. Só contagens saem do GitHub.
- Transferências entre contas próprias ficam fora de receitas, despesas e gráficos (o saldo continua igual).
- Horário nas transações e vínculo do Pix recebido ao pagamento freelance.
- Calculadora freelancer com feriados nacionais, do RS e de Porto Alegre pagando como domingo.
- Atalhos do iPhone: resumo do mês em cartão com mini gráficos e novo trabalho freelancer pela fila rápida.
- Ligação com o **Órbita**: botão do Órbita, categoria das compras do Apple Pay e aparência compartilhada (cores, roda de intensidade e estilos de ícone).
- Ícone novo (cartão), irmão do ícone do Órbita, em 5 estilos e 6 cores, com versões escura e tingida do iOS 18.
- Efeito de vidro (Liquid Glass) na barra de navegação, no cabeçalho e nos botões.
- Tema claro, escuro ou automático e redesign inspirado em apps de banco.

### Alterado
- Menu inferior no mesmo desenho do Órbita (Início, Contas, Análise, Ajustes); chaves e sincronização manual ficam em Ajustes › Avançado.
- Compra do Apple Pay vinda do Órbita é trocada pela compra do banco, sem duplicar.
- A importação considera só transações a partir de 01/10/2026 e cria lançamentos de saldo inicial para o saldo do app bater com o dos bancos.

### Removido
- Versão Android: o Financy é só para web e iPhone.
- Formas de sincronizar que dependiam do PC (tarefas agendadas do Windows e exportação manual da sessão).

### Corrigido
- Altura da barra de navegação inferior e área segura no iPhone.
- Aviso do ntfy que não chegava ao celular.

## Antes do 1.0

- **2026-07-17**: versão inicial em Vite e uma segunda versão (V2), substituídas pela reescrita do 1.0.

[1.0.0]: https://github.com/GabrielPMachado/Financy/releases/tag/v1.0.0
