
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

    if (!nome) {
      mensagemResponsavel.textContent =
        "Informe o nome do responsável.";
      return;
    }

    if (nome.length > 150) {
      mensagemResponsavel.textContent =
        "O nome não pode ultrapassar 150 caracteres.";
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
        "Não foi possível realizar o cadastro. " +
        "Verifique o Console.";
    } finally {
      salvarResponsavel.disabled = false;
      salvarResponsavel.textContent = "Cadastrar";
    }
  }
);

// ==========================================
// VERIFICAR ACESSO MASTER
// ==========================================

async function iniciarAdministracao() {
  painelMaster.classList.add("oculto");
  salvarResponsavel.disabled = true;
  acessoMaster = false;

  try {
    if (
      SUPABASE_PUBLIC_KEY ===
      "COLE_AQUI_SUA_CHAVE_PUBLISHABLE"
    ) {
      throw new Error("Chave pública não configurada.");
    }

    if (!window.supabase) {
      throw new Error("Biblioteca Supabase indisponível.");
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

    await carregarResponsaveis();

  } catch (erro) {
    console.error(
      "Erro na administração:",
      erro
    );

    acessoMaster = false;
    painelMaster.classList.add("oculto");

    mensagemAdmin.textContent =
      "Não foi possível verificar o acesso administrativo.";
  }
}

iniciarAdministracao();
