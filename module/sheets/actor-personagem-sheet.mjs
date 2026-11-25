/**
 * Ficha do personagem.
 *
 * Segue a diagramação da ficha oficial do playtest: cada perícia mostra o *par* de
 * dados que será rolado — o dado da perícia e o do atributo pareado — em vez de um
 * seletor de texto. É a leitura que o livro usa e a que torna a ficha escaneável.
 */
import { SYSTEM_ID, ESCADA, DADO_SOBRE_HUMANO, ATRIBUTOS, PERICIAS, PERFIS, periciasDoModo, chaveDoRotuloDePericia, chaveDoRotuloDeOcupacao, aptidoesDoModo, aptidaoVisivel } from "../config.mjs";
import { VOCACOES } from "../data/vocacoes.mjs";
import { modoAtual, usaCombateNovo } from "../modo.mjs";
import { MAX_MARCADORES } from "../config.mjs";
import { CONDICOES } from "../vigilia/combate.mjs";
import { PATAMARES, LESOES, TRAUMAS } from "../vigilia/dano.mjs";
import { rolarTesteBeta, rolarTabelaBeta, dadosDosMaximos } from "../vigilia/queda.mjs";
import { podeInvocar } from "../vigilia/relacoes.mjs";
import { analisar as analisarAcao, invocarRelacao } from "../vigilia/acoes-ficha.mjs";
import { stepDie } from "../dice/escada.mjs";
import { rolarTeste } from "../dice/teste.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";
import { lerConfig } from "../settings/register.mjs";
import { encerrarCena } from "../cena/encerrar-investigacao.mjs";
import { enriquecerHtml as enriquecer } from "../ui/enriquecer.mjs";
import { ligarRodaDoMouse } from "../ui/controle-dado.mjs";
import { renderDoPerfil } from "../ui/perfil.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/** Lê custos numéricos da habilidade, inclusive quando só aparecem na descrição. */
function custosDaAcao(item) {
  const sistema = item?.system ?? {};
  const descricao = String(sistema.descricao ?? "").replace(/<[^>]*>/g, " ");
  const custo = String(sistema.custo ?? "");
  const pdExplicito = Number(sistema.custoPD ?? 0);
  const pdNoCampo = /(\d+)\s*(?:pontos?\s+de\s*)?pd\b/i.exec(custo);
  const pvNoCampo = /(\d+)\s*(?:pontos?\s+de\s*)?pv\b/i.exec(custo);
  const pdNaDescricao = /(?:por|gastar|gaste|custa|custe|ao custo de)\s*(\d+)\s*(?:pontos?\s+de\s*)?pd\b/i.exec(descricao);
  const pvNaDescricao = /(?:por|gastar|gaste|custa|custe|ao custo de)\s*(\d+)\s*(?:pontos?\s+de\s*)?pv\b/i.exec(descricao);
  const pd = pdExplicito > 0 ? pdExplicito : Number(pdNoCampo?.[1] ?? pdNaDescricao?.[1] ?? 0);
  const pv = Number(pvNoCampo?.[1] ?? pvNaDescricao?.[1] ?? 0);
  const partes = [];
  if (pd > 0) partes.push(`${pd} PD`);
  if (pv > 0) partes.push(`${pv} PV`);
  return { custoPD: pd, custoPV: pv, custoRotulo: partes.length ? `Gastar ${partes.join(" e ")}` : "Usar" };
}

const TAGS_HABILIDADE = [
  "Vigilia", "Idolo", "Oficial", "HB", "Vocação",
  "Executor", "Analista", "Vigilante", "Sem custo", "Com custo",
];

/** Tags automáticas para que o navegador consiga filtrar também itens antigos. */
function tagsHabilidade(sistema, colecao, pacote, rotuloPacote) {
  const tags = new Set(
    (Array.isArray(sistema.tags) ? sistema.tags : String(sistema.tags ?? "").split(","))
      .map((tag) => String(tag).trim()).filter(Boolean),
  );
  const chaveColecao = String(colecao ?? "").toLocaleLowerCase();
  const chavePacote = String(pacote ?? "").toLocaleLowerCase();
  const chaveRotulo = String(rotuloPacote ?? "").toLocaleLowerCase();
  const eVigilia = chaveColecao.includes("vigilia") || chavePacote.includes("vigilia") || chaveRotulo.includes("vigilia");
  tags.add(eVigilia ? "Vigilia" : "Idolo");
  if (![...tags].some((t) => ["oficial", "hb"].includes(t.toLocaleLowerCase()))) {
    const rotuloIndicaHB = /\bhb\b|homebrew/i.test(`${rotuloPacote ?? ""} ${colecao ?? ""}`);
    tags.add(chaveColecao.startsWith(`${SYSTEM_ID}.`) && !rotuloIndicaHB ? "Oficial" : "HB");
  }
  if (sistema.origem === "ocupacao") tags.add("Vocação");
  if (sistema.origem === "perfil" && sistema.perfil) {
    const perfil = { executor: "Executor", analista: "Analista", vigilante: "Vigilante" }[sistema.perfil];
    if (perfil) tags.add(perfil);
  }
  const custo = String(sistema.custo ?? "").trim();
  const custoPD = Number(sistema.custoPD ?? 0);
  const semCusto = (!custo || /sem\s*custo|gratuito/i.test(custo)) && !(custoPD > 0);
  tags.add(semCusto ? "Sem custo" : "Com custo");
  return [...tags];
}

export class PersonagemSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha", "op2-ficha--personagem"],
    position: { width: 880, height: 860 },
    window: { resizable: true, icon: "fa-solid fa-user-secret" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      testeQueda: PersonagemSheet.#testeQueda,
      tabelaQueda: PersonagemSheet.#tabelaQueda,
      porBonus: PersonagemSheet.#porBonus,
      anotar: PersonagemSheet.#anotar,
      porRelacao: PersonagemSheet.#porRelacao,
      tirarRelacao: PersonagemSheet.#tirarRelacao,
      analisar: PersonagemSheet.#analisar,
      invocarRelacao: PersonagemSheet.#invocarRelacao,
      alternarCondicao: PersonagemSheet.#alternarCondicao,
      tirarBonus: PersonagemSheet.#tirarBonus,
      curar: PersonagemSheet.#curar,
      rolar: PersonagemSheet.#rolar,
      abrirDialogoTeste: PersonagemSheet.#abrirDialogoTeste,
      definirRecurso: PersonagemSheet.#definirRecurso,
      passoDado: PersonagemSheet.#passoDado,
      escolherDado: PersonagemSheet.#escolherDado,
      abrirSeletor: PersonagemSheet.#abrirSeletor,
      criarItem: PersonagemSheet.#criarItem,
      editarNomePericia: PersonagemSheet.#editarNomePericia,
      selecionarOcupacao: PersonagemSheet.#selecionarOcupacao,
      adicionarCondicao: PersonagemSheet.#adicionarCondicao,
      alternarEquipado: PersonagemSheet.#alternarEquipado,
      ajustarCarga: PersonagemSheet.#ajustarCarga,
      editarItem: PersonagemSheet.#editarItem,
      apagarItem: PersonagemSheet.#apagarItem,
      adicionarAptidao: PersonagemSheet.#adicionarAptidao,
      removerAptidao: PersonagemSheet.#removerAptidao,
      encerrarCena: PersonagemSheet.#encerrarCena,
      definirImpeto: PersonagemSheet.#definirImpeto,
      gastarImpetoAtributo: PersonagemSheet.#gastarImpetoAtributo,
      usarAcao: PersonagemSheet.#usarAcao,
    },
  };

  static PARTS = {
    cabecalho: { template: "systems/op2-comunidade-fork/templates/actor/personagem-cabecalho.hbs" },
    abas: { template: "systems/op2-comunidade-fork/templates/actor/personagem-abas.hbs" },
    habilidades: { template: "systems/op2-comunidade-fork/templates/actor/personagem-habilidades.hbs" },
    acoes: { template: "systems/op2-comunidade-fork/templates/actor/personagem-acoes.hbs" },
    rituais: { template: "systems/op2-comunidade-fork/templates/actor/personagem-rituais.hbs" },
    inventario: { template: "systems/op2-comunidade-fork/templates/actor/personagem-inventario.hbs" },
    notas: { template: "systems/op2-comunidade-fork/templates/actor/personagem-notas.hbs" },
    vinculos: { template: "systems/op2-comunidade-fork/templates/actor/personagem-vinculos.hbs" },
    condicao: { template: "systems/op2-comunidade-fork/templates/actor/personagem-condicao.hbs" },
    pericias: { template: "systems/op2-comunidade-fork/templates/actor/personagem-pericias.hbs" },
  };

  static TABS = {
    principal: {
      tabs: [{ id: "habilidades" }, { id: "acoes" }, { id: "rituais" }, { id: "inventario" }, { id: "condicao" }, { id: "vinculos" }, { id: "notas" }],
      initial: "habilidades",
      labelPrefix: "OP2.Aba",
    },
  };

  /** A aba "Condição" é do beta: com o combate antigo, ela não existe. */
  _getTabsConfig(grupo) {
    const config = foundry.utils.deepClone(super._getTabsConfig(grupo));
    if (grupo === "principal" && !usaCombateNovo()) config.tabs = config.tabs.filter((t) => t.id !== "condicao");
    return config;
  }

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.actor.system;
    const modoFicha = this.#modoFicha();

    return {
      ...contexto,
      actor: this.actor,
      sistema,
      // `fields` alimenta o {{formInput}}; sem ele o editor de texto rico não sobe.
      fields: this.actor.system.schema.fields,
      editavel: this.isEditable,
      ehGM: game.user.isGM,
      modoFicha,
      atributos: this.#atributos(sistema),
      pericias: this.#pericias(sistema, modoFicha),
      aptidoes: this.#aptidoes(sistema, modoFicha),
      ...this.#contextoDaCondicao(sistema),
      rotuloOcupacao: game.i18n.localize(chaveDoRotuloDeOcupacao(modoFicha)),
      rotuloOcupacaoMinusculo: game.i18n.localize(chaveDoRotuloDeOcupacao(modoFicha)).toLowerCase(),
      recursos: {
        pv: this.#recurso(sistema.recursos.pv, "pv"),
        pd: this.#recurso(sistema.recursos.pd, "pd"),
      },
      perfis: PERFIS.map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Perfil.${chave}`) })),
      afinidades: [
        { chave: "nenhuma", rotulo: "Sem afinidade" },
        { chave: "sangue", rotulo: "Sangue" },
        { chave: "energia", rotulo: "Energia" },
        { chave: "conhecimento", rotulo: "Conhecimento" },
        { chave: "morte", rotulo: "Morte" },
      ],
      afinidadeIcone: ({
        nenhuma: "fa-solid fa-circle",
        sangue: "fa-solid fa-droplet",
        energia: "fa-solid fa-bolt",
        conhecimento: "fa-solid fa-eye",
        morte: "fa-solid fa-skull",
      })[sistema.afinidade || "nenhuma"],
      // Opções do seletor de dado, com o ícone já renderizado.
      escada: ESCADA.map((dado) => ({ dado, icone: iconeDado(dado) })),
      escadaAtributo: [...ESCADA, DADO_SOBRE_HUMANO].map((dado) => ({ dado, icone: iconeDado(dado) })),
      // A barra de Ímpeto é a própria habilidade: o estado vem do item, e some com ele.
      habilidades: await Promise.all(this.actor.items
        .filter((i) => i.type === "habilidade")
        .map(async (item) => ({
        item,
        tags: String(item.system.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        // A descrição é a regra da habilidade: sem ela na ficha, o jogador precisa
        // abrir o item para lembrar o que ela faz (achado em uso real).
        descricao: await enriquecer(item.system.descricao, item),
        barra: item.system.temBarraImpeto ? {
          espacos: Array.from({ length: item.system.impeto.espacos }, (_, i) => ({
            n: i + 1, cheio: i < item.system.impeto.preenchidos,
          })),
          cheia: item.system.impetoCheio,
        } : null,
      }))),
      acoes: await Promise.all(this.actor.items
        .filter((i) => i.type === "habilidade" && (i.system.acao === true || i.system.uso === true || i.system.tipo === "acao" || /ação|acao/i.test(String(i.system.tags ?? ""))))
        .map(async (item) => ({
          id: item.id,
          name: item.name,
          img: item.img,
          descricao: await enriquecer(item.system.descricao ?? "", item),
          ...custosDaAcao(item),
        }))),
      rituais: this.actor.items.filter((i) => i.type === "ritual" || (i.type === "habilidade" && (i.system.tipo === "ritual" || /ritual/i.test(String(i.system.tags ?? ""))))),
      equipamentos: this.actor.items.filter((i) => i.type === "equipamento"),
      ferramentas: this.actor.items.filter((i) => i.type === "ferramenta"),
      temReducao: Object.values(sistema.estado.reducoesTemporarias).some((n) => n > 0),
      // O aumento precisa aparecer na ficha: sem isso o jogador gasta os três espaços
      // do Ímpeto e não tem onde conferir que o dado subiu (achado em uso real).
      aumentos: Object.entries(sistema.estado.aumentosTemporarios)
        .filter(([, passos]) => passos > 0)
        .map(([chave, passos]) => ({
          chave, passos,
          rotulo: game.i18n.localize(`OP2.Atributo.${chave}`),
          dado: sistema.atributos[chave].dadoEfetivo,
          base: sistema.atributos[chave].die,
        })),
      // Barra de ímpeto: mesma leitura dos traços de recurso — um espaço por
      // clique, preenchidos primeiro.
      biografia: await enriquecer(sistema.biografia, this.actor),
    };
  }

  /** A aba "Condição" (beta §7–§9, §12). */
  #contextoDaCondicao(sistema) {
    const nomeDe = (i18n, chave) => ({
      nome: game.i18n.localize(`${i18n}.${chave}.nome`),
      efeito: game.i18n.localize(`${i18n}.${chave}.efeito`),
    });
    return {
      ehGM: game.user.isGM,
      temAnalise: this.actor.items.some((i) => i.type === "habilidade" && i.system.mecanica === "analise"),
      maxMarcadores: MAX_MARCADORES,
      patamares: PATAMARES.map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Patamar.${chave}`), atual: chave === sistema.patamar })),
      condicoes: CONDICOES.map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Condicao.${chave}`), ativa: sistema.estado.condicoes.has(chave) })),
      condicoesAtivas: [...sistema.estado.condicoes].map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Condicao.${chave}`) })),
      relacoes: sistema.relacoes.map((r, indice) => {
        const vinculado = r.atorUuid ? game.actors.get(r.atorUuid) : null;
        return { ...r, indice, nomePersonagem: r.com || vinculado?.name || game.i18n.localize("OP2.Vinculo.SemPersonagem"), img: vinculado?.img || "icons/svg/mystery-man.svg", podeInvocar: podeInvocar(r), pips: [r.grau >= 1, r.grau >= 2, r.grau >= 3] };
      }),
      bonus: sistema.estado.bonus,
      opcoesLesao: LESOES.filter((l) => l.perm).map((l) => ({ chave: l.chave, rotulo: game.i18n.localize(`OP2.Lesao.${l.chave}.nome`) })),
      opcoesTrauma: TRAUMAS.filter((l) => l.perm).map((l) => ({ chave: l.chave, rotulo: game.i18n.localize(`OP2.TraumaBeta.${l.chave}.nome`) })),
      lesoes: sistema.estado.lesoes.map((c) => nomeDe("OP2.Lesao", c)),
      traumas: sistema.estado.traumas.map((c) => nomeDe("OP2.TraumaBeta", c)),
    };
  }

  static #testeQueda(_evento, alvo) { return rolarTesteBeta(this.actor, alvo.dataset.tipo); }
  static #tabelaQueda(_evento, alvo) { return rolarTabelaBeta(this.actor, alvo.dataset.tipo); }

  /** Dado guardado à mão: crucifixo, plano, o que a mesa decidir. */
  static async #porBonus() {
    const novo = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Condicao2.PorDado") },
      content: `<div class="form-group"><select name="dado">${["d4", "d6", "d8", "d10", "d12"].map((d) => `<option>${d}</option>`).join("")}</select>
        <input type="text" name="rotulo" placeholder="${game.i18n.localize("OP2.Relacao.Rotulo")}"></div>`,
      ok: { callback: (_e, b) => ({ dado: b.form.elements.dado.value, rotulo: b.form.elements.rotulo.value.trim() }) },
      rejectClose: false,
    });
    if (!novo) return null;
    return this.actor.update({ "system.estado.bonus": [...this.actor.system.estado.bonus, novo] });
  }

  /** Anotar lesão ou trauma sem rolar: só o registro, que é o que pesa nos testes. */
  static #anotar(_evento, alvo) {
    const { lista } = alvo.dataset;
    const chave = alvo.closest("[data-nova]").querySelector("[name=novaLista]").value;
    return this.actor.update({
      [`system.estado.${lista}`]: [...this.actor.system.estado[lista], chave],
      ...dadosDosMaximos(this.actor, lista, chave, -1),
    });
  }

  static async #porRelacao() {
    // A Collection do Foundry expõe os documentos em `.contents`; usar a coleção
    // diretamente pode devolver pares chave/valor dependendo da implementação.
    // Também aceitamos NPCs: um vínculo pode apontar para outro ator da mesa.
    const todosAtores = game.actors.contents ?? Array.from(game.actors.values());
    const candidatos = todosAtores.filter((ator) => ator.id !== this.actor.id && ["personagem", "npc"].includes(ator.type));
    if (!candidatos.length) {
      ui.notifications.warn(game.i18n.localize("OP2.Vinculo.SemCandidatos"));
      return;
    }
    const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
    const opcoes = candidatos.map((ator) => `<option value="${escapar(ator.id)}">${escapar(ator.name)}</option>`).join("");
    const vinculo = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Vinculo.Adicionar") },
      content: `<div class="form-group"><label>${game.i18n.localize("OP2.Vinculo.Personagem")}</label><select name="atorUuid">${opcoes}</select></div>
        <div class="form-group"><label>${game.i18n.localize("OP2.Vinculo.Grau")}</label><select name="grau"><option value="0">0</option><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option></select></div>
        <div class="form-group"><label>${game.i18n.localize("OP2.Relacao.Rotulo")}</label><input name="rotulo" type="text" maxlength="80"></div>`,
      ok: { callback: (_evento, botao) => ({ atorUuid: botao.form.elements.atorUuid.value, grau: Number(botao.form.elements.grau.value), rotulo: botao.form.elements.rotulo.value.trim() }) },
      rejectClose: false,
      position: { width: 560 },
      render: renderDoPerfil(this.actor),
    });
    if (!vinculo) return;
    const alvo = game.actors.get(vinculo.atorUuid);
    // `com` vazio mantém o nome sincronizado com o ator relacionado. Se o mestre
    // editar o campo na ficha, o valor passa a ser um apelido personalizado.
    const relacoes = [...this.actor.system.relacoes, { com: "", atorUuid: vinculo.atorUuid, grau: vinculo.grau, rotulo: vinculo.rotulo, invocada: false }];
    return this.actor.update({ "system.relacoes": relacoes });
  }
  static #tirarRelacao(_evento, alvo) {
    return this.actor.update({ "system.relacoes": this.actor.system.relacoes.filter((_r, i) => i !== Number(alvo.dataset.indice)) });
  }
  static #analisar() { return analisarAcao(this.actor); }
  static #invocarRelacao(_evento, alvo) { return invocarRelacao(this.actor, Number(alvo.dataset.indice)); }

  static #alternarCondicao(_evento, alvo) {
    const atuais = new Set(this.actor.system.estado.condicoes);
    if (atuais.has(alvo.dataset.condicao)) atuais.delete(alvo.dataset.condicao);
    else atuais.add(alvo.dataset.condicao);
    // "Agarrado" ligado ou desligado à mão começa limpo: um agarre velho não volta sozinho.
    const agarre = alvo.dataset.condicao === "agarrado" ? { "system.estado.agarre": { por: "", dano: "", passos: 0 } } : {};
    return this.actor.update({ "system.estado.condicoes": [...atuais], ...agarre });
  }

  static async #adicionarCondicao() {
    const opcoes = CONDICOES.map((chave) => `<option value="${chave}">${game.i18n.localize(`OP2.Condicao.${chave}`)}</option>`).join("");
    const chave = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Condicao.Adicionar") },
      content: `<div class="form-group"><label>${game.i18n.localize("OP2.Condicao.Titulo")}</label><select name="condicao">${opcoes}</select></div>`,
      ok: { callback: (_evento, botao) => botao.form.elements.condicao.value },
      rejectClose: false,
    });
    if (!chave) return;
    const atuais = new Set(this.actor.system.estado.condicoes);
    atuais.add(chave);
    const agarre = chave === "agarrado" ? { "system.estado.agarre": { por: "", dano: "", passos: 0 } } : {};
    return this.actor.update({ "system.estado.condicoes": [...atuais], ...agarre });
  }

  static #tirarBonus(_evento, alvo) {
    return this.actor.update({ "system.estado.bonus": this.actor.system.estado.bonus.filter((_b, i) => i !== Number(alvo.dataset.indice)) });
  }

  /** Curar é decisão de mestre: o playtest não diz como (docs/regras/LACUNAS.md). */
  static #curar(_evento, alvo) {
    const { lista, indice } = alvo.dataset;
    const atual = this.actor.system.estado[lista];
    return this.actor.update({
      [`system.estado.${lista}`]: atual.filter((_c, i) => i !== Number(indice)),
      ...dadosDosMaximos(this.actor, lista, atual[Number(indice)], 1),
    });
  }

  #atributos(sistema) {
    return Object.keys(ATRIBUTOS).map((chave) => {
      const atributo = sistema.atributos[chave];
      return {
        chave,
        rotulo: game.i18n.localize(`OP2.Atributo.${chave}`),
        die: ESCADA.includes(atributo.die) || atributo.die === DADO_SOBRE_HUMANO ? atributo.die : "d12",
        dadoEfetivo: atributo.dadoEfetivo,
        reduzido: atributo.reduzido,
        icone: iconeDado(atributo.dadoEfetivo, { titulo: `${game.i18n.localize(`OP2.Atributo.${chave}`)}: ${atributo.dadoEfetivo}` }),
        // O dado base vai para o tooltip; um segundo ícone na linha comeria a largura
        // do nome do atributo, que em inglês já é apertada.
        dica: atributo.reduzido
          ? `${game.i18n.localize("OP2.Atributo.Reduzido")} — ${atributo.die} → ${atributo.dadoEfetivo}`
          : null,
        caminho: `system.atributos.${chave}.die`,
      };
    });
  }

  #modoFicha() {
    return modoAtual();
  }

  #pericias(sistema, modo = this.#modoFicha()) {
    return periciasDoModo(modo)
      .filter((chave) => !PERICIAS[chave].especializada)
      .map((chave) => this.#linhaDePericia(sistema, chave, { modo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }

  /** Uma linha da ficha: nome, dado da perícia, dado do atributo pareado. */
  #linhaDePericia(sistema, chave, { chaveAptidao, modo = this.#modoFicha() } = {}) {
    const pericia = chaveAptidao ? sistema.aptidoes[chaveAptidao] : sistema.pericias[chave];
    const chaveAtributo = sistema.pericias[chave].atributo;
    const atributo = sistema.atributos[chaveAtributo];
    const chaveTeste = chaveAptidao ? `aptidao.${chaveAptidao}` : chave;

    return {
      chave: chaveTeste,
      rotulo: pericia.rotulo || (chaveAptidao
        ? (game.i18n.localize(`OP2.Aptidao.${chaveAptidao}`))
        : game.i18n.localize(chaveDoRotuloDePericia(chave, modo))),
      die: pericia.die,
      dadoEfetivo: pericia.dadoEfetivo ?? pericia.die,
      valor: pericia.valor,
      caminho: chaveAptidao ? `system.aptidoes.${chaveAptidao}.die` : `system.pericias.${chave}.die`,
      icone: iconeDado(pericia.dadoEfetivo ?? pericia.die),
      atributo: {
        chave: chaveAtributo,
        rotulo: game.i18n.localize(`OP2.Atributo.${chaveAtributo}`),
        icone: iconeDado(atributo.dadoEfetivo),
      },
    };
  }

  #aptidoes(sistema, modo = this.#modoFicha()) {
    const chaves = Object.keys(sistema.aptidoes ?? {}).filter((sub) => aptidaoVisivel(sub, modo, sistema.aptidoes[sub].rotulo));
    const chaveAtributo = sistema.pericias.aptidao.atributo;
    return {
      rotulo: game.i18n.localize("OP2.Pericia.aptidao"),
      atributo: {
        chave: chaveAtributo,
        rotulo: game.i18n.localize(`OP2.Atributo.${chaveAtributo}`),
        icone: iconeDado(sistema.atributos[chaveAtributo].dadoEfetivo),
      },
      campos: chaves
        .map((sub) => this.#linhaDePericia(sistema, "aptidao", { chaveAptidao: sub }))
        .map((linha, i) => ({ ...linha, sub: chaves[i], padrao: aptidoesDoModo(modo).includes(chaves[i]) })),
    };
  }

  /** PV/PD como barra proporcional — a ficha oficial usa pips, mas em valores altos
   *  (16, 20+) uma trilha de quadradinhos vira ilegível. A barra escala sem esse
   *  problema, e o número ao lado continua sendo a fonte exata do valor. */
  #recurso(recurso, chave) {
    const max = Math.max(recurso.max, recurso.value, 0);
    // Abaixo de 30% do máximo os traços pulsam em vermelho — o mesmo aviso visual
    // que barra de vida baixa usa em qualquer jogo, só que com o traço do livro.
    const critico = recurso.max > 0 && recurso.value / recurso.max <= 0.3;
    return {
      chave,
      value: recurso.value,
      max: recurso.max,
      critico,
      // Sem teto: os personagens do Ato II chegam a 32-34 de PV/PD, e um limite
      // baixo faria só esse recurso cair pra número puro enquanto o outro mantém
      // os traços — mais inconsistente do que o problema que o teto tentava evitar.
      // O traço quebra em várias linhas sozinho; não fica ilegível, só mais alto.
      tracos: max > 0
        ? Array.from({ length: max }, (_, i) => ({ n: i + 1, cheio: i < recurso.value }))
        : null,
    };
  }

  /* ---------------------------------------------------------------- ações -- */

  static async #rolar(evento, alvo) {
    const chave = alvo.dataset.chave;
    const abrirDialogo = evento.shiftKey !== lerConfig("cliqueAbreDialogo");
    await rolarTeste(this.actor, { chavePericia: chave, rapido: !abrirDialogo });
  }

  /**
   * Gatilho explícito do diálogo completo — sem depender de Shift, que não existe em
   * toque. É o caminho de quem está no celular ou no tablet.
   */
  static async #abrirDialogoTeste(_evento, alvo) {
    await rolarTeste(this.actor, { chavePericia: alvo.dataset.chave, rapido: false });
  }

  /** Roda do mouse e teclas de seta andam na escada sem abrir nada. */
  static async #passoDado(_evento, alvo) {
    const { caminho, delta } = alvo.dataset;
    const atual = foundry.utils.getProperty(this.actor, caminho);
    await this.actor.update({ [caminho]: stepDie(atual, Number(delta)) });
  }

  static async #abrirSeletor(_evento, alvo) {
    const controle = alvo.closest(".op2-controle-dado");
    controle.classList.toggle("aberto");
    // Alguns navegadores (Safari) não focam botão em clique por padrão; forçamos aqui
    // porque a roda do mouse só ajusta o dado quando o controle está focado.
    alvo.focus();
    if (controle.classList.contains("aberto")) {
      const fechar = (e) => {
        if (controle.contains(e.target)) return;
        controle.classList.remove("aberto");
        document.removeEventListener("click", fechar, true);
      };
      document.addEventListener("click", fechar, true);
    }
  }

  static async #escolherDado(_evento, alvo) {
    const { caminho, dado } = alvo.dataset;
    alvo.closest(".op2-controle-dado")?.classList.remove("aberto");
    await this.actor.update({ [caminho]: dado });
  }

  static async #selecionarOcupacao() {
    if (!this.actor.isOwner) return;
    const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
    const opcoesVocacao = VOCACOES.map((v) =>
      `<option value="${escapar(v.chave)}">${escapar(v.nome)} — ${escapar(v.habilidade)}</option>`
    ).join("") + `<option value="__custom">+ Criar vocação personalizada</option>`;
    const grupos = [
      { chave: "fisico", rotulo: "Perícias físicas" },
      { chave: "mente", rotulo: "Perícias mentais" },
      { chave: "emocao", rotulo: "Perícias emocionais" },
    ];
    const opcoesPericia = periciasDoModo(modoAtual())
      .filter((chave) => !PERICIAS[chave].especializada)
      .map((chave) => `<option value="${escapar(chave)}" data-grupo="${PERICIAS[chave].atributo}">${escapar(game.i18n.localize(chaveDoRotuloDePericia(chave, modoAtual())))}</option>`)
      .join("");
    const escolha = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Selecionar Vocação" },
      classes: ["op2", "op2-dialog", "op2-seletor-vocacao"],
      content: `
        <div class="op2-vocacao-seletor">
          <label class="op2-campo">
            <span>Pesquisar vocação</span>
            <input type="search" name="buscaVocacao" placeholder="Digite o nome da vocação ou habilidade…">
          </label>
          <label class="op2-campo">
            <span>Vocação</span>
            <select name="vocacao" size="8">${opcoesVocacao}</select>
          </label>
          <section class="op2-vocacao-seletor__previa" data-vocacao-previa>
            <span class="op2-tag op2-tag--pequena">VOCAÇÃO</span>
            <h3 data-vocacao-nome>Selecione uma vocação</h3>
            <strong data-vocacao-habilidade></strong>
            <p data-vocacao-descricao></p>
            <p><strong>Aprimorado:</strong> <span data-vocacao-aprimorado></span></p>
          </section>
          <section class="op2-vocacao-seletor__personalizada" data-vocacao-custom hidden>
            <h3>Criar vocação personalizada</h3>
            <label class="op2-campo"><span>Nome da vocação</span><input name="nomePersonalizado" type="text" maxlength="80"></label>
            <label class="op2-campo"><span>Habilidade concedida</span><input name="habilidadePersonalizada" type="text" maxlength="80"></label>
            <label class="op2-campo"><span>Descrição / efeito</span><textarea name="descricaoPersonalizada" rows="4"></textarea></label>
            <label class="op2-campo"><span>Texto de aprimoramento (opcional)</span><textarea name="aprimoradoPersonalizado" rows="3"></textarea></label>
            <label class="op2-campo"><span>Custo em PD (0 se não houver)</span><input name="custoPersonalizado" type="number" min="0" max="99" value="0"></label>
          </section>
          <label class="op2-campo" data-vocacao-pericia-wrap hidden>
            <span data-vocacao-pericia-rotulo>Escolha a perícia</span>
            <select name="pericia">${opcoesPericia}</select>
          </label>
          <label class="op2-campo op2-campo--inline">
            <input type="checkbox" name="aprimorada">
            <span>Aplicar a habilidade na versão aprimorada</span>
          </label>
          <p class="op2-ajuda">A vocação será registrada na ficha e a habilidade correspondente será adicionada automaticamente.</p>
        </div>`,
      position: { width: 620, height: 740 },
      rejectClose: false,
      render: (_evento, dialogo) => {
        renderDoPerfil(this.actor)(_evento, dialogo);
        const raiz = dialogo?.element;
        if (!raiz) return;
        const busca = raiz.querySelector("[name=buscaVocacao]");
        const select = raiz.querySelector("[name=vocacao]");
        const periciaWrap = raiz.querySelector("[data-vocacao-pericia-wrap]");
        const pericia = raiz.querySelector("[name=pericia]");
        const customWrap = raiz.querySelector("[data-vocacao-custom]");
        const previa = raiz.querySelector("[data-vocacao-previa]");
        const update = () => {
          if (select.value === "__custom") {
            customWrap.hidden = false;
            previa.hidden = true;
            periciaWrap.hidden = true;
            return;
          }
          customWrap.hidden = true;
          previa.hidden = false;
          const vocacao = VOCACOES.find((v) => v.chave === select.value);
          if (!vocacao) return;
          raiz.querySelector("[data-vocacao-nome]").textContent = vocacao.nome;
          raiz.querySelector("[data-vocacao-habilidade]").textContent = vocacao.habilidade;
          raiz.querySelector("[data-vocacao-descricao]").textContent = vocacao.descricao;
          raiz.querySelector("[data-vocacao-aprimorado]").textContent = vocacao.aprimorado;
          periciaWrap.hidden = !vocacao.grupoPericia;
          if (vocacao.grupoPericia) {
            raiz.querySelector("[data-vocacao-pericia-rotulo]").textContent =
              grupos.find((g) => g.chave === vocacao.grupoPericia)?.rotulo ?? "Escolha a perícia";
            const opcoes = [...pericia.options].filter((o) => o.dataset.grupo === vocacao.grupoPericia);
            for (const opcao of pericia.options) opcao.hidden = opcao.dataset.grupo !== vocacao.grupoPericia;
            if (!opcoes.some((o) => o.value === pericia.value)) pericia.value = opcoes[0]?.value ?? "";
          }
        };
        busca?.addEventListener("input", () => {
          const termo = busca.value.trim().toLocaleLowerCase();
          for (const opcao of select.options) {
            if (opcao.value === "__custom") {
              opcao.hidden = Boolean(termo) && !"criar vocação personalizada".includes(termo);
              continue;
            }
            const vocacao = VOCACOES.find((v) => v.chave === opcao.value);
            opcao.hidden = Boolean(termo) && !`${vocacao.nome} ${vocacao.habilidade} ${vocacao.descricao}`.toLocaleLowerCase().includes(termo);
          }
          const atual = select.selectedOptions[0];
          if (!atual || atual.hidden) {
            const primeira = [...select.options].find((o) => !o.hidden);
            if (primeira) select.value = primeira.value;
          }
          update();
        });
        select?.addEventListener("change", update);
        update();
      },
      ok: {
        label: "Aplicar vocação",
        icon: "fa-solid fa-check",
        callback: (_evento, botao) => ({
          chave: botao.form.elements.vocacao.value,
          pericia: botao.form.elements.pericia.value,
          aprimorada: botao.form.elements.aprimorada.checked,
          nomePersonalizado: botao.form.elements.nomePersonalizado?.value?.trim() ?? "",
          habilidadePersonalizada: botao.form.elements.habilidadePersonalizada?.value?.trim() ?? "",
          descricaoPersonalizada: botao.form.elements.descricaoPersonalizada?.value?.trim() ?? "",
          aprimoradoPersonalizado: botao.form.elements.aprimoradoPersonalizado?.value?.trim() ?? "",
          custoPersonalizado: Number(botao.form.elements.custoPersonalizado?.value ?? 0),
        }),
      },
    });
    if (!escolha?.chave) return;
    let vocacao = VOCACOES.find((v) => v.chave === escolha.chave);
    if (escolha.chave === "__custom") {
      if (!escolha.nomePersonalizado || !escolha.habilidadePersonalizada) {
        ui.notifications.warn("Informe o nome da vocação e a habilidade que ela concede.");
        return;
      }
      vocacao = {
        chave: `hb-${escolha.nomePersonalizado.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        nome: escolha.nomePersonalizado,
        habilidade: escolha.habilidadePersonalizada,
        grupo: "hb",
        custo: Math.max(0, escolha.custoPersonalizado || 0),
        custoAprimorado: Math.max(0, escolha.custoPersonalizado || 0),
        descricao: escolha.descricaoPersonalizada || "Habilidade personalizada criada pela mesa.",
        aprimorado: escolha.aprimoradoPersonalizado || "Sem aprimoramento adicional definido.",
      };
    }
    if (!vocacao) return;

    const periciaEscolhida = vocacao.grupoPericia ? escolha.pericia : "";
    if (vocacao.grupoPericia && (!periciaEscolhida || PERICIAS[periciaEscolhida]?.atributo !== vocacao.grupoPericia)) {
      ui.notifications.warn("Selecione uma perícia válida para essa vocação.");
      return;
    }

    // Remove apenas a habilidade concedida automaticamente pela vocação anterior.
    const concedidas = this.actor.items.filter((i) => i.flags?.[SYSTEM_ID]?.vocacaoConcedida);
    for (const item of concedidas) {
      if (item.flags[SYSTEM_ID].vocacaoConcedida !== vocacao.chave) await item.delete();
    }

    const aprimorada = Boolean(escolha.aprimorada);
    const custoPD = aprimorada ? (vocacao.custoAprimorado ?? vocacao.custo ?? 0) : (vocacao.custo ?? 0);
    const efeito = (aprimorada ? vocacao.efeitoAprimorado : vocacao.efeito) ?? { tipo: "nenhum", dado: "d6", chaves: [] };
    const tags = [
      ...(vocacao.grupo === "hb" ? ["HB"] : ["Idolo", "Oficial"]),
      "Vocação",
      custoPD > 0 ? "Com custo" : "Sem custo",
    ];
    let descricao = `<p>${escapar(vocacao.descricao)}</p><p><strong>Aprimorado:</strong> ${escapar(vocacao.aprimorado)}</p>`;
    if (periciaEscolhida) {
      const rotulo = game.i18n.localize(chaveDoRotuloDePericia(periciaEscolhida, modoAtual()));
      const textoBase = vocacao.descricao.replace("Escolha uma perícia física.", `A perícia ${rotulo} foi escolhida.`)
        .replace("Escolha uma perícia mental.", `A perícia ${rotulo} foi escolhida.`)
        .replace("Escolha uma perícia emocional.", `A perícia ${rotulo} foi escolhida.`);
      descricao = `<p>${escapar(textoBase)}</p><p><strong>Aprimorado:</strong> ${escapar(vocacao.aprimorado)}</p>`;
    }
    const dadosHabilidade = {
      name: vocacao.habilidade,
      type: "habilidade",
      img: "systems/op2-comunidade-fork/assets/icons/tipos/habilidade.svg",
      system: {
        origem: "ocupacao",
        perfil: "",
        custo: custoPD ? `${custoPD} PD` : "",
        custoPD,
        tags: tags.join(", "),
        descricao,
        mecanica: "",
        efeito: {
          tipo: efeito.tipo ?? "nenhum",
          passos: efeito.passos ?? 1,
          dado: efeito.dado ?? "d6",
          chaves: efeito.chaves ?? [],
          permitirD20: false,
          pdAoDescobrir: 0,
        },
        impeto: { espacos: 0, preenchidos: 0 },
        usoEmInvestigacao: "",
      },
      flags: { [SYSTEM_ID]: { vocacaoConcedida: vocacao.chave, aprimorada } },
    };

    const updates = { "system.ocupacao": vocacao.nome };
    if (periciaEscolhida) {
      const dadoAtual = this.actor.system.pericias[periciaEscolhida].die;
      const alvo = aprimorada ? "d8" : "d6";
      if (ESCADA.indexOf(dadoAtual) < ESCADA.indexOf(alvo)) updates[`system.pericias.${periciaEscolhida}.die`] = alvo;
    }
    await this.actor.update(updates);

    const habilidadeExistente = this.actor.items.find((i) =>
      i.type === "habilidade" && i.name.toLocaleLowerCase() === vocacao.habilidade.toLocaleLowerCase()
    );
    if (habilidadeExistente) {
      // Aproveita a habilidade que já estava na ficha e sincroniza os dados da vocação,
      // evitando duplicatas e garantindo que custo, descrição, tags e aprimoramento sejam aplicados.
      await habilidadeExistente.update({
        system: dadosHabilidade.system,
        flags: dadosHabilidade.flags,
        img: dadosHabilidade.img,
      });
    } else {
      await this.actor.createEmbeddedDocuments("Item", [dadosHabilidade]);
    }
    ui.notifications.info(`${vocacao.nome} aplicada à ficha. Habilidade: ${vocacao.habilidade}.`);
    this.render({ force: true });
  }

  static async #criarItem(_evento, alvo) {
    const type = alvo.dataset.tipo;
    const packs = [...game.packs].filter((pack) => pack.documentName === "Item" || pack.metadata?.type === "Item");
    const entradas = [];
    for (const pack of packs) {
      try {
        const indice = await pack.getIndex({ fields: ["type", "system.tags", "system.descricao", "system.origem", "system.perfil", "system.custo", "system.custoPD"] });
        for (const entrada of indice) {
          if ((entrada.type ?? entrada.documentName) !== type) continue;
          // Index fields aninhados não são expostos como `entrada.system` em todas as
          // versões do Foundry. Ler o documento garante tags/custo/descrição reais.
          const documento = await pack.getDocument(entrada._id);
          if (!documento || documento.type !== type) continue;
          const sistema = documento.system ?? {};
          const tags = type === "habilidade"
            ? tagsHabilidade(sistema, pack.collection, pack.metadata?.packageName, pack.metadata?.label)
            : [];
          entradas.push({
            uuid: documento.uuid || entrada.uuid || `Compendium.${pack.collection}.${entrada._id}`,
            nome: documento.name || entrada.name,
            pacote: pack.metadata?.label || pack.collection,
            tags,
            descricaoBusca: String(sistema.descricao ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "),
          });
        }
      } catch (erro) {
        console.warn(`OP2 | Não foi possível ler o compêndio ${pack.collection}`, erro);
      }
    }
    entradas.sort((a, b) => a.nome.localeCompare(b.nome, game.i18n.lang));
    const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
    let origem = "novo";
    if (entradas.length) {
      origem = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.format("OP2.Item.Novo", { tipo: game.i18n.localize(`TYPES.Item.${type}`) }) },
        content: `<div class="form-group"><label>${game.i18n.localize("OP2.Item.Origem")}</label><select name="origem"><option value="compendio">${game.i18n.localize("OP2.Item.DoCompendio")}</option><option value="novo">${game.i18n.localize("OP2.Item.DoZero")}</option></select></div>`,
        ok: { callback: (_evento, botao) => botao.form.elements.origem.value },
        rejectClose: false,
        position: { width: 520 },
        render: renderDoPerfil(this.actor),
      });
      if (!origem) return;
    }
    let dados;
    if (origem === "compendio") {
      const uuid = type === "habilidade"
        ? await this.#navegarHabilidades(entradas)
        : await this.#selecionarItemSimples(entradas);

      if (!uuid) return;
      const documento = await fromUuid(uuid);
      if (!documento) {
        ui.notifications.error(game.i18n.localize("OP2.Item.CompendioIndisponivel"));
        return;
      }
      dados = documento.toObject();
      if (type === "habilidade") {
        const entradaSelecionada = entradas.find((entrada) => entrada.uuid === uuid);
        if (entradaSelecionada?.tags?.length) dados.system.tags = entradaSelecionada.tags.join(", ");
      }
      delete dados._id;
      delete dados.folder;
      delete dados.ownership;
    } else {
      const nome = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.format("OP2.Item.Novo", { tipo: game.i18n.localize(`TYPES.Item.${type}`) }) },
        content: `<div class="form-group"><label>${game.i18n.localize("OP2.Item.Nome")}</label><input name="nome" type="text" value="${escapar(game.i18n.format("OP2.Item.Novo", { tipo: game.i18n.localize(`TYPES.Item.${type}`) }))}" required></div>`,
        ok: { callback: (_evento, botao) => botao.form.elements.nome.value.trim() },
        rejectClose: false,
        position: { width: 520 },
        render: renderDoPerfil(this.actor),
      });
      if (!nome) return;
      dados = { name: nome, type };
    }
    const [criado] = await this.actor.createEmbeddedDocuments("Item", [dados]);
    criado?.sheet?.render({ force: true });
  }

  static async #editarNomePericia(_evento, alvo) {
    const chave = alvo.dataset.chave;
    if (!chave) return;
    const caminho = chave.startsWith("aptidao.")
      ? `system.aptidoes.${chave.slice("aptidao.".length)}.rotulo`
      : `system.pericias.${chave}.rotulo`;
    const atual = foundry.utils.getProperty(this.actor, caminho) ?? "";
    const rotulo = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Pericia.EditarNome") },
      content: `<div class="form-group"><label>${game.i18n.localize("OP2.Pericia.NomePersonalizado")}</label><input name="rotulo" type="text" maxlength="60" value="${String(atual).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])}"></div>`,
      ok: { callback: (_e, botao) => botao.form.elements.rotulo.value.trim() },
      rejectClose: false,
      position: { width: 520 },
      render: renderDoPerfil(this.actor),
    });
    if (rotulo === null || rotulo === undefined) return;
    return this.actor.update({ [caminho]: rotulo });
  }

  /** Navegador conjunto para os compêndios Moderno e Vigília, com busca, tags e prévia. */
  async #navegarHabilidades(entradas) {
    const habilidades = entradas.map((entrada) => {
      const vigilia = /vig[ií]lia/i.test(entrada.pacote) || /habilidades-vigilia/i.test(entrada.uuid);
      const tags = (Array.isArray(entrada.tags) ? entrada.tags : String(entrada.tags ?? "").split(",")).map((tag) => tag.trim()).filter(Boolean);
      return {
        ...entrada,
        modo: vigilia ? "vigilia" : "moderno",
        modoRotulo: vigilia ? "Modo Vigília" : "Modo Moderno",
        tags,
        tagsValor: tags.join("|"),
        tagsBusca: tags.join("|").toLocaleLowerCase(),
        busca: `${entrada.nome} ${entrada.pacote} ${tags.join(" ")} ${entrada.descricaoBusca ?? ""}`.toLocaleLowerCase(),
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome, game.i18n.lang));
    const tagsUnicas = [...new Set([
      ...TAGS_HABILIDADE,
      ...habilidades.flatMap((habilidade) => habilidade.tags),
    ])].sort((a, b) => a.localeCompare(b, game.i18n.lang));
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/dialog/compendio-habilidades.hbs`,
      { habilidades, tags: tagsUnicas },
    );
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Navegador de Habilidades" },
      classes: ["op2", "op2-dialog", "op2-compendio-habilidades"],
      content,
      position: { width: 940, height: 650 },
      render: (_evento, dialogo) => {
        renderDoPerfil(this.actor)(_evento, dialogo);
        const raiz = dialogo?.element;
        if (!raiz) return;
        const busca = raiz.querySelector("[name=busca]");
        const filtrosTag = [...raiz.querySelectorAll("[data-filtro-tag]")];
        const botoesModo = [...raiz.querySelectorAll("[data-filtro-modo]")];
        const linhas = [...raiz.querySelectorAll("[data-habilidade-uuid]")];
        const uuidInput = raiz.querySelector("[name=uuid]");
        const previewNome = raiz.querySelector("[data-preview-nome]");
        const previewMeta = raiz.querySelector("[data-preview-meta]");
        const previewDescricao = raiz.querySelector("[data-preview-descricao]");
        const botaoAdicionar = raiz.querySelector("[data-adicionar-habilidade]");
        let modo = "todas";
        let sequencia = 0;
        const filtrar = () => {
          const termo = busca.value.trim().toLocaleLowerCase();
          const tagsSelecionadas = filtrosTag.filter((opcao) => opcao.checked).map((opcao) => opcao.value.toLocaleLowerCase());
          let visiveis = 0;
          for (const linha of linhas) {
            const corresponde = (!termo || linha.dataset.busca.includes(termo))
              && (modo === "todas" || linha.dataset.modo === modo)
              && tagsSelecionadas.every((tag) => linha.dataset.tagsBusca.split("|").includes(tag));
            linha.hidden = !corresponde;
            if (corresponde) visiveis++;
          }
          // Se a seleção sair dos resultados filtrados, limpa UUID e bloqueia Adicionar.
          if (uuidInput.value && !linhas.some((linha) => !linha.hidden && linha.dataset.habilidadeUuid === uuidInput.value)) {
            uuidInput.value = "";
            uuidInput.dataset.tags = "";
            if (botaoAdicionar) botaoAdicionar.disabled = true;
            for (const linha of linhas) linha.classList.remove("selecionada");
            previewNome.textContent = "Selecione uma habilidade";
            previewMeta.textContent = "Moderno e Vigília reunidos em um único navegador";
            previewDescricao.textContent = "Escolha uma entrada da lista para ler sua descrição antes de adicioná-la à ficha.";
          }
          const contador = raiz.querySelector("[data-resultado-contagem]");
          if (contador) contador.textContent = `${visiveis} habilidades`;
        };
        busca.addEventListener("input", filtrar);
        for (const filtro of filtrosTag) filtro.addEventListener("change", filtrar);
        for (const botao of botoesModo) botao.addEventListener("click", () => {
          modo = botao.dataset.filtroModo;
          for (const outro of botoesModo) outro.classList.toggle("ativo", outro === botao);
          filtrar();
        });
        raiz.querySelector("[data-limpar-filtros]")?.addEventListener("click", () => {
          busca.value = "";
          for (const opcao of filtrosTag) opcao.checked = false;
          uuidInput.value = "";
          uuidInput.dataset.tags = "";
          if (botaoAdicionar) botaoAdicionar.disabled = true;
          for (const linha of linhas) linha.classList.remove("selecionada");
          previewNome.textContent = "Selecione uma habilidade";
          previewMeta.textContent = "Moderno e Vigília reunidos em um único navegador";
          previewDescricao.textContent = "Escolha uma entrada da lista para ler sua descrição antes de adicioná-la à ficha.";
          modo = "todas";
          for (const botao of botoesModo) botao.classList.toggle("ativo", botao.dataset.filtroModo === "todas");
          filtrar();
        });
        botaoAdicionar?.addEventListener("click", async () => {
          const uuid = uuidInput.value;
          if (!uuid) {
            ui.notifications.warn("Selecione uma habilidade antes de adicionar à ficha.");
            return;
          }
          botaoAdicionar.disabled = true;
          try {
            const documento = await fromUuid(uuid);
            if (!documento) throw new Error(`Documento indisponível: ${uuid}`);
            const dados = documento.toObject();
            delete dados._id;
            delete dados.folder;
            delete dados.ownership;
            // Persiste as tags inferidas, mesmo quando o item legado não tinha tags.
            dados.system.tags = (uuidInput.dataset.tags ?? "").split("|").filter(Boolean).join(", ");
            const [criado] = await this.actor.createEmbeddedDocuments("Item", [dados]);
            ui.notifications.info(`${criado?.name ?? documento.name} adicionado à ficha.`);
            this.render({ force: true });
            criado?.sheet?.render({ force: true });
            dialogo.close();
          } catch (erro) {
            console.error("OP2 | Falha ao adicionar habilidade do compêndio", erro);
            ui.notifications.error("Não foi possível adicionar esta habilidade. Confira o console do Foundry.");
            botaoAdicionar.disabled = false;
          }
        });
        for (const linha of linhas) linha.addEventListener("click", async () => {
          const atual = ++sequencia;
          uuidInput.value = linha.dataset.habilidadeUuid;
          uuidInput.dataset.tags = linha.dataset.tags || "";
          if (botaoAdicionar) botaoAdicionar.disabled = false;
          for (const outra of linhas) outra.classList.toggle("selecionada", outra === linha);
          previewNome.textContent = linha.dataset.nome;
          previewMeta.textContent = linha.dataset.meta;
          previewDescricao.textContent = "Carregando descrição…";
          try {
            const documento = await fromUuid(uuidInput.value);
            if (!documento || atual !== sequencia) return;
            const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
            const descricao = await editor.enrichHTML(documento.system.descricao ?? "", { relativeTo: documento, secrets: false });
            const uso = documento.system.usoEmInvestigacao ?? "";
            const usoHtml = uso ? `<hr><strong>Uso em investigação</strong>${await editor.enrichHTML(uso, { relativeTo: documento, secrets: false })}` : "";
            previewDescricao.innerHTML = `${descricao || "<em>Esta habilidade não possui descrição.</em>"}${usoHtml}`;
          } catch (erro) {
            console.error("OP2 | Falha ao pré-visualizar habilidade", erro);
            previewDescricao.textContent = "Não foi possível carregar a prévia desta habilidade.";
          }
        });
        filtrar();
      },
      ok: {
        label: "Adicionar à ficha",
        icon: "fa-solid fa-plus",
        callback: (_evento, botao) => botao.form.elements.uuid.value || null,
      },
      rejectClose: false,
    });
  }

  /** Seletor compacto usado pelos demais tipos de item. */
  async #selecionarItemSimples(entradas) {
    const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;", "'": "&#39;" })[c]);
    const opcoes = entradas.map((item) => `<option value="${escapar(item.uuid)}">${escapar(item.nome)} — ${escapar(item.pacote)}</option>`).join("");
    return foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Item.SelecionarDoCompendio") },
      content: `<div class="form-group"><label>${game.i18n.localize("OP2.Item.BuscarNoCompendio")}</label><select name="uuid" size="10" style="width:100%">${opcoes}</select></div>`,
      ok: { callback: (_evento, botao) => botao.form.elements.uuid.value },
      rejectClose: false,
      position: { width: 520 },
      render: renderDoPerfil(this.actor),
    });
  }

  /** Usa uma habilidade da aba Ações e desconta os recursos declarados. */
  static async #usarAcao(_evento, alvo) {
    const item = this.actor.items.get(alvo.dataset.itemId);
    if (!item) return;

    const { custoPD, custoPV } = custosDaAcao(item);
    const pdAtual = Number(this.actor.system.recursos.pd.value ?? 0);
    const pvAtual = Number(this.actor.system.recursos.pv.value ?? 0);

    if (pdAtual < custoPD) {
      ui.notifications.warn(`PD insuficientes para usar ${item.name}. Necessário: ${custoPD}; disponível: ${pdAtual}.`);
      return;
    }
    if (pvAtual < custoPV) {
      ui.notifications.warn(`PV insuficientes para usar ${item.name}. Necessário: ${custoPV}; disponível: ${pvAtual}.`);
      return;
    }

    const atualizacoes = {};
    if (custoPD > 0) atualizacoes["system.recursos.pd.value"] = pdAtual - custoPD;
    if (custoPV > 0) atualizacoes["system.recursos.pv.value"] = pvAtual - custoPV;

    if (Object.keys(atualizacoes).length) {
      await this.actor.update(atualizacoes);
      const gastos = [custoPD ? `${custoPD} PD` : "", custoPV ? `${custoPV} PV` : ""].filter(Boolean).join(" e ");
      ui.notifications.info(`${item.name}: ${gastos} gastos.`);
    } else {
      ui.notifications.info(`${item.name}: nenhum custo numérico de PD/PV foi identificado; aplique o efeito descrito na habilidade.`);
    }
  }

  static async #editarItem(_evento, alvo) {
    this.#itemDe(alvo)?.sheet.render({ force: true });
  }

  static async #apagarItem(_evento, alvo) {
    const item = this.#itemDe(alvo);
    if (!item) return;
    const confirmado = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OP2.Item.Apagar") },
      content: `<p>${game.i18n.format("OP2.Item.ApagarConfirma", { nome: item.name })}</p>`,
      render: renderDoPerfil(this.actor),
    });
    if (confirmado) await item.delete();
  }

  static async #alternarEquipado(_evento, alvo) {
    const item = this.#itemDe(alvo);
    if (item) await item.update({ "system.equipado": !item.system.equipado });
  }

  static async #ajustarCarga(_evento, alvo) {
    const item = this.#itemDe(alvo);
    if (!item) return;
    const { value, max } = item.system.cargas;
    const novo = Math.min(max, Math.max(0, value + Number(alvo.dataset.delta)));
    await item.update({ "system.cargas.value": novo });
  }

  #itemDe(alvo) {
    return this.actor.items.get(alvo.closest("[data-item-id]")?.dataset.itemId);
  }

  /** Aptidão é coleção aberta: o texto fala em "um campo específico" (spec §2.3). */
  static async #adicionarAptidao() {
    const rotulo = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Aptidao.Adicionar") },
      content: `<input type="text" name="rotulo" autofocus placeholder="${game.i18n.localize("OP2.Aptidao.Exemplo")}">`,
      ok: { callback: (_e, botao) => botao.form.elements.rotulo.value.trim() },
      render: renderDoPerfil(this.actor),
    });
    if (!rotulo) return;

    const chave = rotulo.slugify({ strict: true });
    const existente = this.actor.system.aptidoes[chave];
    // Campo de fábrica de outro modo, oculto na ficha: dar nome a ele é o que o traz de
    // volta. Avisar "duplicada" sobre o que não se vê não diria nada.
    if (existente && !aptidaoVisivel(chave, modoAtual(), existente.rotulo)) {
      return void await this.actor.update({ [`system.aptidoes.${chave}.rotulo`]: rotulo });
    }
    if (existente) {
      return void ui.notifications.warn(game.i18n.format("OP2.Aviso.AptidaoDuplicada", { rotulo }));
    }
    await this.actor.update({ [`system.aptidoes.${chave}`]: { rotulo, die: "d4" } });
  }

  /** Clicar no traço N define o recurso em N; clicar no atual zera de N para N-1. */
  /**
   * Ocupação arrastada para a ficha: preenche o campo de texto e traz a habilidade
   * que ela concede (spec §2.1), em vez de virar um Item solto no inventário — o
   * personagem não "carrega" a própria profissão.
   */
  async _onDropItem(evento, item) {
    if (item.type !== "ocupacao") return super._onDropItem(evento, item);
    if (!this.actor.isOwner) return null;

    await this.actor.update({ "system.ocupacao": item.name });
    ui.notifications.info(game.i18n.format("OP2.Ocupacao.Aplicada", {
      ator: this.actor.name, ocupacao: item.name,
    }));

    const nome = item.system.habilidade?.trim();
    if (!nome) return null;
    if (this.actor.items.getName(nome)) {
      ui.notifications.info(game.i18n.format("OP2.Ocupacao.JaTinha", {
        ator: this.actor.name, habilidade: nome,
      }));
      return null;
    }

    // A habilidade vem do compêndio quando a ocupação diz de onde; senão fica só o
    // nome, e a mesa preenche o efeito à mão.
    const modelo = item.system.habilidadeUuid ? await fromUuid(item.system.habilidadeUuid) : null;
    const dados = modelo?.toObject() ?? { name: nome, type: "habilidade", system: { origem: "ocupacao" } };
    await this.actor.createEmbeddedDocuments("Item", [dados]);
    ui.notifications.info(game.i18n.format("OP2.Ocupacao.HabilidadeAdicionada", { habilidade: nome }));
    return null;
  }

  /**
   * Barra de Ímpeto: clicar num espaço preenche até ali; clicar no último preenchido
   * apaga. Mesma interação dos traços de PV/PD, que a mesa já conhece. O estado é do
   * item — apagar a habilidade leva a barra junto.
   */
  static async #definirImpeto(_evento, alvo) {
    const item = this.actor.items.get(alvo.dataset.itemId);
    if (!item) return;
    const atual = item.system.impeto.preenchidos;
    const valor = Number(alvo.dataset.valor);
    const novo = valor === atual ? valor - 1 : valor;
    await item.update({ "system.impeto.preenchidos": Math.max(0, novo) });
  }

  /**
   * Apagar a barra cheia sobe um atributo em um passo até o fim da cena. O aumento vai
   * para `estado.aumentosTemporarios`, que o dado efetivo soma e o encerramento de
   * cena zera.
   */
  static async #gastarImpetoAtributo(_evento, alvo) {
    const item = this.actor.items.get(alvo.dataset.itemId);
    if (!item?.system.impetoCheio) return;

    const opcoes = Object.keys(ATRIBUTOS)
      .map((chave) => `<option value="${chave}">${game.i18n.localize(`OP2.Atributo.${chave}`)}</option>`)
      .join("");
    const escolhido = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Impeto.Passo") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OP2.Impeto.QualAtributo")}</label>
          <select name="atributo">${opcoes}</select>
        </div>`,
      ok: { callback: (_evento, botao) => botao.form.elements.atributo.value },
      rejectClose: false,
      render: renderDoPerfil(this.actor),
    });
    if (!escolhido) return;

    const atual = this.actor.system.estado.aumentosTemporarios[escolhido] ?? 0;
    await item.update({ "system.impeto.preenchidos": 0 });
    await this.actor.update({ [`system.estado.aumentosTemporarios.${escolhido}`]: atual + 1 });
    ui.notifications.info(game.i18n.format("OP2.Impeto.PassoAplicado", {
      atributo: game.i18n.localize(`OP2.Atributo.${escolhido}`),
    }));
  }

  static async #definirRecurso(_evento, alvo) {
    const { recurso, valor } = alvo.dataset;
    const atual = this.actor.system.recursos[recurso].value;
    const novo = Number(valor) === atual ? Number(valor) - 1 : Number(valor);
    await this.actor.update({ [`system.recursos.${recurso}.value`]: Math.max(0, novo) });
  }

  static async #removerAptidao(_evento, alvo) {
    await this.actor.update({ [`system.aptidoes.-=${alvo.dataset.sub}`]: null });
  }

  static async #encerrarCena() {
    await encerrarCena({ atores: [this.actor] });
  }

  /** Filtro da coluna de perícias. Sobrevive ao re-render que o form dispara. */
  #busca = "";

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    // O acento da ficha vem do perfil (as cores do livro): o CSS lê daqui.
    this.element.dataset.perfil = this.actor.system.perfil ?? "";
    this.element.dataset.modoFicha = modoAtual();
    this.element.dataset.afinidade = this.actor.system.afinidade || "nenhuma";

    const campo = this.element.querySelector(".op2-busca__campo");
    if (campo) {
      campo.value = this.#busca;
      campo.addEventListener("input", (evento) => {
        this.#busca = evento.target.value;
        this.#filtrarPericias();
      });
      if (this.#busca) this.#filtrarPericias();
    }

    if (!this.isEditable) return;

    ligarRodaDoMouse(this.element, (caminho, passos) => {
      const atual = foundry.utils.getProperty(this.actor, caminho);
      const permitirD20 = caminho.startsWith("system.atributos.");
      this.actor.update({ [caminho]: stepDie(atual, passos, { permitirD20 }) });
    });
  }

  /**
   * Esconde as linhas que não casam com a busca. A Aptidão abre sozinha quando um
   * subcampo casa — senão o resultado ficaria escondido dentro do `<details>` fechado.
   */
  #filtrarPericias() {
    const termo = this.#busca.trim().toLowerCase();
    const semAcento = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const alvo = semAcento(termo);

    for (const linha of this.element.querySelectorAll(".op2-pericia")) {
      const nome = semAcento(linha.querySelector(".op2-pericia__nome")?.textContent ?? "").toLowerCase();
      linha.hidden = Boolean(alvo) && !nome.includes(alvo);
    }

    const aptidao = this.element.querySelector(".op2-aptidao");
    if (!aptidao) return;
    const algumVisivel = [...aptidao.querySelectorAll(".op2-pericia")].some((l) => !l.hidden);
    aptidao.hidden = Boolean(alvo) && !algumVisivel;
    if (alvo && algumVisivel) aptidao.open = true;
  }
}


