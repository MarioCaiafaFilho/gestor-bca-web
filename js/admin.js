
"use strict";

// ==========================================
// GESTOR BCA - PAINEL ADMINISTRATIVO
// ==========================================

const SUPABASE_URL =
  "https://pdvipfzbtpsuenpumktb.supabase.co";

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

let clienteSupabase = null;
let acessoMaster = false;

// ==========================================
// ELEMENTOS DA PAGINA
// ==========================================

const mensagemAdmin =
  document.getElementById("mensagemAdmin");

const painelMaster =
  document.getElementById("painelMaster");

const formResponsavel =
  document.getElementById("formResponsavel");

const nomeResponsavel =
  document.getElementById("nomeResponsavel");

const salvarResponsavel =
  document.getElementById("salvarResponsavel");

const mensagemResponsavel =
  document.getElementById("mensagemResponsavel");

const listaResponsaveis =
  document.getElementById("listaResponsaveis");

const formTipo =
  document.getElementById("formTipo");

const nomeTipo =
  document.getElementById("nomeTipo");

const salvarTipo =
  document.getElementById("salvarTipo");

const mensagemTipo =
  document.getElementById("mensagemTipo");

const listaTipos =
  document.getElementById("listaTipos");

// ==========================================
// FUNCOES AUXILIARES
// ==========================================

function verificarMaster() {
  if (!acessoMaster || !clienteSupabase) {
    throw new Error(
      "Operação restrita ao administrador Master."
    );
  }
}

function criarBotao(texto, acao) {
  const botao = document.createElement("button");

  botao.type = "button";
  botao.textContent = texto;

  botao.addEventListener("click", acao);

  return botao;
}

function validarNome(nome) {
  return nome.length > 0 && nome.length <= 150;
}

// ==========================================
// LISTAR RESPONSAVEIS
// ==========================================

async function carregarResponsaveis() {
  verificarMaster();

  listaResponsaveis.textContent =
    "Carregando responsáveis...";

  const { data, error } = await clienteSupabase
    .from("bonavere_responsaveis")
    .select("id, nome, ativo")
    .order("nome", { ascending: true });

  if (error) {
    console.error(
      "Erro ao consultar responsáveis:",
      error
    );

    listaResponsaveis.textContent =
      "Não foi possível carregar os responsáveis.";

    throw error;
  }

  listaResponsaveis.replaceChildren();

  if (!data || data.length === 0) {
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

    nome.textContent = responsavel.nome;

    if (!responsavel.ativo) {
      nome.textContent += " (Inativo)";
    }

    const acoes = document.createElement("div");
    acoes.className = "acoes-responsavel";

    const botaoEditar = criarBotao(
      "Editar",
      () => editarResponsavel(responsavel)
    );

    const botaoSituacao = criarBotao(
      responsavel.ativo ? "Desativar" : "Reativar",
      () => alterarAtividadeResponsavel(responsavel)
    );

    acoes.appendChild(botaoEditar);
    acoes.appendChild(botaoSituacao);

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

    if (!acessoMaster) {
      mensagemResponsavel.textContent =
        "Você não possui autorização.";
      return;
    }

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
      const { data, error } = await clienteSupabase
        .from("bonavere_responsaveis")
        .insert({
          nome,
          ativo: true
        })
        .select("id");

      if (error) throw error;

      if (!data || data.length !== 1) {
        throw new Error(
          "Cadastro não confirmado pelo banco."
        );
      }

      nomeResponsavel.value = "";

      mensagemResponsavel.textContent =
        "Responsável cadastrado com sucesso!";

      await carregarResponsaveis();

    } catch (erro) {
      console.error(
        "Erro ao cadastrar responsável:",
        erro
      );

      mensagemResponsavel.textContent =
        "Não foi possível cadastrar o responsável.";
    } finally {
      salvarResponsavel.disabled = false;
      salvarResponsavel.textContent = "Cadastrar";
    }
  }
);

// ==========================================
// EDITAR NOME DO RESPONSAVEL
// ==========================================

async function editarResponsavel(responsavel) {
  if (!acessoMaster) return;

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

  mensagemResponsavel.textContent =
    "Salvando alteração...";

  try {
    const { data, error } = await clienteSupabase
      .from("bonavere_responsaveis")
      .update({ nome: novoNome })
      .eq("id", responsavel.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "Alteração não confirmada pelo banco."
      );
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
  if (!acessoMaster) return;

  const novoEstado = !responsavel.ativo;

  const acao = novoEstado
    ? "reativar"
    : "desativar";

  const confirmado = window.confirm(
    `Deseja ${acao} o responsável "${responsavel.nome}"?`
  );

  if (!confirmado) return;

  mensagemResponsavel.textContent =
    "Atualizando cadastro...";

  try {
    const { data, error } = await clienteSupabase
      .from("bonavere_responsaveis")
      .update({ ativo: novoEstado })
      .eq("id", responsavel.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "Alteração não confirmada pelo banco."
      );
    }

    await carregarResponsaveis();

    mensagemResponsavel.textContent =
      novoEstado
        ? "Responsável reativado com sucesso!"
        : "Responsável desativado com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao alterar situação do responsável:",
      erro
    );

    mensagemResponsavel.textContent =
      "Não foi possível atualizar o responsável.";
  }
}

// ==========================================
// LISTAR TIPOS DE ATIVIDADES
// ==========================================

async function carregarTipos() {
  verificarMaster();

  listaTipos.textContent =
    "Carregando tipos de atividades...";

  const { data, error } = await clienteSupabase
    .from("bonavere_tipos")
    .select("id, nome, ativo")
    .order("nome", { ascending: true });

  if (error) {
    console.error(
      "Erro ao consultar tipos:",
      error
    );

    listaTipos.textContent =
      "Não foi possível carregar os tipos.";

    throw error;
  }

  listaTipos.replaceChildren();

  if (!data || data.length === 0) {
    listaTipos.textContent =
      "Nenhum tipo de atividade cadastrado.";
    return;
  }

  for (const tipo of data) {
    const item = document.createElement("div");

    item.className = "item-responsavel";

    if (!tipo.ativo) {
      item.classList.add("inativo");
    }

    const nome = document.createElement("span");

    nome.textContent =
      tipo.nome + (tipo.ativo ? "" : " (Inativo)");

    item.appendChild(nome);
    listaTipos.appendChild(item);
  }
}

// ==========================================
// CADASTRAR TIPO DE ATIVIDADE
// ==========================================

formTipo.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    if (!acessoMaster) {
      mensagemTipo.textContent =
        "Você não possui autorização.";
      return;
    }

    const nome = nomeTipo.value.trim();

    if (!validarNome(nome)) {
      mensagemTipo.textContent =
        "Informe uma atividade com até 150 caracteres.";
      return;
    }

    salvarTipo.disabled = true;
    salvarTipo.textContent = "Salvando...";

    mensagemTipo.textContent = "";

    try {
      const { data, error } = await clienteSupabase
        .from("bonavere_tipos")
        .insert({
          nome,
          ativo: true
        })
        .select("id");

      if (error) throw error;

      if (!data || data.length !== 1) {
        throw new Error(
          "Cadastro não confirmado pelo banco."
        );
      }

      nomeTipo.value = "";

      mensagemTipo.textContent =
        "Tipo de atividade cadastrado com sucesso!";

      await carregarTipos();

    } catch (erro) {
      console.error(
        "Erro ao cadastrar tipo:",
        erro
      );

      mensagemTipo.textContent =
        "Não foi possível cadastrar a atividade.";
    } finally {
      salvarTipo.disabled = false;
      salvarTipo.textContent = "Cadastrar";
    }
  }
);

// ==========================================
// VERIFICAR ACESSO MASTER
// ==========================================

async function iniciarAdministracao() {
  painelMaster.classList.add("oculto");

  salvarResponsavel.disabled = true;
  salvarTipo.disabled = true;

  acessoMaster = false;

  try {
    if (
      SUPABASE_PUBLIC_KEY ===
      "COLE_AQUI_SUA_CHAVE_PUBLISHABLE"
    ) {
      throw new Error(
        "Chave pública não configurada."
      );
    }

    if (!window.supabase) {
      throw new Error(
        "Biblioteca Supabase indisponível."
      );
    }

    clienteSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );

    const { data, error } =
      await clienteSupabase.auth.getUser();

    if (error || !data.user) {
      window.location.replace("./index.html");
      return;
    }

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
      !perfil ||
      perfil.master !== true ||
      perfil.autorizado !== true
    ) {
      mensagemAdmin.textContent =
        "Acesso restrito ao administrador Master.";
      return;
    }

    acessoMaster = true;

    painelMaster.classList.remove("oculto");
    mensagemAdmin.textContent = "";

    salvarResponsavel.disabled = false;
    salvarTipo.disabled = false;

    await Promise.all([
      carregarResponsaveis(),
      carregarTipos()
    ]);

  } catch (erro) {
    console.error(
      "Erro no painel administrativo:",
      erro
    );

    acessoMaster = false;
    painelMaster.classList.add("oculto");

    salvarResponsavel.disabled = true;
    salvarTipo.disabled = true;

    mensagemAdmin.textContent =
      "Não foi possível verificar o acesso administrativo.";
  }
}

iniciarAdministracao();
