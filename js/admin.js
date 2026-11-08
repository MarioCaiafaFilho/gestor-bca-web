
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

// Responsaveis
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

// Tipos de atividades
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
// LISTAR RESPONSAVEIS
// ==========================================

async function carregarResponsaveis() {
  if (!acessoMaster) return;

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

    return;
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

    item.appendChild(nome);
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

    if (!acessoMaster || !clienteSupabase) {
      mensagemResponsavel.textContent =
        "Você não possui autorização para cadastrar.";
      return;
    }

    const nome = nomeResponsavel.value.trim();

    if (!nome || nome.length > 150) {
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
          nome: nome,
          ativo: true
        })
        .select("id");

      if (error) throw error;

      if (!data || data.length !== 1) {
        throw new Error(
          "O banco não confirmou o cadastro."
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
        "Não foi possível realizar o cadastro.";
    } finally {
      salvarResponsavel.disabled = false;
      salvarResponsavel.textContent = "Cadastrar";
    }
  }
);

// ==========================================
// LISTAR TIPOS DE ATIVIDADES
// ==========================================

async function carregarTipos() {
  if (!acessoMaster) return;

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

    return;
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

    nome.textContent = tipo.nome;

    if (!tipo.ativo) {
      nome.textContent += " (Inativo)";
    }

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

    if (!acessoMaster || !clienteSupabase) {
      mensagemTipo.textContent =
        "Você não possui autorização para cadastrar.";
      return;
    }

    const nome = nomeTipo.value.trim();

    if (!nome || nome.length > 150) {
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
          nome: nome,
          ativo: true
        })
        .select("id");

      if (error) throw error;

      if (!data || data.length !== 1) {
        throw new Error(
          "O banco não confirmou o cadastro."
        );
      }

      nomeTipo.value = "";

      mensagemTipo.textContent =
        "Tipo de atividade cadastrado com sucesso!";

      await carregarTipos();

    } catch (erro) {
      console.error(
        "Erro ao cadastrar tipo de atividade:",
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
