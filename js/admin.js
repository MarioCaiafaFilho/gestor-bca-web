
"use strict";

// GESTOR BCA - PAINEL ADMINISTRATIVO

const SUPABASE_URL =
  "https://pdvipfzbtpsuenpumktb.supabase.co";

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

const mensagemAdmin =
  document.getElementById("mensagemAdmin");

const painelMaster =
  document.getElementById("painelMaster");

async function iniciarAdministracao() {
  painelMaster.classList.add("oculto");

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

    const cliente = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );

    const { data, error } =
      await cliente.auth.getUser();

    if (error || !data.user) {
      window.location.replace("./index.html");
      return;
    }

    const {
      data: perfil,
      error: erroPerfil
    } = await cliente
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

    painelMaster.classList.remove("oculto");
    mensagemAdmin.textContent = "";

  } catch (erro) {
    console.error(
      "Erro na administração:",
      erro
    );

    mensagemAdmin.textContent =
      "Não foi possível verificar o acesso administrativo.";
  }
}

iniciarAdministracao();
