/**
 * Catálogo de vocações disponíveis na criação/edição de personagem.
 * Conteúdo de mesa enviado pelo usuário; habilidades são criadas na ficha
 * com tags de origem e podem ser aprimoradas no seletor.
 */
export const VOCACOES = [
  {
    chave: "cientista", nome: "Cientista", habilidade: "Foco Mental",
    grupo: "idolo", custo: 2, custoAprimorado: 4,
    descricao: "Quando faz um teste de Mente, você pode gastar 2 PD para somar +1d4 nesse teste.",
    aprimorado: "O custo passa a 4 PD e o dado adicional passa a +1d8.",
    efeito: { tipo: "dado-extra", dado: "d4", chaves: ["mente"] },
    efeitoAprimorado: { tipo: "dado-extra", dado: "d8", chaves: ["mente"] },
  },
  {
    chave: "operario", nome: "Operário", habilidade: "Esforço e Suor",
    grupo: "idolo", grupoPericia: "fisico",
    descricao: "Escolha uma perícia física. Ela aumenta para d6.",
    aprimorado: "A perícia escolhida aumenta para d8.",
  },
  {
    chave: "professor", nome: "Professor", habilidade: "Mentoria",
    grupo: "idolo",
    descricao: "Quando você ajuda um personagem, pode fazer um teste da perícia escolhida contra DT 7. Se passar, o personagem ajudado pode substituir o valor de um dos dados que rolou pela sua RA.",
    aprimorado: "O aliado pode substituir o valor de um dado pela sua RA mesmo que você não passe na DT.",
  },
  {
    chave: "medico", nome: "Médico", habilidade: "Técnica Medicinal",
    grupo: "idolo",
    descricao: "Sempre que usa um efeito de cura, você cura +1 PV por dado.",
    aprimorado: "O bônus de cura aumenta para +2 PV por dado.",
  },
  {
    chave: "profissional-escritorio", nome: "Profissional de escritório", habilidade: "Conhecimento Técnico",
    grupo: "idolo", grupoPericia: "mente",
    descricao: "Escolha uma perícia mental. Ela aumenta para d6.",
    aprimorado: "A perícia escolhida aumenta para d8.",
  },
  {
    chave: "artista", nome: "Artista", habilidade: "Foco Emocional",
    grupo: "idolo", custo: 2, custoAprimorado: 4,
    descricao: "Quando faz um teste de Emoção, você pode gastar 2 PD para somar +1d4 nesse teste.",
    aprimorado: "O custo passa a 4 PD e o dado adicional passa a +1d8.",
    efeito: { tipo: "dado-extra", dado: "d4", chaves: ["emocao"] },
    efeitoAprimorado: { tipo: "dado-extra", dado: "d8", chaves: ["emocao"] },
  },
  {
    chave: "militar", nome: "Militar", habilidade: "Para Bellum",
    grupo: "idolo",
    descricao: "Você recebe proficiência e +2 de dano com armas de fogo.",
    aprimorado: "O bônus de dano com armas de fogo aumenta para +5.",
  },
  {
    chave: "policial", nome: "Policial", habilidade: "Linha de Tiro",
    grupo: "idolo", custo: 2, custoAprimorado: 4,
    descricao: "Você recebe proficiência com armas de fogo e pode gastar 2 PD para receber +1d6 no teste de ataque com elas.",
    aprimorado: "O custo passa a 4 PD e o dado adicional passa a +1d10.",
    efeito: { tipo: "dado-extra", dado: "d6", chaves: ["pontaria"] },
    efeitoAprimorado: { tipo: "dado-extra", dado: "d10", chaves: ["pontaria"] },
  },
  {
    chave: "atleta", nome: "Atleta", habilidade: "Foco Físico",
    grupo: "hb", custo: 2, custoAprimorado: 4,
    descricao: "Quando faz um teste de Físico, você pode gastar 2 PD para somar +1d4 nesse teste.",
    aprimorado: "O custo passa a 4 PD e o dado adicional passa a +1d8.",
    efeito: { tipo: "dado-extra", dado: "d4", chaves: ["fisico"] },
    efeitoAprimorado: { tipo: "dado-extra", dado: "d8", chaves: ["fisico"] },
  },
  {
    chave: "criminoso", nome: "Criminoso", habilidade: "Mestre em Invasões",
    grupo: "hb",
    descricao: "Sempre que realizar um desafio de acesso para destravar uma tranca, você imediatamente sabe o valor de um dos dados.",
    aprimorado: "Você passa a saber o valor de dois dados.",
  },
  {
    chave: "magnata", nome: "Magnata", habilidade: "Patrocinador da Ordem",
    grupo: "hb",
    descricao: "Você recebe +2 espaços de compra.",
    aprimorado: "O bônus aumenta para +5 espaços de compra.",
  },
  {
    chave: "engenheiro", nome: "Engenheiro", habilidade: "Magnum Opus",
    grupo: "hb",
    descricao: "Você recebe um item especial de custo até 2 sem gastar espaços de compra.",
    aprimorado: "O item especial não possui mais limite de custo.",
  },
  {
    chave: "diplomata", nome: "Diplomata", habilidade: "Fala Mansa",
    grupo: "hb", grupoPericia: "emocao",
    descricao: "Escolha uma perícia emocional. Ela aumenta para d6.",
    aprimorado: "A perícia escolhida aumenta para d8.",
  },
  {
    chave: "estudante", nome: "Estudante", habilidade: "Empenho",
    grupo: "hb", custo: 2, custoAprimorado: 4,
    descricao: "Você pode gastar 2 PD para aumentar um atributo em um passo para um único teste.",
    aprimorado: "Você pode gastar 4 PD para aumentar tanto o dado de atributo quanto o de perícia em um passo para um único teste.",
  },
  {
    chave: "desgarrado", nome: "Desgarrado", habilidade: "Calejado",
    grupo: "hb", custo: 2, custoAprimorado: 4,
    descricao: "Você pode gastar 2 PD para anular o efeito de uma condição que esteja sofrendo.",
    aprimorado: "Uma vez por cena, você pode gastar 4 PD para reduzir em 5 pontos o dano que esteja prestes a sofrer.",
  },
  {
    chave: "lutador", nome: "Lutador", habilidade: "Mão Pesada",
    grupo: "hb",
    descricao: "Seus ataques desarmados causam RA+2 de dano.",
    aprimorado: "Seus ataques desarmados causam RA+5 de dano.",
  },
];
