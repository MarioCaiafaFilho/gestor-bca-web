
"use strict";

// GESTOR BCA - MENU PRINCIPAL

const SUPABASE_URL =
  "https://pdvipfzbtpsuenpumktb.supabase.co";

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

const mensagem =
  document.getElementById("mensagemMenu");

const moduloBonavere =
  document.getElementById("moduloBonavere");

const botaoSair =
  document.getElementById("sair");

  const moduloAdmin =
  document.getElementById("moduloAdmin");

let supabaseMenu = null;

async function iniciarMenu() {
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

    supabaseMenu = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );

    const { data, error } =
      await supabaseMenu.auth.getUser();

    if (error || !data.user) {
      window.location.replace("./index.html");
      return;
    }

    botaoSair.disabled = false;

    const { data: perfil, error: erroPerfil } =
      await supabaseMenu
        .from("perfis")
        .select("id, master, autorizado")
        .eq("id", data.user.id)
        .maybeSingle();

    if (erroPerfil) throw erroPerfil;
if (perfil?.master === true && perfil.autorizado === true) {
  moduloAdmin.classList.remove("oculto");
}
    if (!perfil || !perfil.autorizado) {
      mensagem.textContent =
        "Sua conta não está autorizada a acessar os módulos.";
      return;
    }

    let acessoBonavere = perfil.master === true;

    if (!acessoBonavere) {
      const {
        data: permissao,
        error: erroPermissao
      } = await supabaseMenu
        .from("permissoes")
        .select("nivel")
        .eq("user_id", data.user.id)
        .eq("modulo", "bonavere")
        .maybeSingle();

      if (erroPermissao) throw erroPermissao;

      acessoBonavere =
        permissao?.nivel === "ver" ||
        permissao?.nivel === "editar";
    }

    if (acessoBonavere) {
      moduloBonavere.classList.remove("oculto");
      mensagem.textContent = "";
    } else {
      mensagem.textContent =
        "Nenhum módulo disponível para sua conta.";
    }

  } catch (erro) {
    console.error("Erro no menu:", erro);
    mensagem.textContent =
      "Não foi possível verificar as permissões. " +
      "Atualize a página ou contate o administrador.";
  }
}

botaoSair.addEventListener("click", async () => {
  if (!supabaseMenu) return;

  botaoSair.disabled = true;

  const { error } = await supabaseMenu.auth.signOut();

  if (error) {
    console.error("Erro ao sair:", error);
    mensagem.textContent =
      "Não foi possível encerrar a sessão.";
    botaoSair.disabled = false;
    return;
  }

  window.location.replace("./index.html");
});

iniciarMenu();
