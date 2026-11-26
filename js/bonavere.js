
"use strict";

// ==========================================
// GESTOR BCA - MODULO BONAVERE
// ==========================================

const SUPABASE_URL =
  "https://pdvipfzbtpsuenpumktb.supabase.co";

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

let clienteSupabase = null;
let usuarioAtual = null;
let podeEditar = false;
let acessoAutorizado = false;

let responsaveis = [];
let tiposAtividade = [];

const pesquisaPrazos = document.getElementById(
  "pesquisarPrazosBonavere"
);

let processosEmMemoria = [];


const tabelaAbertos =
  document.getElementById("processosAbertos");

const tabelaFechados =
  document.getElementById("processosFechados");

const totalAbertos =
  document.getElementById("totalAbertos");

const totalFechados =
  document.getElementById("totalFechados");

const botaoNovo =
  document.getElementById("novoPrazo");

const modal =
  document.getElementById("modalNovoPrazo");

const formulario =
  document.getElementById("formNovoPrazo");

const botaoCancelar =
  document.getElementById("cancelarPrazo");

const botaoSalvar =
  document.getElementById("salvarPrazo");

const situacoes = {
  aberta: "Aberta",
  em_processo: "Em processo",
  concluida: "Concluída",
  nada_a_fazer: "Nada a fazer"
};

// ==========================================
// CONTROLE DOS PROCESSOS ENCERRADOS
// ==========================================

function encerrado(processo) {
  return (
    processo.status === "concluida" ||
    processo.status === "nada_a_fazer"
  );
}

function podeEditarCampos(processo) {
  return (
    acessoAutorizado &&
    podeEditar &&
    !encerrado(processo)
  );
}

// ==========================================
// CONTROLE DE SESSAO
// ==========================================

async function conferirSessaoBonavere() {
  if (
    !clienteSupabase ||
    !window.GestorBCASessao
  ) {
    return false;
  }

  const ultimaAtividade =
    window.GestorBCASessao.obterUltimaAtividade();

  const agora = Date.now();

  if (
    ultimaAtividade === null ||
    ultimaAtividade > agora ||
    agora - ultimaAtividade >=
      window.GestorBCASessao.TEMPO_INATIVIDADE
  ) {
    acessoAutorizado = false;
    podeEditar = false;
    usuarioAtual = null;
    botaoNovo.disabled = true;

    await window.GestorBCASessao
      .encerrarPorInatividade(clienteSupabase);

    return false;
  }

  return true;
}

async function exigirSessaoParaEdicao() {
  const valida = await conferirSessaoBonavere();

  if (
    !valida ||
    !usuarioAtual ||
    !acessoAutorizado ||
    !podeEditar
  ) {
    throw new Error(
      "Sessão expirada ou usuário sem permissão."
    );
  }
}

// ==========================================
// MENSAGENS E CELULAS
// ==========================================

function mensagemTabela(tabela, mensagem) {
  tabela.replaceChildren();

  const linha = document.createElement("tr");
  const celula = document.createElement("td");

  celula.colSpan = 10;
  celula.className = "vazio";
  celula.textContent = mensagem;

  linha.appendChild(celula);
  tabela.appendChild(linha);
}

function adicionarCelula(linha, valor) {
  const celula = document.createElement("td");

  celula.textContent = valor ?? "—";
  linha.appendChild(celula);

  return celula;
}

// ==========================================
// FORMATACAO DAS DATAS
// ==========================================

function formatarData(data) {
  if (!data) return "—";

  const partes = data.split("-");

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : data;
}

function dataEmDias(data) {
  if (!data) return null;

  const [ano, mes, dia] =
    data.split("-").map(Number);

  return Math.floor(
    Date.UTC(ano, mes - 1, dia) / 86400000
  );
}

function diasAteVencimento(data) {
  if (!data) return null;

  const hoje = new Date();

  const hojeEmDias = Math.floor(
    Date.UTC(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    ) / 86400000
  );

  return dataEmDias(data) - hojeEmDias;
}

// ==========================================
// ALERTA DE VENCIMENTO - 7 DIAS
// ==========================================

function aplicarCorVencimento(celula, processo) {
  if (
    !processo.vencimento ||
    encerrado(processo)
  ) {
    return;
  }

  const dias =
    diasAteVencimento(processo.vencimento);

  if (dias === null || dias > 7) return;

  const intensidade =
    dias <= 0 ? 1 : (7 - dias) / 7;

  const inicio = [255, 242, 239];
  const fim = [220, 53, 53];

  const cor = inicio.map((valor, indice) =>
    Math.round(
      valor +
      (fim[indice] - valor) * intensidade
    )
  );

  celula.style.backgroundColor =
    `rgb(${cor.join(",")})`;

  celula.style.color =
    intensidade >= 0.65
      ? "#ffffff"
      : "#752a2a";

  celula.style.fontWeight = "bold";

  if (dias < 0) {
    celula.title = "Prazo vencido";
  } else if (dias === 0) {
    celula.title = "Vence hoje";
  } else {
    celula.title =
      `Faltam ${dias} dias corridos`;
  }
}

// ==========================================
// SALVAR ALTERACOES DE CAMPOS
// ==========================================

async function atualizarCampo(
  processo,
  campo,
  valor
) {
  await exigirSessaoParaEdicao();

  if (!podeEditarCampos(processo)) {
    throw new Error(
      "Este registro não permite edição de campos."
    );
  }

  const { data, error } = await clienteSupabase
    .from("bonavere_processos")
    .update({
      [campo]: valor
    })
    .eq("id", processo.id)
    .select("id");

  if (error) throw error;

  if (!data || data.length !== 1) {
    throw new Error(
      "O banco não confirmou a alteração."
    );
  }

  await carregarProcessos();
}

// ==========================================
// EDITAR CAMPOS DE TEXTO
// ==========================================


function adicionarCelulaEditavel(linha, processo, campo) {
  const celula = adicionarCelula(
    linha,
    processo[campo] || "—"
  );

  if (!podeEditarCampos(processo)) {
    return celula;
  }

  celula.classList.add("celula-editavel");
  celula.title = "Clique para editar";

  let preparando = false;

  celula.addEventListener("click", async () => {
    if (preparando || celula.querySelector("input")) return;

    preparando = true;

    const original = processo[campo] || "";

    try {
      if (campo === "cliente") {
        await exigirSessaoParaEdicao();
        await carregarSugestoesClientesPrazo();
      }
    } catch (erro) {
      console.error("Erro ao preparar edição:", erro);
      alert("Não foi possível carregar os clientes cadastrados.");
      preparando = false;
      return;
    }

    const entrada = document.createElement("input");

    entrada.type = "text";
    entrada.className = "entrada-celula";
    entrada.value = original;

    entrada.setAttribute(
      "aria-label",
      `Editar ${campo}`
    );

    if (campo === "cliente") {
      entrada.setAttribute(
        "list",
        "listaSugestoesClientesPrazo"
      );

      entrada.setAttribute(
        "autocomplete",
        "off"
      );

      entrada.placeholder = "Digite o nome do cliente";
    }

    celula.replaceChildren(entrada);

    preparando = false;

    let finalizada = false;

    function restaurar() {
      celula.textContent = original || "—";
    }

    async function salvar() {
      if (finalizada) return;

      let novoValor = entrada.value.trim();

      if (novoValor === original.trim()) {
        finalizada = true;
        restaurar();
        return;
      }

      if (campo === "cliente") {
        try {
          novoValor = validarClienteSelecionadoPrazo(
            novoValor
          );
        } catch (erro) {
          finalizada = true;
          restaurar();
          alert(erro.message);
          return;
        }
      }

      finalizada = true;
      entrada.disabled = true;

      try {
        await atualizarCampo(
          processo,
          campo,
          novoValor || null
        );
      } catch (erro) {
        console.error(
          "Erro ao editar texto:",
          erro
        );

        restaurar();

        alert(
          "Não foi possível salvar a alteração."
        );
      }
    }

    entrada.addEventListener("keydown", evento => {
      if (evento.key === "Enter") {
        evento.preventDefault();
        salvar();
      } else if (evento.key === "Escape") {
        evento.preventDefault();
        finalizada = true;
        restaurar();
      }
    });

    entrada.addEventListener("blur", salvar);

    entrada.focus();
    entrada.select();
  });

  return celula;
}


// ==========================================
// EDITAR DATAS
// ==========================================


function adicionarCelulaData(linha, processo, campo) {
  const celula = adicionarCelula(
    linha,
    formatarData(processo[campo])
  );

  if (campo === "vencimento") {
    aplicarCorVencimento(celula, processo);
  }

  if (!podeEditarCampos(processo)) {
    return celula;
  }

  celula.classList.add("celula-editavel");
  celula.title = "Clique para digitar a data (DD/MM/AAAA)";

  celula.addEventListener("click", () => {
    if (celula.querySelector("input")) return;

    const original = processo[campo] || "";

    const entrada = document.createElement("input");
    entrada.type = "text";
    entrada.inputMode = "numeric";
    entrada.maxLength = 10;
    entrada.placeholder = "DD/MM/AAAA";
    entrada.className = "entrada-celula";
    entrada.value = original ? formatarData(original) : "";

    entrada.setAttribute(
      "aria-label",
      "Digite a data no formato dia, mês e ano"
    );

    celula.replaceChildren(entrada);

    let finalizada = false;

    function restaurar() {
      celula.textContent = formatarData(original);

      if (campo === "vencimento") {
        aplicarCorVencimento(celula, processo);
      }
    }

    function converterData(valor) {
      const texto = valor.trim();

      if (!texto) return null;

      const resultado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);

      if (!resultado) {
        throw new Error(
          "Digite a data completa no formato DD/MM/AAAA."
        );
      }

      const dia = Number(resultado[1]);
      const mes = Number(resultado[2]);
      const ano = Number(resultado[3]);

      if (ano < 1900 || ano > 2199) {
        throw new Error(
          "Informe um ano válido entre 1900 e 2199."
        );
      }

      const dataTeste = new Date(
        Date.UTC(ano, mes - 1, dia)
      );

      if (
        dataTeste.getUTCFullYear() !== ano ||
        dataTeste.getUTCMonth() !== mes - 1 ||
        dataTeste.getUTCDate() !== dia
      ) {
        throw new Error("A data informada não existe.");
      }

      return [
        String(ano).padStart(4, "0"),
        String(mes).padStart(2, "0"),
        String(dia).padStart(2, "0")
      ].join("-");
    }

    async function salvar() {
      if (finalizada) return;

      let novaData;

      try {
        novaData = converterData(entrada.value);
      } catch (erro) {
        alert(erro.message);
        entrada.focus();
        return;
      }

      if (novaData === (original || null)) {
        finalizada = true;
        restaurar();
        return;
      }

      finalizada = true;
      entrada.disabled = true;

      try {
        await atualizarCampo(
          processo,
          campo,
          novaData
        );
      } catch (erro) {
        console.error("Erro ao editar data:", erro);
        restaurar();
        alert("Não foi possível salvar a data.");
      }
    }

    entrada.addEventListener("keydown", evento => {
      if (evento.key === "Enter") {
        evento.preventDefault();
        salvar();
      }

      if (evento.key === "Escape") {
        evento.preventDefault();
        finalizada = true;
        restaurar();
      }
    });

    entrada.addEventListener("blur", () => {
      if (finalizada) return;

      // Não salvar uma data incompleta ao sair do campo.
      const texto = entrada.value.trim();

      if (
        texto &&
        !/^\d{2}\/\d{2}\/\d{4}$/.test(texto)
      ) {
        finalizada = true;
        restaurar();
        return;
      }

      salvar();
    });

    entrada.focus();
    entrada.select();
  });

  return celula;
}

// ==========================================
// RESPONSAVEL E TIPO EDITAVEIS
// ==========================================

function adicionarCelulaSelecao(
  linha,
  processo,
  configuracao
) {
  const {
    campo,
    nomeAtual,
    opcoes,
    rotulo
  } = configuracao;

  const celula = adicionarCelula(
    linha,
    nomeAtual || "—"
  );

  if (!podeEditarCampos(processo)) {
    return celula;
  }

  const seletor =
    document.createElement("select");

  seletor.className = "seletor-situacao";

  seletor.setAttribute(
    "aria-label",
    `${rotulo} do processo ${processo.numero_processo || ""}`
  );

  const vazia =
    document.createElement("option");

  vazia.value = "";
  vazia.textContent = "Selecione";

  seletor.appendChild(vazia);

  const atual = processo[campo] || "";

  // Preserva os vinculados inativos.
  for (const item of opcoes) {
    if (
      !item.ativo &&
      item.id !== atual
    ) {
      continue;
    }

    const opcao =
      document.createElement("option");

    opcao.value = item.id;

    opcao.textContent =
      item.nome +
      (item.ativo ? "" : " (Inativo)");

    seletor.appendChild(opcao);
  }

  if (
    atual &&
    !Array.from(seletor.options).some(
      opcao => opcao.value === atual
    )
  ) {
    const opcao =
      document.createElement("option");

    opcao.value = atual;

    opcao.textContent =
      `${nomeAtual || "Registro atual"} (não disponível)`;

    seletor.appendChild(opcao);
  }

  seletor.value = atual;

  seletor.addEventListener(
    "change",
    async () => {
      const novo = seletor.value;

      if (novo === atual) return;

      seletor.disabled = true;

      try {
        await atualizarCampo(
          processo,
          campo,
          novo || null
        );

      } catch (erro) {
        console.error(
          `Erro ao alterar ${rotulo}:`,
          erro
        );

        seletor.value = atual;

        alert(
          `Não foi possível alterar ${rotulo.toLowerCase()}.`
        );

      } finally {
        seletor.disabled = false;
      }
    }
  );

  celula.replaceChildren(seletor);

  return celula;
}

// ==========================================
// JANELA DE OBSERVACOES
// ==========================================

function adicionarCelulaObservacao(linha, processo) {
  const celula = adicionarCelula(
    linha,
    processo.observacao || "—"
  );

  celula.classList.add("observacao-celula");

  celula.title =
    "Clique para visualizar a observação";

  celula.addEventListener("click", () => {
    const podeAlterar =
      podeEditarCampos(processo);

    const janela =
      document.createElement("dialog");

    janela.className = "janela-observacao";

    const titulo =
      document.createElement("h2");

    titulo.textContent =
      "Observação do processo";

    const identificacao =
      document.createElement("p");

    identificacao.className =
      "identificacao-observacao";

    identificacao.textContent =
      processo.numero_processo ||
      "Processo sem número";

    const campo =
      document.createElement("textarea");

    campo.className = "texto-observacao";
    campo.value = processo.observacao || "";
    campo.readOnly = !podeAlterar;

    const acoes =
      document.createElement("div");

    acoes.className = "acoes-observacao";

    const botaoFechar =
      document.createElement("button");

    botaoFechar.type = "button";
    botaoFechar.textContent = "Fechar";

    acoes.appendChild(botaoFechar);

    botaoFechar.addEventListener(
      "click",
      () => janela.close()
    );

    if (podeAlterar) {
      const botaoSalvar =
        document.createElement("button");

      botaoSalvar.type = "button";
      botaoSalvar.className =
        "salvar-observacao";

      botaoSalvar.textContent =
        "Salvar alterações";

      acoes.appendChild(botaoSalvar);

      botaoSalvar.addEventListener(
        "click",
        async () => {
          const novoTexto =
            campo.value.trim();

          const textoAnterior =
            processo.observacao || "";

          if (novoTexto === textoAnterior) {
            janela.close();
            return;
          }

          botaoSalvar.disabled = true;
          botaoSalvar.textContent =
            "Salvando...";

          try {
            await atualizarCampo(
              processo,
              "observacao",
              novoTexto || null
            );

            janela.close();

          } catch (erro) {
            console.error(
              "Erro ao salvar observação:",
              erro
            );

            alert(
              "Não foi possível salvar a observação."
            );

            botaoSalvar.disabled = false;
            botaoSalvar.textContent =
              "Salvar alterações";
          }
        }
      );
    }

    janela.appendChild(titulo);
    janela.appendChild(identificacao);
    janela.appendChild(campo);
    janela.appendChild(acoes);

    document.body.appendChild(janela);

    janela.addEventListener(
      "close",
      () => janela.remove()
    );

    janela.showModal();
  });

  return celula;
}

// ==========================================
// MONTAR LINHAS DA PLANILHA
// ==========================================

function criarLinha(processo) {
  const linha = document.createElement("tr");

  if (processo.status === "em_processo") {
    linha.classList.add("em-processo");
  }

  if (processo.status === "concluida") {
    linha.classList.add("concluida");
  }

  // 1. Processo
  adicionarCelulaEditavel(
    linha,
    processo,
    "numero_processo"
  );

  // 2. Tribunal
  adicionarCelulaEditavel(
    linha,
    processo,
    "origem"
  );

  // 3. Cliente
  adicionarCelulaEditavel(
    linha,
    processo,
    "cliente"
  );

  // 4. Publicacao
  adicionarCelulaData(
    linha,
    processo,
    "publicacao"
  );

  // 5. Data limite
  adicionarCelulaData(
    linha,
    processo,
    "data_limite"
  );

  // 6. Vencimento
  adicionarCelulaData(
    linha,
    processo,
    "vencimento"
  );

  // 7. Observacao
  adicionarCelulaObservacao(
    linha,
    processo
  );

  // 8. Responsavel
  adicionarCelulaSelecao(
    linha,
    processo,
    {
      campo: "responsavel_id",
      nomeAtual:
        processo.bonavere_responsaveis?.nome,
      opcoes: responsaveis,
      rotulo: "Responsável"
    }
  );

  // 9. Tipo
  adicionarCelulaSelecao(
    linha,
    processo,
    {
      campo: "tipo_id",
      nomeAtual:
        processo.bonavere_tipos?.nome,
      opcoes: tiposAtividade,
      rotulo: "Tipo"
    }
  );

  // 10. Situacao
  const celulaSituacao =
    document.createElement("td");

  if (podeEditar && acessoAutorizado) {
    const seletor =
      document.createElement("select");

    seletor.className = "seletor-situacao";

    seletor.setAttribute(
      "aria-label",
      `Situação do processo ${processo.numero_processo || ""}`
    );

    for (
      const [valor, nome]
      of Object.entries(situacoes)
    ) {
      const opcao =
        document.createElement("option");

      opcao.value = valor;
      opcao.textContent = nome;

      seletor.appendChild(opcao);
    }

    seletor.value = processo.status;

    seletor.addEventListener(
      "change",
      () => alterarSituacao(processo, seletor)
    );

    celulaSituacao.appendChild(seletor);

  } else {
    celulaSituacao.textContent =
      situacoes[processo.status] ||
      processo.status;
  }

  linha.appendChild(celulaSituacao);

  return linha;
}

// ==========================================
// ORDENAR PROCESSOS EM ABERTO
// ==========================================

function ordenarAbertos(a, b) {
  if (!a.data_limite && b.data_limite) {
    return -1;
  }

  if (a.data_limite && !b.data_limite) {
    return 1;
  }

  if (a.data_limite && b.data_limite) {
    const diferenca =
      a.data_limite.localeCompare(
        b.data_limite
      );

    if (diferenca !== 0) {
      return diferenca;
    }
  }

  if (!a.vencimento && b.vencimento) {
    return 1;
  }

  if (a.vencimento && !b.vencimento) {
    return -1;
  }

  if (a.vencimento && b.vencimento) {
    const diferenca =
      a.vencimento.localeCompare(
        b.vencimento
      );

    if (diferenca !== 0) {
      return diferenca;
    }
  }

  return a.criado_em.localeCompare(
    b.criado_em
  );
}

// ==========================================
// SEPARAR PROCESSOS ABERTOS E FECHADOS
// ==========================================

function filtrarProcessosBonavere(processos) {
  if (!pesquisaPrazos) return processos;

  function normalizar(texto) {
    return String(texto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
  }

  const termo = normalizar(pesquisaPrazos.value);

  if (!termo) return processos;

  const termoSemPontuacao = termo.replace(
    /[^a-z0-9]/g,
    ""
  );

  return processos.filter(processo => {
    const nomeCliente = normalizar(processo.cliente);
    const numeroProcesso = normalizar(
      processo.numero_processo
    );

    const numeroSemPontuacao = numeroProcesso.replace(
      /[^a-z0-9]/g,
      ""
    );

    return (
      nomeCliente.includes(termo) ||
      numeroProcesso.includes(termo) ||
      (
        termoSemPontuacao.length > 0 &&
        numeroSemPontuacao.includes(termoSemPontuacao)
      )
    );
  });
}

function mostrarProcessos(processos) {

const processosFiltrados = filtrarProcessosBonavere(processos);

const abertos = processosFiltrados
    .filter(processo => !encerrado(processo))
    .sort(ordenarAbertos);


const fechados = processosFiltrados
    .filter(encerrado)
    .sort((a, b) =>
      b.atualizado_em.localeCompare(
        a.atualizado_em
      )
    );

  tabelaAbertos.replaceChildren();
  tabelaFechados.replaceChildren();

  for (const processo of abertos) {
    tabelaAbertos.appendChild(
      criarLinha(processo)
    );
  }

  for (const processo of fechados) {
    tabelaFechados.appendChild(
      criarLinha(processo)
    );
  }

  if (abertos.length === 0) {
    mensagemTabela(
      tabelaAbertos,
      "Nenhum processo em aberto."
    );
  }

  if (fechados.length === 0) {
    mensagemTabela(
      tabelaFechados,
      "Nenhum processo fechado."
    );
  }

  totalAbertos.textContent =
    `${abertos.length} registro(s)`;

  totalFechados.textContent =
    `${fechados.length} registro(s)`;
}

if (pesquisaPrazos) {
  pesquisaPrazos.addEventListener("input", () => {
    if (!acessoAutorizado) return;

    mostrarProcessos(processosEmMemoria);
  });
}

// ==========================================
// ALTERAR SITUACAO
// ==========================================

async function alterarSituacao(
  processo,
  seletor
) {
  const novaSituacao = seletor.value;

  if (
    !podeEditar ||
    !usuarioAtual ||
    !acessoAutorizado
  ) {
    seletor.value = processo.status;
    return;
  }

  if (novaSituacao === processo.status) {
    return;
  }

  if (
    novaSituacao === "concluida" ||
    novaSituacao === "nada_a_fazer"
  ) {
    const confirmar = window.confirm(
      `Deseja encerrar este prazo como "${situacoes[novaSituacao]}"?\n\n` +
      "O registro será transferido para Processos fechados."
    );

    if (!confirmar) {
      seletor.value = processo.status;
      return;
    }
  }

  seletor.disabled = true;

  try {
    await exigirSessaoParaEdicao();

    const { data, error } = await clienteSupabase
      .from("bonavere_processos")
      .update({
        status: novaSituacao
      })
      .eq("id", processo.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "O banco não confirmou a alteração."
      );
    }

    await carregarProcessos();

  } catch (erro) {
    console.error(
      "Erro ao alterar situação:",
      erro
    );

    seletor.value = processo.status;

    alert(
      "Não foi possível alterar a situação."
    );

  } finally {
    seletor.disabled = false;
  }
}

// ==========================================
// CARREGAR RESPONSAVEIS
// ==========================================

async function carregarResponsaveis() {
  const { data, error } = await clienteSupabase
    .from("bonavere_responsaveis")
    .select("id, nome, ativo")
    .order("nome", {
      ascending: true
    });

  if (error) throw error;

  responsaveis = data || [];
}

// ==========================================
// CARREGAR TIPOS DE ATIVIDADE
// ==========================================

async function carregarTipos() {
  const { data, error } = await clienteSupabase
    .from("bonavere_tipos")
    .select("id, nome, ativo")
    .order("nome", {
      ascending: true
    });

  if (error) throw error;

  tiposAtividade = data || [];
}

// ==========================================
// CONSULTAR PROCESSOS
// ==========================================

async function carregarProcessos() {
  const sessaoValida =
    await conferirSessaoBonavere();

  if (!sessaoValida || !acessoAutorizado) {
    return;
  }

  const { data, error } = await clienteSupabase
    .from("bonavere_processos")
    .select(`
      id,
      numero_processo,
      origem,
      cliente,
      publicacao,
      data_limite,
      vencimento,
      observacao,
      responsavel_id,
      tipo_id,
      status,
      criado_em,
      atualizado_em,
      bonavere_responsaveis!bonavere_processos_responsavel_id_fkey(nome),
      bonavere_tipos(nome)
    `)
    .order("criado_em", {
      ascending: true
    })
    .limit(1000);

  if (error) throw error;

  const aindaValida =
    await conferirSessaoBonavere();

  if (!aindaValida || !acessoAutorizado) {
    return;
  }


processosEmMemoria = data || [];

mostrarProcessos(processosEmMemoria);
}

// ==========================================
// VERIFICAR PERMISSAO DO USUARIO
// ==========================================

async function verificarPermissao() {
  podeEditar = false;
  acessoAutorizado = false;
  botaoNovo.disabled = true;

  const { data: perfil, error } =
    await clienteSupabase
      .from("perfis")
      .select("id, master, autorizado")
      .eq("id", usuarioAtual.id)
      .maybeSingle();

  if (error) throw error;

  if (!perfil?.autorizado) {
    return false;
  }

  if (perfil.master === true) {
    podeEditar = true;
    acessoAutorizado = true;
    botaoNovo.disabled = false;
    return true;
  }

  const {
    data: permissao,
    error: erroPermissao
  } = await clienteSupabase
    .from("permissoes")
    .select("nivel")
    .eq("user_id", usuarioAtual.id)
    .eq("modulo", "bonavere")
    .maybeSingle();

  if (erroPermissao) {
    throw erroPermissao;
  }

  podeEditar =
    permissao?.nivel === "editar";

  acessoAutorizado =
    permissao?.nivel === "ver" ||
    permissao?.nivel === "editar";

  botaoNovo.disabled = !podeEditar;

  return acessoAutorizado;
}

// ==========================================
// PREENCHER LISTAS DO FORMULARIO
// ==========================================

function preencherSelecao(campo, registros) {
  campo.replaceChildren();

  const primeira =
    document.createElement("option");

  primeira.value = "";
  primeira.textContent = "Selecione";

  campo.appendChild(primeira);

  for (const registro of registros) {
    const opcao =
      document.createElement("option");

    opcao.value = registro.id;
    opcao.textContent = registro.nome;

    campo.appendChild(opcao);
  }
}

async function carregarOpcoesFormulario() {
  preencherSelecao(
    formulario.elements.namedItem(
      "responsavel_id"
    ),
    responsaveis.filter(
      pessoa => pessoa.ativo
    )
  );

  preencherSelecao(
    formulario.elements.namedItem("tipo_id"),
    tiposAtividade.filter(
      tipo => tipo.ativo
    )
  );
}

function validarClienteSelecionadoPrazo(nome) {
  const valor = String(nome ?? "").trim();

  if (!valor) {
    throw new Error(
      "Selecione um cliente cadastrado."
    );
  }

  const lista = document.getElementById(
    "listaSugestoesClientesPrazo"
  );

  if (!lista) {
    throw new Error(
      "A lista de clientes não está disponível."
    );
  }

  const opcoes = Array.from(lista.options);

  const encontrado = opcoes.find(opcao =>
    opcao.value.localeCompare(
      valor,
      "pt-BR",
      { sensitivity: "base" }
    ) === 0
  );

  if (!encontrado) {
    throw new Error(
      "Cliente não encontrado. Selecione um cliente cadastrado na aba Clientes."
    );
  }

  return encontrado.value;
}

async function carregarSugestoesClientesPrazo() {
  const listaSugestoes = document.getElementById(
    "listaSugestoesClientesPrazo"
  );

  if (!listaSugestoes) {
    throw new Error(
      "Lista de sugestões de clientes não encontrada."
    );
  }

  const { data, error } = await clienteSupabase
    .from("bonavere_clientes")
    .select("nome_completo")
    .eq("ativo", true)
    .order("nome_completo", { ascending: true })
    .limit(1000);

  if (error) throw error;

  listaSugestoes.replaceChildren();

  for (const registro of data || []) {
    const opcao = document.createElement("option");

    opcao.value = registro.nome_completo;

    listaSugestoes.appendChild(opcao);
  }
}

// ==========================================
// ABRIR FORMULARIO DE NOVO PRAZO
// ==========================================

botaoNovo.addEventListener(
  "click",
  async () => {
    if (!podeEditar || !acessoAutorizado) {
      return;
    }

    botaoNovo.disabled = true;

    try {
      await exigirSessaoParaEdicao();

      formulario.reset();

     
await Promise.all([
  carregarResponsaveis(),
  carregarTipos(),
  carregarSugestoesClientesPrazo()
]);


      await carregarOpcoesFormulario();

      botaoSalvar.disabled = false;

      modal.showModal();

    } catch (erro) {
      console.error(
        "Erro ao preparar formulário:",
        erro
      );

      alert(
        "Não foi possível abrir o cadastro."
      );

    } finally {
      botaoNovo.disabled = !podeEditar;
    }
  }
);

botaoCancelar.addEventListener(
  "click",
  () => modal.close()
);

// ==========================================
// CADASTRAR NOVO PRAZO
// ==========================================

function textoOuNulo(valor) {
  return String(valor || "").trim() || null;
}

function validarDataFormulario(valor, nomeCampo) {
  const texto = String(valor || "").trim();

  if (!texto) return null;

  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);

  if (!partes) {
    throw new Error(
      `${nomeCampo}: informe a data completa em DD/MM/AAAA.`
    );
  }

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const ano = Number(partes[3]);

  if (ano < 1900 || ano > 2199) {
    throw new Error(
      `${nomeCampo}: informe um ano válido entre 1900 e 2199.`
    );
  }

  const data = new Date(Date.UTC(ano, mes - 1, dia));

  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw new Error(
      `${nomeCampo}: a data informada não existe.`
    );
  }

  return [
    String(ano).padStart(4, "0"),
    String(mes).padStart(2, "0"),
    String(dia).padStart(2, "0")
  ].join("-");
}

formulario.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    if (
      !podeEditar ||
      !usuarioAtual ||
      !acessoAutorizado
    ) {
      alert(
        "Você não possui permissão de edição."
      );
      return;
    }

    const dados = new FormData(formulario);

    let datasValidadas;

    try {
      datasValidadas = {
        publicacao: validarDataFormulario(
          dados.get("publicacao"),
          "Publicação"
        ),
        data_limite: validarDataFormulario(
          dados.get("data_limite"),
          "Data limite"
        ),
        vencimento: validarDataFormulario(
          dados.get("vencimento"),
          "Vencimento"
        )
      };
    } catch (erro) {
      alert(erro.message);
      return;
    }

    let clienteSelecionado;

    try {
      clienteSelecionado = validarClienteSelecionadoPrazo(
        dados.get("cliente")
      );
    } catch (erro) {
      alert(erro.message);
      return;
    }

    const novoProcesso = {
      numero_processo: textoOuNulo(
        dados.get("numero_processo")
      ),

      origem: textoOuNulo(
        dados.get("origem")
      ),

    
      cliente: clienteSelecionado,


     
      publicacao: datasValidadas.publicacao,

      data_limite: datasValidadas.data_limite,

      vencimento: datasValidadas.vencimento,


      observacao: textoOuNulo(
        dados.get("observacao")
      ),

      responsavel_id: textoOuNulo(
        dados.get("responsavel_id")
      ),

      tipo_id: textoOuNulo(
        dados.get("tipo_id")
      ),

      status:
        dados.get("status") || "aberta"
    };

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
      await exigirSessaoParaEdicao();

      const { error } = await clienteSupabase
        .from("bonavere_processos")
        .insert(novoProcesso);

      if (error) throw error;

      modal.close();

      await carregarProcessos();

      alert(
        "Prazo cadastrado com sucesso!"
      );

    } catch (erro) {
      console.error(
        "Erro ao cadastrar prazo:",
        erro
      );

      alert(
        "Não foi possível concluir o cadastro."
      );

    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar prazo";
    }
  }
);

// ==========================================
// INICIAR O MODULO BONAVERE
// ==========================================

async function iniciarBonavere() {
  podeEditar = false;
  acessoAutorizado = false;
  botaoNovo.disabled = true;

  mensagemTabela(
    tabelaAbertos,
    "Verificando autenticação..."
  );

  mensagemTabela(
    tabelaFechados,
    "Aguardando autorização..."
  );

  try {
    if (!window.GestorBCASessao) {
      throw new Error(
        "Configuração de sessão indisponível."
      );
    }

    clienteSupabase =
      window.GestorBCASessao.criarCliente();

    // 1. Confirmar usuario autenticado.
    const { data, error } =
      await clienteSupabase.auth.getUser();

    if (error || !data?.user) {
      window.location.replace("./index.html");
      return;
    }

    // 2. Verificar a expiracao da sessao.
    const sessaoValida =
      await conferirSessaoBonavere();

    if (!sessaoValida) {
      return;
    }

    usuarioAtual = data.user;

    // 3. Verificar permissao de leitura ou edicao.
    const autorizado =
      await verificarPermissao();

    if (!autorizado) {
      usuarioAtual = null;
      podeEditar = false;
      acessoAutorizado = false;
      botaoNovo.disabled = true;

      mensagemTabela(
        tabelaAbertos,
        "Sua conta não possui acesso ao módulo Bonavere."
      );

      mensagemTabela(
        tabelaFechados,
        "Acesso não autorizado."
      );

      return;
    }

    // 4. Iniciar o monitoramento de inatividade.
    window.GestorBCASessao.iniciarMonitoramento(
      clienteSupabase
    );

    // 5. Carregar os dados.
    mensagemTabela(
      tabelaAbertos,
      "Carregando processos..."
    );

    await Promise.all([
      carregarResponsaveis(),
      carregarTipos()
    ]);

    const validaAposConsultas =
      await conferirSessaoBonavere();

    if (!validaAposConsultas) {
      return;
    }

    await carregarProcessos();

  } catch (erro) {
    console.error(
      "Erro ao iniciar Bonavere:",
      erro
    );

    mensagemTabela(
      tabelaAbertos,
      "Não foi possível carregar os processos."
    );

    mensagemTabela(
      tabelaFechados,
      "Carregamento indisponível."
    );

    podeEditar = false;
    acessoAutorizado = false;
    botaoNovo.disabled = true;
  }
}

 // ==========================================
 // INICIALIZACAO E NAVEGACAO
 // ==========================================

const botoesAbas = document.querySelectorAll(
  ".aba-bonavere"
);


const conteudosAbas = {
  prazos: document.getElementById("conteudoPrazos"),
  audiencias: document.getElementById("conteudoAudiencias"),
  agenda: document.getElementById("conteudoAgenda"),
  clientes: document.getElementById("conteudoClientes")
};


function selecionarAbaBonavere(nomeAba) {
  if (!conteudosAbas[nomeAba]) return;

  botoesAbas.forEach(botao => {
    const ativa = botao.dataset.aba === nomeAba;

    botao.classList.toggle("ativa", ativa);
    botao.setAttribute("aria-pressed", String(ativa));
  });

  Object.entries(conteudosAbas).forEach(
    ([nome, conteudo]) => {
      conteudo.hidden = nome !== nomeAba;
    }
  );
}

// Alternar entre Prazos, Audiencias e Agenda.
botoesAbas.forEach(botao => {
  botao.addEventListener("click", () => {
    const aba = botao.dataset.aba;

    selecionarAbaBonavere(aba);

    // Guardar a aba para preservar apos F5.
    sessionStorage.setItem(
      "gestor_bca_aba_bonavere",
      aba
    );
  });
});

// Recuperar a aba selecionada anteriormente.
const abaSalva = sessionStorage.getItem(
  "gestor_bca_aba_bonavere"
);

selecionarAbaBonavere(
  conteudosAbas[abaSalva] ? abaSalva : "prazos"
);

// Iniciar o modulo e carregar as permissoes.
iniciarBonavere();
