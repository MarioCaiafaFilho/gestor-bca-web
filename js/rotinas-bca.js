
"use strict";

// ==========================================
// GESTOR BCA - ROTINAS CONTABEIS
// ETAPA 74.4.6
// ==========================================

(() => {
  const mes = document.getElementById("mesRotinasBCA");
  const ano = document.getElementById("anoRotinasBCA");
  const pesquisa = document.getElementById("pesquisarRotinasBCA");

  const lista = document.getElementById("listaClientesRotinasBCA");
  const mensagem = document.getElementById("mensagemRotinasBCA");

  const indicadorClientes =
    document.getElementById("totalClientesFixosBCA");

  const indicadorPendentes =
    document.getElementById("totalRotinasPendentesBCA");

  const indicadorConcluidas =
    document.getElementById("totalRotinasConcluidasBCA");

  if (
    !mes || !ano || !pesquisa || !lista || !mensagem ||
    !indicadorClientes || !indicadorPendentes ||
    !indicadorConcluidas
  ) {
    return;
  }

  let supabaseRotinas = null;
  let clientesFixos = [];
  let acessoLiberado = false;

  // ==========================================
  // FUNCOES AUXILIARES
  // ==========================================

  function normalizarTexto(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim()
      .replace(/\s+/g, " ");
  }

  function configurarCompetencia() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();

    mes.value = String(
      hoje.getMonth() + 1
    ).padStart(2, "0");

    ano.replaceChildren();

    for (
      let anoOpcao = anoAtual - 3;
      anoOpcao <= anoAtual + 2;
      anoOpcao++
    ) {
      const opcao = document.createElement("option");

      opcao.value = String(anoOpcao);
      opcao.textContent = String(anoOpcao);

      ano.appendChild(opcao);
    }

    ano.value = String(anoAtual);
  }

  function obterCompetencia() {
    return `${ano.value}-${mes.value}-01`;
  }

  // ==========================================
  // INDICADORES
  // ==========================================

  function atualizarIndicadores() {
    indicadorClientes.textContent =
      clientesFixos.length;

    // Estes indicadores serao calculados
    // quando implementarmos as execucoes.
    indicadorPendentes.textContent = "0";
    indicadorConcluidas.textContent = "0";
  }

  // ==========================================
  // APRESENTAR CLIENTES FIXOS
  // ==========================================

  function criarCelula(linha, texto) {
    const celula = document.createElement("td");

    celula.textContent = texto;

    linha.appendChild(celula);

    return celula;
  }

  function criarLinhaCliente(cliente) {
    const linha = document.createElement("tr");

    criarCelula(linha, cliente.nome);

    // Ainda nao existem atividades vinculadas.
    const celulaProgresso =
      document.createElement("td");

    const progresso = document.createElement("div");
    progresso.className = "progresso-rotinas-bca";

    const barra = document.createElement("div");
    barra.className = "barra-progresso-rotinas-bca";

    const preenchimento = document.createElement("span");
    preenchimento.style.width = "0%";

    barra.appendChild(preenchimento);

    const quantidade = document.createElement("small");
    quantidade.textContent = "0 de 0 atividades";

    progresso.appendChild(barra);
    progresso.appendChild(quantidade);

    celulaProgresso.appendChild(progresso);
    linha.appendChild(celulaProgresso);

    const celulaSituacao =
      document.createElement("td");

    const situacao = document.createElement("span");
    situacao.className =
      "situacao-rotinas-bca sem_rotinas";

    situacao.textContent = "Sem rotinas";

    celulaSituacao.appendChild(situacao);
    linha.appendChild(celulaSituacao);

    const celulaAcoes = document.createElement("td");

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao-abrir-rotinas-bca";
    botao.textContent = "Abrir";
    botao.disabled = true;

    // A abertura das atividades sera implementada
    // na proxima fase.

    celulaAcoes.appendChild(botao);
    linha.appendChild(celulaAcoes);

    return linha;
  }

  function renderizarClientes() {
    lista.replaceChildren();

    const termo = normalizarTexto(pesquisa.value);

    const encontrados = clientesFixos.filter(
      cliente =>
        normalizarTexto(cliente.nome).includes(termo)
    );

    for (const cliente of encontrados) {
      lista.appendChild(criarLinhaCliente(cliente));
    }

    if (clientesFixos.length === 0) {
      mensagem.textContent =
        "Nenhum cliente fixo ativo cadastrado. " +
        "Marque a opção Cliente fixo na aba Clientes.";
    } else {
      mensagem.textContent =
        `${encontrados.length} cliente(s) encontrado(s).`;
    }

    atualizarIndicadores();
  }

  // ==========================================
  // CONSULTAR CLIENTES NO SUPABASE
  // ==========================================

  async function carregarClientesFixos() {
    mensagem.textContent = "Carregando clientes fixos...";

    const { data, error } = await supabaseRotinas
      .from("bca_clientes")
      .select("id, nome, cliente_fixo, ativo")
      .eq("cliente_fixo", true)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(1000);

    if (error) throw error;

    clientesFixos = data || [];

    renderizarClientes();
  }

  // ==========================================
  // VALIDAR ACESSO
  // ==========================================

  async function verificarAcessoRotinas() {
    const sessao = window.GestorBCASessao;

    if (!sessao || !supabaseRotinas) {
      throw new Error("Controle de sessão indisponível.");
    }

    const ultima = sessao.obterUltimaAtividade();
    const agora = Date.now();

    if (
      ultima === null ||
      ultima > agora ||
      agora - ultima >= sessao.TEMPO_INATIVIDADE
    ) {
      await sessao.encerrarPorInatividade(
        supabaseRotinas
      );

      throw new Error("Sessão expirada.");
    }

    const { data, error } =
      await supabaseRotinas.auth.getUser();

    if (error || !data?.user) {
      throw new Error("Usuário não autenticado.");
    }

    const { data: perfil, error: erroPerfil } =
      await supabaseRotinas
        .from("perfis")
        .select("autorizado")
        .eq("id", data.user.id)
        .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    if (perfil?.autorizado !== true) {
      throw new Error("Usuário não autorizado.");
    }
  }

  // ==========================================
  // FILTROS
  // ==========================================

  pesquisa.addEventListener(
    "input",
    renderizarClientes
  );

  mes.addEventListener("change", () => {
    if (acessoLiberado) renderizarClientes();
  });

  ano.addEventListener("change", () => {
    if (acessoLiberado) renderizarClientes();
  });

  // Atualizar quando a aba Rotinas for aberta.
  const abaRotinas = document.querySelector(
    '.aba-bca[data-aba="rotinas"]'
  );

  if (abaRotinas) {
    abaRotinas.addEventListener("click", async () => {
      if (!acessoLiberado) return;

      try {
        await verificarAcessoRotinas();
        await carregarClientesFixos();
      } catch (erro) {
        console.error(
          "Erro ao atualizar clientes fixos:",
          erro
        );

        mensagem.textContent =
          "Não foi possível atualizar as rotinas.";
      }
    });
  }

  // ==========================================
  // INICIALIZACAO
  // ==========================================

  async function iniciarRotinas() {
    try {
      if (!window.GestorBCASessao) {
        throw new Error("Sessão indisponível.");
      }

      supabaseRotinas =
        window.GestorBCASessao.criarCliente();

      await verificarAcessoRotinas();

      configurarCompetencia();

      await carregarClientesFixos();

      acessoLiberado = true;

      mes.disabled = false;
      ano.disabled = false;
      pesquisa.disabled = false;

    } catch (erro) {
      console.error(
        "Erro ao iniciar Rotinas BCA:",
        erro
      );

      mensagem.textContent =
        "Não foi possível carregar as rotinas.";
    }
  }

  iniciarRotinas();
})();
