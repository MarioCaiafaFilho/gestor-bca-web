
"use strict";

// GESTOR BCA - PAINEL ADMINISTRATIVO
// Requer js/sessao.js carregado antes deste arquivo.

let clienteSupabase = null;
let acessoMaster = false;

const mensagemAdmin = document.getElementById("mensagemAdmin");
const painelMaster = document.getElementById("painelMaster");
const formResponsavel = document.getElementById("formResponsavel");
const nomeResponsavel = document.getElementById("nomeResponsavel");
const salvarResponsavel = document.getElementById("salvarResponsavel");
const mensagemResponsavel = document.getElementById("mensagemResponsavel");
const listaResponsaveis = document.getElementById("listaResponsaveis");
const formTipo = document.getElementById("formTipo");
const nomeTipo = document.getElementById("nomeTipo");
const valorTipo = document.getElementById("valorTipo");
const salvarTipo = document.getElementById("salvarTipo");
const mensagemTipo = document.getElementById("mensagemTipo");
const listaTipos = document.getElementById("listaTipos");

// ==========================================
// PROTECAO DO PAINEL
// ==========================================

function bloquearPainel() {
  acessoMaster = false;
  painelMaster.classList.add("oculto");
  salvarResponsavel.disabled = true;
  salvarTipo.disabled = true;
  listaResponsaveis.replaceChildren();
  listaTipos.replaceChildren();
}

// A verificacao no navegador complementa as
// politicas RLS do Supabase.
// A seguranca nao depende apenas deste codigo.

async function exigirMaster() {
  if (!acessoMaster || !clienteSupabase || !window.GestorBCASessao) {
    throw new Error("Acesso restrito ao administrador Master.");
  }

  const ultima = window.GestorBCASessao.obterUltimaAtividade();
  const agora = Date.now();

  if (
    ultima === null ||
    ultima > agora ||
    agora - ultima >= window.GestorBCASessao.TEMPO_INATIVIDADE
  ) {
    bloquearPainel();

    await window.GestorBCASessao.encerrarPorInatividade(
      clienteSupabase
    );

    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const { data, error } =
    await clienteSupabase.auth.getUser();

  if (error || !data?.user) {
    bloquearPainel();
    window.location.replace("./index.html");
    throw new Error("Autenticação não encontrada.");
  }
}

// ==========================================
// FUNCOES AUXILIARES
// ==========================================

function validarNome(nome) {
  return nome.length > 0 && nome.length <= 150;
}

function validarValor(valorTexto) {
  const valor = Number(
    valorTexto.trim().replace(",", ".")
  );

  if (
    valorTexto.trim() === "" ||
    !Number.isFinite(valor) ||
    valor < 0 ||
    valor > 9999999999.99 ||
    Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001
  ) {
    throw new Error(
      "Informe um valor válido com até duas casas decimais."
    );
  }

  return valor;
}

function criarBotao(texto, acao) {
  const botao = document.createElement("button");

  botao.type = "button";
  botao.textContent = texto;

  botao.addEventListener("click", acao);

  return botao;
}

// ==========================================
// LISTAR RESPONSAVEIS
// ==========================================

async function carregarResponsaveis() {
  await exigirMaster();

  listaResponsaveis.textContent =
    "Carregando responsáveis...";

  const { data, error } = await clienteSupabase
    .from("bonavere_responsaveis")
    .select("id, nome, ativo")
    .order("nome", { ascending: true });

  if (error) throw error;

  await exigirMaster();

  listaResponsaveis.replaceChildren();

  if (!data?.length) {
    listaResponsaveis.textContent =
      "Nenhum responsável cadastrado.";
    return;
  }

  for (const responsavel of data) {
    const item = document.createElement("div");
    item.className = "item-responsavel";

    if (!responsavel.ativo) {
      item.classList.add("inativo");
    }

    const nome = document.createElement("span");

    nome.textContent =
      responsavel.nome +
      (responsavel.ativo ? "" : " (Inativo)");

    const acoes = document.createElement("div");
    acoes.className = "acoes-responsavel";

    acoes.appendChild(
      criarBotao(
        "Editar",
        () => editarResponsavel(responsavel)
      )
    );

    acoes.appendChild(
      criarBotao(
        responsavel.ativo ? "Desativar" : "Reativar",
        () => alterarAtividadeResponsavel(responsavel)
      )
    );

    item.appendChild(nome);
    item.appendChild(acoes);

    listaResponsaveis.appendChild(item);
  }
}

// ==========================================
// CADASTRAR RESPONSAVEL
// ==========================================

formResponsavel.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    const nome = nomeResponsavel.value.trim();

    if (!validarNome(nome)) {
      mensagemResponsavel.textContent =
        "Informe um nome com até 150 caracteres.";
      return;
    }

    salvarResponsavel.disabled = true;
    salvarResponsavel.textContent = "Salvando...";
    mensagemResponsavel.textContent = "";

    try {
      await exigirMaster();

      const { data, error } = await clienteSupabase
        .from("bonavere_responsaveis")
        .insert({
          nome,
          ativo: true
        })
        .select("id");

      if (error) throw error;

      if (data?.length !== 1) {
        throw new Error("Cadastro não confirmado.");
      }

      nomeResponsavel.value = "";

      await carregarResponsaveis();

      mensagemResponsavel.textContent =
        "Responsável cadastrado com sucesso!";

    } catch (erro) {
      console.error(
        "Erro ao cadastrar responsável:",
        erro
      );

      mensagemResponsavel.textContent =
        "Não foi possível cadastrar o responsável.";

    } finally {
      salvarResponsavel.disabled = !acessoMaster;
      salvarResponsavel.textContent = "Cadastrar";
    }
  }
);

// ==========================================
// EDITAR RESPONSAVEL
// ==========================================

async function editarResponsavel(responsavel) {
  try {
    await exigirMaster();

    const resposta = window.prompt(
      "Digite o novo nome do responsável:",
      responsavel.nome
    );

    if (resposta === null) return;

    const novoNome = resposta.trim();

    if (!validarNome(novoNome)) {
      alert("Informe um nome com até 150 caracteres.");
      return;
    }

    if (novoNome === responsavel.nome) return;

    await exigirMaster();

    mensagemResponsavel.textContent =
      "Salvando alteração...";

    const { data, error } = await clienteSupabase
      .from("bonavere_responsaveis")
      .update({ nome: novoNome })
      .eq("id", responsavel.id)
      .select("id");

    if (error) throw error;

    if (data?.length !== 1) {
      throw new Error("Alteração não confirmada.");
    }

    await carregarResponsaveis();

    mensagemResponsavel.textContent =
      "Nome atualizado com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao editar responsável:",
      erro
    );

    mensagemResponsavel.textContent =
      "Não foi possível alterar o nome.";
  }
}

// ==========================================
// DESATIVAR OU REATIVAR RESPONSAVEL
// ==========================================

async function alterarAtividadeResponsavel(responsavel) {
  try {
    await exigirMaster();

    const novoEstado = !responsavel.ativo;
    const acao = novoEstado ? "reativar" : "desativar";

    const confirmado = window.confirm(
      `Deseja ${acao} o responsável "${responsavel.nome}"?`
    );

    if (!confirmado) return;

    await exigirMaster();

    mensagemResponsavel.textContent =
      "Atualizando cadastro...";

    const { data, error } = await clienteSupabase
      .from("bonavere_responsaveis")
      .update({ ativo: novoEstado })
      .eq("id", responsavel.id)
      .select("id");

    if (error) throw error;

    if (data?.length !== 1) {
      throw new Error("Alteração não confirmada.");
    }

    await carregarResponsaveis();

    mensagemResponsavel.textContent = novoEstado
      ? "Responsável reativado com sucesso!"
      : "Responsável desativado com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao alterar responsável:",
      erro
    );

    mensagemResponsavel.textContent =
      "Não foi possível atualizar o responsável.";
  }
}

// ==========================================
// LISTAR TIPOS DE ATIVIDADES E VALORES
// ==========================================

async function carregarTipos() {
  await exigirMaster();

  listaTipos.textContent =
    "Carregando tipos de atividades...";

  const { data: tipos, error: erroTipos } =
    await clienteSupabase
      .from("bonavere_tipos")
      .select("id, nome, ativo")
      .order("nome", { ascending: true });

  if (erroTipos) throw erroTipos;

  const { data: precos, error: erroPrecos } =
    await clienteSupabase
      .from("bonavere_precos")
      .select("tipo_id, valor_atual");

  if (erroPrecos) throw erroPrecos;

  await exigirMaster();

  const mapaPrecos = new Map(
    (precos || []).map(
      preco => [
        preco.tipo_id,
        Number(preco.valor_atual)
      ]
    )
  );

  listaTipos.replaceChildren();

  if (!tipos?.length) {
    listaTipos.textContent =
      "Nenhum tipo de atividade cadastrado.";
    return;
  }

  for (const tipo of tipos) {
    const item = document.createElement("div");
    item.className = "item-responsavel";

    if (!tipo.ativo) {
      item.classList.add("inativo");
    }

    const informacoes = document.createElement("div");

    const nome = document.createElement("div");
    nome.textContent =
      tipo.nome + (tipo.ativo ? "" : " (Inativo)");

    const valorAtual = mapaPrecos.get(tipo.id);

    const textoValor = document.createElement("small");

    textoValor.textContent = valorAtual === undefined
      ? "Valor ainda não definido"
      : "Valor: " + valorAtual.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        });

    informacoes.appendChild(nome);
    informacoes.appendChild(textoValor);

    const acoes = document.createElement("div");
    acoes.className = "acoes-responsavel";

    acoes.appendChild(
      criarBotao(
        "Editar",
        () => editarTipo(tipo, valorAtual)
      )
    );

    acoes.appendChild(
      criarBotao(
        tipo.ativo ? "Desativar" : "Reativar",
        () => alterarAtividadeTipo(tipo)
      )
    );

    item.appendChild(informacoes);
    item.appendChild(acoes);

    listaTipos.appendChild(item);
  }
}

// ==========================================
// EDITAR NOME E VALOR DA ATIVIDADE
// ==========================================

async function editarTipo(tipo, valorAtual) {
  try {
    await exigirMaster();

    const respostaNome = window.prompt(
      "Nome da atividade:",
      tipo.nome
    );

    if (respostaNome === null) return;

    const novoNome = respostaNome.trim();

    if (!validarNome(novoNome)) {
      alert("Informe um nome com até 150 caracteres.");
      return;
    }

    const valorAnterior = valorAtual === undefined
      ? ""
      : valorAtual.toFixed(2).replace(".", ",");

    const respostaValor = window.prompt(
      "Valor da atividade (R$):",
      valorAnterior
    );

    if (respostaValor === null) return;

    const novoValor = validarValor(respostaValor);

    if (
      novoNome === tipo.nome &&
      novoValor === valorAtual
    ) {
      return;
    }

    await exigirMaster();

    mensagemTipo.textContent =
      "Salvando alterações...";

    const { error } = await clienteSupabase
      .rpc("bonavere_editar_tipo_com_valor", {
        p_tipo_id: tipo.id,
        p_nome: novoNome,
        p_valor: novoValor
      });

    if (error) throw error;

    await carregarTipos();

    mensagemTipo.textContent =
      "Nome e valor atualizados com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao editar atividade:",
      erro
    );

    mensagemTipo.textContent =
      erro?.message ||
      "Não foi possível atualizar a atividade.";
  }
}

// ==========================================
// DESATIVAR OU REATIVAR TIPO
// ==========================================

async function alterarAtividadeTipo(tipo) {
  try {
    await exigirMaster();

    const novoEstado = !tipo.ativo;
    const acao = novoEstado ? "reativar" : "desativar";

    const confirmado = window.confirm(
      `Deseja ${acao} a atividade "${tipo.nome}"?`
    );

    if (!confirmado) return;

    await exigirMaster();

    mensagemTipo.textContent =
      "Atualizando situação da atividade...";

    const { data, error } = await clienteSupabase
      .from("bonavere_tipos")
      .update({ ativo: novoEstado })
      .eq("id", tipo.id)
      .select("id");

    if (error) throw error;

    if (data?.length !== 1) {
      throw new Error("Alteração não confirmada.");
    }

    await carregarTipos();

    mensagemTipo.textContent = novoEstado
      ? "Atividade reativada com sucesso!"
      : "Atividade desativada com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao alterar situação da atividade:",
      erro
    );

    mensagemTipo.textContent =
      "Não foi possível alterar a situação da atividade.";
  }
}

// ==========================================
// CADASTRAR TIPO DE ATIVIDADE COM VALOR
// ==========================================

formTipo.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    const nome = nomeTipo.value.trim();
    let valor;

    try {
      if (!validarNome(nome)) {
        throw new Error(
          "Informe uma atividade com até 150 caracteres."
        );
      }

      valor = validarValor(valorTipo.value);

    } catch (erro) {
      mensagemTipo.textContent = erro.message;
      return;
    }

    salvarTipo.disabled = true;
    salvarTipo.textContent = "Salvando...";
    mensagemTipo.textContent = "";

    try {
      await exigirMaster();

      const { data, error } = await clienteSupabase
        .rpc("bonavere_cadastrar_tipo_com_valor", {
          p_nome: nome,
          p_valor: valor
        });

      if (error) throw error;

      if (!data) {
        throw new Error(
          "Cadastro não confirmado pelo banco."
        );
      }

      nomeTipo.value = "";
      valorTipo.value = "";

      await carregarTipos();

      mensagemTipo.textContent =
        "Atividade e valor cadastrados com sucesso!";

    } catch (erro) {
      console.error(
        "Erro ao cadastrar atividade com valor:",
        erro
      );

      mensagemTipo.textContent =
        "Não foi possível cadastrar a atividade. Verifique os dados ou o console.";

    } finally {
      salvarTipo.disabled = !acessoMaster;
      salvarTipo.textContent = "Cadastrar";
    }
  }
);

// ==========================================
// AUTENTICACAO E INICIALIZACAO
// ==========================================

async function iniciarAdministracao() {
  bloquearPainel();

  mensagemAdmin.textContent =
    "Verificando acesso administrativo...";

  try {
    if (!window.GestorBCASessao) {
      throw new Error(
        "Configuração de sessão não carregada."
      );
    }

    clienteSupabase =
      window.GestorBCASessao.criarCliente();

    // 1. Confirmar o usuario autenticado.

    const { data, error } =
      await clienteSupabase.auth.getUser();

    if (error || !data?.user) {
      window.location.replace("./index.html");
      return;
    }

    // 2. Conferir a validade da sessao.

    const ultima =
      window.GestorBCASessao.obterUltimaAtividade();

    const agora = Date.now();

    if (
      ultima === null ||
      ultima > agora ||
      agora - ultima >=
        window.GestorBCASessao.TEMPO_INATIVIDADE
    ) {
      await window.GestorBCASessao
        .encerrarPorInatividade(clienteSupabase);

      return;
    }

    // 3. Verificar autorizacao Master.

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
      mensagemAdmin.textContent =
        "Acesso restrito ao administrador Master.";

      return;
    }

    acessoMaster = true;

    await exigirMaster();

    // 4. Carregar os cadastros, mantendo
    // o painel oculto ate terminar.

    await Promise.all([
      carregarResponsaveis(),
      carregarTipos()
    ]);

    await exigirMaster();

    // 5. Liberar o painel.

    painelMaster.classList.remove("oculto");

    salvarResponsavel.disabled = false;
    salvarTipo.disabled = false;

    mensagemAdmin.textContent = "";

    // 6. Iniciar o monitoramento.

    window.GestorBCASessao.iniciarMonitoramento(
      clienteSupabase
    );

  } catch (erro) {
    console.error(
      "Erro no painel administrativo:",
      erro
    );

    bloquearPainel();

    mensagemAdmin.textContent =
      "Não foi possível verificar o acesso administrativo.";
  }
}

// ==========================================
// INICIALIZAR
// ==========================================

iniciarAdministracao();
