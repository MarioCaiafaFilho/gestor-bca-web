
"use strict";

// ==========================================
// GESTOR BCA - FECHAMENTO MENSAL
// ==========================================

// Este arquivo utiliza js/sessao.js,
// que deve ser carregado antes dele.

let clienteSupabase = null;
let acessoMaster = false;
let consultaEmAndamento = false;
let lancamentoEmEdicao = null;
let salvandoEdicaoFinanceira = false;

// ==========================================
// ELEMENTOS DA PAGINA
// ==========================================

const mensagemFechamento =
  document.getElementById("mensagemFechamento");

const painelFechamento =
  document.getElementById("painelFechamento");

const filtroMes =
  document.getElementById("filtroMes");

const filtroResponsavel =
  document.getElementById("filtroResponsavel");

const botaoConsultar =
  document.getElementById("botaoConsultar");

const totalAtividades =
  document.getElementById("totalAtividades");

const totalPendente =
  document.getElementById("totalPendente");

const totalPago =
  document.getElementById("totalPago");

const quantidadeAtividades =
  document.getElementById("quantidadeAtividades");

const corpoResumo =
  document.getElementById("corpoResumo");

const corpoLancamentos =
  document.getElementById("corpoLancamentos");

const janelaEditarFinanceiro =
  document.getElementById("janelaEditarFinanceiro");

const formEditarFinanceiro =
  document.getElementById("formEditarFinanceiro");

const identificacaoLancamento =
  document.getElementById("identificacaoLancamento");

const editarLancamentoId =
  document.getElementById("editarLancamentoId");

const editarDataConclusao =
  document.getElementById("editarDataConclusao");

const editarCompetencia =
  document.getElementById("editarCompetencia");

const editarMesFechamento =
  document.getElementById("editarMesFechamento");

const editarValor =
  document.getElementById("editarValor");

const editarPagamento =
  document.getElementById("editarPagamento");

const cancelarEdicaoFinanceira =
  document.getElementById("cancelarEdicaoFinanceira");

const salvarEdicaoFinanceira =
  document.getElementById("salvarEdicaoFinanceira");

const mensagemEdicaoFinanceira =
  document.getElementById("mensagemEdicaoFinanceira");

// ==========================================
// FORMATACAO
// ==========================================

const formatadorMoeda = new Intl.NumberFormat(
  "pt-BR",
  {
    style: "currency",
    currency: "BRL"
  }
);

function formatarMoeda(valor) {
  return formatadorMoeda.format(
    Number(valor) || 0
  );
}

function formatarData(data) {
  if (!data) return "—";

  const partes = data.split("-");

  if (partes.length !== 3) {
    return data;
  }

  return [
    partes[2],
    partes[1],
    partes[0]
  ].join("/");
}

function formatarMes(data) {
  if (!data) return "—";

  const partes = data.split("-");

  if (partes.length < 2) {
    return data;
  }

  return partes[1] + "/" + partes[0];
}

function mesAtual() {
  const hoje = new Date();

  const ano = hoje.getFullYear();

  const mes = String(
    hoje.getMonth() + 1
  ).padStart(2, "0");

  return `${ano}-${mes}`;
}

function proximoMes(mesSelecionado) {
  const [ano, mes] = mesSelecionado
    .split("-")
    .map(Number);

  if (mes === 12) {
    return `${ano + 1}-01-01`;
  }

  return (
    `${ano}-${String(mes + 1).padStart(2, "0")}-01`
  );
}

// ==========================================
// PROTECAO DOS DADOS FINANCEIROS
// ==========================================

function bloquearFechamento() {
  acessoMaster = false;

  painelFechamento.classList.add("oculto");

  botaoConsultar.disabled = true;
  salvarEdicaoFinanceira.disabled = true;

  lancamentoEmEdicao = null;

  limparResultados();

  if (janelaEditarFinanceiro.open) {
    janelaEditarFinanceiro.close();
  }
}

// Verifica o prazo de inatividade e a
// autenticacao antes de acessar dados
// financeiros.
//
// As politicas RLS do Supabase continuam
// sendo obrigatorias para proteger o banco.

async function exigirMasterFinanceiro() {
  if (
    !acessoMaster ||
    !clienteSupabase ||
    !window.GestorBCASessao
  ) {
    throw new Error(
      "Acesso financeiro restrito ao Master."
    );
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
    bloquearFechamento();

    await window.GestorBCASessao
      .encerrarPorInatividade(
        clienteSupabase
      );

    throw new Error(
      "Sessão expirada. Faça login novamente."
    );
  }

  const { data, error } =
    await clienteSupabase.auth.getUser();

  if (error || !data?.user) {
    bloquearFechamento();

    window.location.replace("./index.html");

    throw new Error(
      "Autenticação não encontrada."
    );
  }

  return true;
}

// ==========================================
// FUNCOES AUXILIARES DA TABELA
// ==========================================

function criarCelula(linha, conteudo, classe = "") {
  const celula = document.createElement("td");

  celula.textContent = String(
    conteudo ?? "—"
  );

  if (classe) {
    celula.className = classe;
  }

  linha.appendChild(celula);

  return celula;
}

function mostrarTabelaVazia(
  corpo,
  colunas,
  texto
) {
  corpo.replaceChildren();

  const linha = document.createElement("tr");
  const celula = document.createElement("td");

  celula.colSpan = colunas;
  celula.textContent = texto;

  linha.appendChild(celula);
  corpo.appendChild(linha);
}

function limparResultados() {
  totalAtividades.textContent =
    formatarMoeda(0);

  totalPendente.textContent =
    formatarMoeda(0);

  totalPago.textContent =
    formatarMoeda(0);

  quantidadeAtividades.textContent = "0";

  mostrarTabelaVazia(
    corpoResumo,
    5,
    "Nenhum fechamento carregado."
  );

  mostrarTabelaVazia(
    corpoLancamentos,
    9,
    "Nenhuma atividade carregada."
  );
}

// ==========================================
// CARREGAR RESPONSAVEIS
// ==========================================

async function carregarResponsaveis() {
  await exigirMasterFinanceiro();

  const { data, error } = await clienteSupabase
    .from("bonavere_responsaveis")
    .select("id, nome")
    .order("nome", {
      ascending: true
    });

  if (error) throw error;

  await exigirMasterFinanceiro();

  filtroResponsavel.replaceChildren();

  const todos = document.createElement("option");

  todos.value = "";
  todos.textContent = "Todos os responsáveis";

  filtroResponsavel.appendChild(todos);

  for (const responsavel of data || []) {
    const opcao = document.createElement("option");

    opcao.value = responsavel.id;
    opcao.textContent = responsavel.nome;

    filtroResponsavel.appendChild(opcao);
  }
}

// ==========================================
// CONSULTAR LANCAMENTOS
// ==========================================

async function buscarLancamentos() {
  await exigirMasterFinanceiro();

  const mesSelecionado = filtroMes.value;

  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesSelecionado)
  ) {
    throw new Error(
      "Selecione um mês de fechamento válido."
    );
  }

  const inicio = mesSelecionado + "-01";
  const fim = proximoMes(mesSelecionado);

  const responsavelId = filtroResponsavel.value;

  const todosLancamentos = [];
  const tamanhoPagina = 500;

  // Paginacao para evitar o limite
  // padrao de resultados por consulta.

  for (
    let inicioPagina = 0;
    ;
    inicioPagina += tamanhoPagina
  ) {
    await exigirMasterFinanceiro();

    let consulta = clienteSupabase
      .from("bonavere_lancamentos")
      .select(`
        id,
        processo_id,
        ciclo,
        responsavel_id,
        tipo_id,
        valor_registrado,
        data_conclusao,
        competencia,
        mes_fechamento,
        pago_em,
        bonavere_processos (
          numero_processo
        ),
        bonavere_responsaveis (
          nome
        ),
        bonavere_tipos (
          nome
        )
      `)
      // Somente atividades efetivamente
      // concluidas entram no fechamento.
      .eq("situacao_financeira", "ativa")
      .gte("mes_fechamento", inicio)
      .lt("mes_fechamento", fim)
      .order("mes_fechamento", {
        ascending: true
      })
      .order("id", {
        ascending: true
      })
      .range(
        inicioPagina,
        inicioPagina + tamanhoPagina - 1
      );

    if (responsavelId) {
      consulta = consulta.eq(
        "responsavel_id",
        responsavelId
      );
    }

    const { data, error } = await consulta;

    if (error) throw error;

    await exigirMasterFinanceiro();

    const pagina = data || [];

    todosLancamentos.push(...pagina);

    if (pagina.length < tamanhoPagina) {
      break;
    }
  }

  return todosLancamentos;
}

// ==========================================
// INDICADORES FINANCEIROS
// ==========================================

function atualizarIndicadores(lancamentos) {
  let valorTotal = 0;
  let valorPendente = 0;
  let valorPago = 0;

  for (const item of lancamentos) {
    const valor = Number(
      item.valor_registrado
    ) || 0;

    valorTotal += valor;

    if (item.pago_em) {
      valorPago += valor;
    } else {
      valorPendente += valor;
    }
  }

  totalAtividades.textContent =
    formatarMoeda(valorTotal);

  totalPendente.textContent =
    formatarMoeda(valorPendente);

  totalPago.textContent =
    formatarMoeda(valorPago);

  quantidadeAtividades.textContent =
    String(lancamentos.length);
}

// ==========================================
// RESUMO POR RESPONSAVEL
// ==========================================

function atualizarResumo(lancamentos) {
  corpoResumo.replaceChildren();

  if (lancamentos.length === 0) {
    mostrarTabelaVazia(
      corpoResumo,
      5,
      "Nenhuma atividade encontrada para este filtro."
    );

    return;
  }

  const grupos = new Map();

  for (const item of lancamentos) {
    const id = item.responsavel_id;

    if (!grupos.has(id)) {
      grupos.set(id, {
        nome:
          item.bonavere_responsaveis?.nome ||
          "Responsável não identificado",
        quantidade: 0,
        total: 0,
        pendente: 0,
        pago: 0
      });
    }

    const grupo = grupos.get(id);

    const valor = Number(
      item.valor_registrado
    ) || 0;

    grupo.quantidade++;
    grupo.total += valor;

    if (item.pago_em) {
      grupo.pago += valor;
    } else {
      grupo.pendente += valor;
    }
  }

  const gruposOrdenados = Array.from(
    grupos.values()
  ).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  );

  for (const grupo of gruposOrdenados) {
    const linha = document.createElement("tr");

    criarCelula(linha, grupo.nome);
    criarCelula(linha, grupo.quantidade);

    criarCelula(
      linha,
      formatarMoeda(grupo.total),
      "valor-financeiro"
    );

    criarCelula(
      linha,
      formatarMoeda(grupo.pendente),
      "situacao-pendente"
    );

    criarCelula(
      linha,
      formatarMoeda(grupo.pago),
      "situacao-pago"
    );

    corpoResumo.appendChild(linha);
  }
}

// ==========================================
// ABRIR EDICAO FINANCEIRA
// ==========================================

async function abrirEdicaoFinanceira(item) {
  try {
    await exigirMasterFinanceiro();

    lancamentoEmEdicao = item;

    const numeroProcesso =
      item.bonavere_processos?.numero_processo ||
      "Processo não identificado";

    identificacaoLancamento.textContent =
      `Processo: ${numeroProcesso} | Ciclo: ${item.ciclo}`;

    editarLancamentoId.value = item.id;

    editarDataConclusao.value =
      item.data_conclusao || "";

    editarCompetencia.value =
      item.competencia || "";

    editarMesFechamento.value =
      item.mes_fechamento
        ? item.mes_fechamento.substring(0, 7)
        : "";

    editarValor.value =
      Number(item.valor_registrado).toFixed(2);

    editarPagamento.value =
      item.pago_em || "";

    mensagemEdicaoFinanceira.textContent = "";

    janelaEditarFinanceiro.showModal();

  } catch (erro) {
    console.error(
      "Erro ao abrir edição financeira:",
      erro
    );

    if (acessoMaster) {
      mensagemFechamento.textContent =
        "Não foi possível abrir a edição financeira.";
    }
  }
}

// ==========================================
// CANCELAR EDICAO
// ==========================================

cancelarEdicaoFinanceira.addEventListener(
  "click",
  () => {
    if (salvandoEdicaoFinanceira) return;

    janelaEditarFinanceiro.close();
  }
);

janelaEditarFinanceiro.addEventListener(
  "cancel",
  (evento) => {
    if (salvandoEdicaoFinanceira) {
      evento.preventDefault();
    }
  }
);

janelaEditarFinanceiro.addEventListener(
  "close",
  () => {
    lancamentoEmEdicao = null;
  }
);

// ==========================================
// SALVAR EDICAO FINANCEIRA
// ==========================================

formEditarFinanceiro.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    if (
      !acessoMaster ||
      !clienteSupabase ||
      !lancamentoEmEdicao ||
      salvandoEdicaoFinanceira
    ) {
      return;
    }

    const dataConclusao =
      editarDataConclusao.value;

    const competencia =
      editarCompetencia.value;

    const mesSelecionado =
      editarMesFechamento.value;

    const valorInformado =
      editarValor.value.trim();

    const valor = Number(valorInformado);

    const pagamento =
      editarPagamento.value || null;

    if (
      !dataConclusao ||
      !competencia ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(
        mesSelecionado
      )
    ) {
      mensagemEdicaoFinanceira.textContent =
        "Preencha corretamente as datas obrigatórias.";

      return;
    }

    if (
      valorInformado === "" ||
      !Number.isFinite(valor) ||
      valor < 0 ||
      valor > 9999999999.99 ||
      Math.abs(
        valor * 100 - Math.round(valor * 100)
      ) > 0.000001
    ) {
      mensagemEdicaoFinanceira.textContent =
        "Informe um valor válido com até duas casas decimais.";

      return;
    }

    const mesFechamento =
      mesSelecionado + "-01";

    salvandoEdicaoFinanceira = true;

    salvarEdicaoFinanceira.disabled = true;
    cancelarEdicaoFinanceira.disabled = true;

    salvarEdicaoFinanceira.textContent =
      "Salvando...";

    mensagemEdicaoFinanceira.textContent = "";

    try {
      // Revalidar a sessao antes de
      // realizar a operacao financeira.
      await exigirMasterFinanceiro();

      const { error } = await clienteSupabase
        .rpc("bonavere_editar_lancamento", {
          p_id: lancamentoEmEdicao.id,
          p_data_conclusao: dataConclusao,
          p_competencia: competencia,
          p_mes_fechamento: mesFechamento,
          p_valor: valor,
          p_pago_em: pagamento
        });

      if (error) throw error;

      // Nao apresentar dados se a sessao
      // tiver expirado durante a operacao.
      await exigirMasterFinanceiro();

      janelaEditarFinanceiro.close();

      // Se mudou de mes, o registro pode
      // sair do filtro atualmente selecionado.
      await consultarFechamento();

      if (acessoMaster) {
        mensagemFechamento.textContent =
          "Alteração financeira salva. Consulta atualizada.";
      }

    } catch (erro) {
      console.error(
        "Erro ao salvar edição financeira:",
        erro
      );

      if (acessoMaster) {
        mensagemEdicaoFinanceira.textContent =
          erro?.message ||
          "Não foi possível salvar as alterações.";
      }

    } finally {
      salvandoEdicaoFinanceira = false;

      salvarEdicaoFinanceira.disabled =
        !acessoMaster;

      cancelarEdicaoFinanceira.disabled = false;

      salvarEdicaoFinanceira.textContent =
        "Salvar alterações";
    }
  }
);

// ==========================================
// DETALHAMENTO DOS LANCAMENTOS
// ==========================================

function atualizarDetalhamento(lancamentos) {
  corpoLancamentos.replaceChildren();

  if (lancamentos.length === 0) {
    mostrarTabelaVazia(
      corpoLancamentos,
      9,
      "Nenhum lançamento encontrado."
    );

    return;
  }

  for (const item of lancamentos) {
    const linha = document.createElement("tr");

    const numeroProcesso =
      item.bonavere_processos?.numero_processo ||
      "Processo não identificado";

    const responsavel =
      item.bonavere_responsaveis?.nome ||
      "Não identificado";

    const atividade =
      item.bonavere_tipos?.nome ||
      "Não identificada";

    criarCelula(
      linha,
      numeroProcesso
    );

    criarCelula(
      linha,
      responsavel
    );

    criarCelula(
      linha,
      atividade
    );

    criarCelula(
      linha,
      formatarMoeda(item.valor_registrado),
      "valor-financeiro"
    );

    criarCelula(
      linha,
      formatarData(item.data_conclusao)
    );

    criarCelula(
      linha,
      formatarData(item.competencia)
    );

    criarCelula(
      linha,
      formatarMes(item.mes_fechamento)
    );

    criarCelula(
      linha,
      item.pago_em
        ? formatarData(item.pago_em)
        : "Pendente",
      item.pago_em
        ? "situacao-pago"
        : "situacao-pendente"
    );

    // Acao financeira exclusiva do Master.

    const celulaAcoes =
      document.createElement("td");

    const botaoEditar =
      document.createElement("button");

    botaoEditar.type = "button";

    botaoEditar.className =
      "botao-editar-lancamento";

    botaoEditar.textContent = "Editar";

    botaoEditar.addEventListener(
      "click",
      () => abrirEdicaoFinanceira(item)
    );

    celulaAcoes.appendChild(botaoEditar);

    linha.appendChild(celulaAcoes);

    corpoLancamentos.appendChild(linha);
  }
}

// ==========================================
// CONSULTAR E ATUALIZAR A TELA
// ==========================================

async function consultarFechamento() {
  if (
    !acessoMaster ||
    !clienteSupabase ||
    consultaEmAndamento
  ) {
    return;
  }

  consultaEmAndamento = true;
  botaoConsultar.disabled = true;

  mensagemFechamento.textContent =
    "Consultando lançamentos financeiros...";

  try {
    await exigirMasterFinanceiro();

    const lancamentos =
      await buscarLancamentos();

    await exigirMasterFinanceiro();

    atualizarIndicadores(lancamentos);
    atualizarResumo(lancamentos);
    atualizarDetalhamento(lancamentos);

    mensagemFechamento.textContent =
      lancamentos.length === 0
        ? "Nenhum lançamento encontrado no período."
        : `${lancamentos.length} lançamento(s) encontrado(s).`;

  } catch (erro) {
    console.error(
      "Erro ao consultar fechamento:",
      erro
    );

    limparResultados();

    if (acessoMaster) {
      mensagemFechamento.textContent =
        "Não foi possível consultar o fechamento. Verifique o console.";
    }

  } finally {
    consultaEmAndamento = false;
    botaoConsultar.disabled = !acessoMaster;
  }
}

// ==========================================
// AUTENTICACAO E ACESSO MASTER
// ==========================================

async function iniciarFechamento() {
  bloquearFechamento();

  mensagemFechamento.textContent =
    "Verificando acesso financeiro...";

  try {
    if (!window.GestorBCASessao) {
      throw new Error(
        "Configuração de sessão não carregada."
      );
    }

    clienteSupabase =
      window.GestorBCASessao.criarCliente();

    // 1. Confirmar autenticacao Google.

    const { data, error } =
      await clienteSupabase.auth.getUser();

    if (error || !data?.user) {
      window.location.replace("./index.html");
      return;
    }

    // 2. Verificar se a sessao expirou.

    const ultimaAtividade =
      window.GestorBCASessao.obterUltimaAtividade();

    const agora = Date.now();

    if (
      ultimaAtividade === null ||
      ultimaAtividade > agora ||
      agora - ultimaAtividade >=
        window.GestorBCASessao.TEMPO_INATIVIDADE
    ) {
      await window.GestorBCASessao
        .encerrarPorInatividade(
          clienteSupabase
        );

      return;
    }

    // 3. Confirmar permissao Master.

    const {
      data: perfil,
      error: erroPerfil
    } = await clienteSupabase
      .from("perfis")
      .select("master, autorizado")
      .eq("id", data.user.id)
      .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    if (
      perfil?.master !== true ||
      perfil?.autorizado !== true
    ) {
      mensagemFechamento.textContent =
        "Acesso restrito ao administrador Master.";

      return;
    }

    acessoMaster = true;

    // 4. Selecionar o mes atual.

    filtroMes.value = mesAtual();

    // 5. Carregar responsaveis.

    await carregarResponsaveis();

    await exigirMasterFinanceiro();

    // 6. Iniciar monitoramento de inatividade.

    window.GestorBCASessao.iniciarMonitoramento(
      clienteSupabase
    );

    // 7. Exibir painel e consultar valores.

    painelFechamento.classList.remove("oculto");

    botaoConsultar.disabled = false;

    await consultarFechamento();

  } catch (erro) {
    console.error(
      "Erro ao iniciar fechamento:",
      erro
    );

    bloquearFechamento();

    mensagemFechamento.textContent =
      "Não foi possível verificar o acesso financeiro.";
  }
}

// ==========================================
// EVENTOS
// ==========================================

botaoConsultar.addEventListener(
  "click",
  consultarFechamento
);

// ==========================================
// INICIALIZACAO
// ==========================================

iniciarFechamento();
