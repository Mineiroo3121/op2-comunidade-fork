# Publicação — Ordem Paranormal 2 Edição

## Identificação do pacote

- Nome: Ordem Paranormal 2 Edição
- ID: `op2-comunidade-fork`
- Versão inicial: `0.1.0`
- Mantenedor: Mineiro
- Repositório: https://github.com/Mineiroo3121/op2-comunidade-fork
- Contato: Fabianoolucas4@gmail.com
- Compatibilidade declarada: Foundry VTT 13 (mínimo) e 14 (verificado no manifesto).

## Publicar uma versão

1. Mantenha este repositório público no GitHub.
2. Envie as alterações para a branch `main`.
3. Crie e envie uma tag no formato `vX.Y.Z` (para a primeira versão, `v0.1.0`).
4. O workflow `.github/workflows/release.yml` executa as verificações, compila o CSS, prepara o ZIP e cria a GitHub Release com o manifesto.
5. Confira os arquivos gerados na Release antes de enviar ou atualizar a listagem do Foundry.

## Submissão ao Foundry

- Página de submissão: https://foundryvtt.com/creators/submit/
- Tipo de pacote: Game System.
- URL do pacote: https://github.com/Mineiroo3121/op2-comunidade-fork
- URL do manifesto após a primeira Release: https://github.com/Mineiroo3121/op2-comunidade-fork/releases/latest/download/system.json

A submissão depende dos requisitos atuais do Foundry, incluindo licença ativa e revisão da equipe. Após aprovação e emissão de um token de publicação, configure `FOUNDRY_RELEASE_TOKEN` nos segredos do GitHub Actions para automatizar o registro de versões futuras.

## Créditos, licenças e conteúdo

O projeto-base foi desenvolvido por Sérgio Sousa. O código mantém a licença GPL-3.0-only e os créditos originais. A licença do código não substitui a Licença da Comunidade de Ordem Paranormal: confirme que imagens, fontes, ícones e demais recursos podem ser redistribuídos. Não adicione páginas, capítulos ou artes oficiais sem a autorização/licença apropriada.

## Uso de ferramentas de IA

O desenvolvimento deste fork contou com assistência de IA. O mantenedor deve revisar, compreender, testar e ser capaz de manter o código. Não marque o pacote como “Zero AI”. A descrição acima foi fornecida pelo mantenedor.
