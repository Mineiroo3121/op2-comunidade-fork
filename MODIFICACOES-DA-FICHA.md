# Modificações personalizadas — Fichas de personagem

Esta cópia foi preparada sobre a versão `0.11.2` do sistema `op2-comunidade-fork-fvtt`.

## O que mudou

- **Nome:** continua editável diretamente no cabeçalho da ficha.
- **Aparência por personagem:** o mestre pode selecionar `Seguir modo do mundo`, `Moderno` ou `Vigília` na própria ficha. A preferência é armazenada em uma flag do ator; não altera a configuração global do mundo. A escolha individual controla a apresentação visual da ficha, sem trocar as regras globais do mundo.
- **Moderno:** preserva as cores por perfil (Executor, Analista e Vigilante).
- **Vigília:** aplica a paleta escura/prateada e os elementos visuais do modo Vigília mesmo quando o mundo está configurado como Moderno.
- **Habilidades, itens e ferramentas:** os botões de inclusão consultam os compêndios do tipo correspondente. Quando existem entradas, é possível escolher entre selecionar uma entrada do compêndio ou criar do zero. O documento criado é anexado ao personagem e sua ficha de item é aberta.
- **Condições/efeitos:** a aba foi simplificada para uma lista de efeitos ativos com remoção direta e inclusão por seletor. A aplicação de condições que já é determinada por resultados de ações de combate agora acontece automaticamente nos sucessos de Agarrar, Derrubar, Empurrar (quando o resultado exige) e Atrapalhar/Fintar. Os resultados que falham ainda deixam a possibilidade de intervenção do mestre nos cards. O motor existente continua cuidando da duração/remoção de condições de rodada e dos efeitos de lesões/traumas.
- **Pavor:** o controle foi removido da ficha de personagem. O dado/estado interno foi preservado para não apagar informação de personagens existentes ou quebrar outras regras que ainda consultem esse dado.
- **Vínculos:** saíram da aba de condições e ganharam uma aba própria. Um vínculo é criado selecionando outro personagem do mundo, e a ficha mostra retrato, nome, rótulo, grau e ação de invocar. Novos vínculos guardam a referência do ator; vínculos antigos continuam usando o campo de nome como fallback.
- **Botão Ações:** removido do cabeçalho da ficha. O painel de ações do sistema continua disponível pelos atalhos já existentes (por padrão, `Shift+I`).

## Observações de escopo

A escolha individual entre Moderno e Vigília é uma escolha de **aparência da ficha**, não uma troca isolada do conjunto de regras do mundo. O próprio sistema usa configurações globais para regras e resolução de ações. Alterar essas regras por personagem exigiria uma migração maior do motor e não seria seguro tratá-la como uma simples mudança de tema.

A arquitetura original do projeto não usa Active Effects do Foundry para os modificadores de passo de dado. As alterações preservam o modelo próprio de estado/condição do sistema e seus mecanismos existentes de duração.

## Como gerar os artefatos de instalação

O ZIP de fontes recebido não contém `styles/op2.css` nem os bancos LevelDB dos compêndios; o projeto os gera durante o build. Nesta cópia, os arquivos JSON auxiliares das aventuras foram gerados, mas o build completo não pôde ser executado neste ambiente porque a instalação das dependências npm foi interrompida e deixou pacotes incompletos.

Em um ambiente com Node.js 22 ou superior e acesso ao registry npm, execute na raiz desta pasta:

```bash
npm ci
npm run check
npm run pack:build
```

Depois copie a pasta do sistema para `Data/systems/op2-comunidade-fork` na instalação do Foundry (faça backup da pasta anterior antes de substituir). Não copie `node_modules` para o Foundry.

## Verificação realizada nesta preparação

- Sintaxe JavaScript: `node --check` nos 143 módulos `.mjs`.
- JSON: `system.json`, `lang/pt-BR.json` e `lang/en.json` válidos.
- Blocos Handlebars: cabeçalho, abas, habilidades, inventário, condições e vínculos conferidos quanto à abertura/fechamento dos blocos.
- Testes Node: 217 de 218 passaram. O teste restante não chegou a iniciar porque o pacote `handlebars` ficou ausente/incompleto após a instalação npm interrompida (`ERR_MODULE_NOT_FOUND`).
- Lint, compilação Sass e geração dos compêndios LevelDB não puderam ser validados aqui por falta de dependências instaladas.
- A ficha ainda precisa de teste visual e funcional dentro de uma mesa Foundry v13/v14 real.
