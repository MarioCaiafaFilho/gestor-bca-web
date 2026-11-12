
"use strict";

// ==========================================
// GESTOR BCA - MENU PRINCIPAL
// ==========================================

// ELEMENTOS DA PAGINA

const mensagem =
  document.getElementById("mensagemMenu");

const moduloBonavere =
  document.getElementById("moduloBonavere");

const moduloAdmin =
  document.getElementById("moduloAdmin");

const botaoSair =
  document.getElementById("sair");

let supabaseMenu = null;

// ==========================================
// INICIAR MENU
// ==========================================

async function iniciarMenu() {

  // Os modulos permanecem ocultos
  // ate a verificacao das permissoes.

  moduloBonavere.classList.add("oculto");
  moduloAdmin.classList.add("oculto");

  botaoSair.disabled = true;

  try {

    // Verificar configuracao compartilhada.

    if (!window.GestorBCASessao) {
      throw new Error(
        "Configuração de sessão indisponível."
      );
    }

    supabaseMenu =
      window.GestorBCASessao.criarCliente();

    // Confirmar usuario autenticado.

    const { data, error } =
      await supabaseMenu.auth.getUser();

    if (error || !data?.user) {
      window.location.replace("./index.html");
      return;
    }

    // ======================================
    // VERIFICAR EXPIRACAO DA SESSAO
    // ======================================

    const ultimaAtividade =
      window.GestorBCASessao.obterUltimaAtividade();

    const agora = Date.now();

    if (
      ultimaAtividade === null ||
      ultimaAtividade > agora ||
      agora - ultimaAtividade >=
        window.GestorBCASessao.TEMPO_INATIVIDADE
    ) {
      // Sessao antiga ou expirada.
      // Impede o acesso aos modulos.
      moduloBonavere.classList.add("oculto");
      moduloAdmin.classList.add("oculto");

      mensagem.textContent =
        "Sessão expirada. Faça login novamente.";

      try {
        await supabaseMenu.auth.signOut();
      } catch (erroSaida) {
        console.error(
          "Erro ao encerrar sessão expirada:",
          erroSaida
        );
      }

      window.location.replace("./index.html");
      return;
    }


    // Consultar perfil.

    const {
      data: perfil,
      error: erroPerfil
    } = await supabaseMenu
      .from("perfis")
      .select("id, master, autorizado")
      .eq("id", data.user.id)
      .maybeSingle();

    if (erroPerfil) {
      throw erroPerfil;
    }

    if (!perfil || perfil.autorizado !== true) {
      mensagem.textContent =
        "Sua conta não está autorizada a acessar os módulos.";

      return;
    }

    // Acesso Master ao painel administrativo.

    const acessoMaster =
      perfil.master === true;

    if (acessoMaster) {
      moduloAdmin.classList.remove("oculto");
    }

    // Verificar acesso ao Bonavere.

    let acessoBonavere = acessoMaster;

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

      if (erroPermissao) {
        throw erroPermissao;
      }

      acessoBonavere =
        permissao?.nivel === "ver" ||
        permissao?.nivel === "editar";
    }

    if (acessoBonavere) {
      moduloBonavere.classList.remove("oculto");
    }

    if (acessoBonavere || acessoMaster) {
      mensagem.textContent = "";
    } else {
      mensagem.textContent =
        "Nenhum módulo disponível para sua conta.";
    }

    botaoSair.disabled = false;

    // Inicia o controle de inatividade
    // somente apos autorizar o acesso.

    window.GestorBCASessao.iniciarMonitoramento(
      supabaseMenu
    );


  } catch (erro) {

    console.error(
      "Erro ao iniciar o Menu Principal:",
      erro
    );

    mensagem.textContent =
      "Não foi possível verificar o acesso. " +
      "Atualize a página ou contate o administrador.";
  }
}

// ==========================================
// ENCERRAR SESSAO
// ==========================================

botaoSair.addEventListener(
  "click",
  async () => {

    if (!supabaseMenu) {
      return;
    }

    botaoSair.disabled = true;

    try {

      const { error } =
        await supabaseMenu.auth.signOut();

      if (error) {
        throw error;
      }

      window.location.replace("./index.html");

    } catch (erro) {

      console.error(
        "Erro ao encerrar sessão:",
        erro
      );

      mensagem.textContent =
        "Não foi possível encerrar a sessão.";

      botaoSair.disabled = false;
    }
  }
);

// ==========================================
// INICIALIZAR
// ==========================================

iniciarMenu();
