
"use strict";

// ==========================================
// GESTOR BCA - LOGIN COM GOOGLE
// ==========================================

const SITE_URL =
  "https://mariocaiafafilho.github.io/gestor-bca-web/";

const botaoEntrar =
  document.getElementById("botaoEntrar");

const botaoSair =
  document.getElementById("botaoSair");

const mensagem =
  document.getElementById("mensagem");

let clienteLogin = null;

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

function mostrarDesconectado() {
  botaoEntrar.classList.remove("oculto");
  botaoSair.classList.add("oculto");
  botaoEntrar.disabled = false;

  mostrarMensagem(
    "Utilize uma conta Google autorizada " +
    "para acessar o sistema."
  );
}

function mostrarAutenticado() {
  window.location.replace("./menu.html");
}

a
async function iniciarLogin() {
  try {
    if (!window.GestorBCASessao) {
      throw new Error(
        "Configuração de sessão não carregada."
      );
    }

    clienteLogin =
      window.GestorBCASessao.criarCliente();

    mostrarMensagem("Verificando autenticação...");

    // Identifica o retorno do Google.
    const retornoOAuth =
      new URLSearchParams(window.location.search)
        .has("code") ||
      window.location.hash.includes("access_token=");

    const { data, error } =
      await clienteLogin.auth.getUser();

    if (error || !data?.user) {
      mostrarDesconectado();
      return;
    }

    // Uma autenticação recém-concluída
    // inicia o controle de inatividade.
    if (retornoOAuth) {
      window.GestorBCASessao.registrarAtividade();
    }

    const ultimaAtividade =
      window.GestorBCASessao.obterUltimaAtividade();

    const agora = Date.now();

    // Sessão antiga, sem controle de atividade,
    // ou expirada: exige novo login.
    if (
      ultimaAtividade === null ||
      ultimaAtividade > agora ||
      agora - ultimaAtividade >=
        window.GestorBCASessao.TEMPO_INATIVIDADE
    ) {
      await clienteLogin.auth.signOut();
      mostrarDesconectado();
      return;
    }

    mostrarAutenticado();

  } catch (erro) {
    console.error("Erro ao iniciar login:", erro);

    mostrarMensagem(
      "Não foi possível iniciar a autenticação."
    );

    botaoEntrar.disabled = true;
  }
}

// ==========================================
// ENTRAR COM GOOGLE
// ==========================================

botaoEntrar.addEventListener(
  "click",
  async () => {
    if (!clienteLogin) return;

    botaoEntrar.disabled = true;

    mostrarMensagem("Abrindo login Google...");
    // Marca que o usuário iniciou um novo login.
window.sessionStorage.removeItem(
  "gestor_bca_ultima_atividade"
);

    try {
      const { error } =
        await clienteLogin.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: SITE_URL
          }
        });

      if (error) throw error;

    } catch (erro) {
      console.error("Erro no login Google:", erro);

      mostrarMensagem(
        "Não foi possível entrar: " +
        erro.message
      );

      botaoEntrar.disabled = false;
    }
  }
);

// ==========================================
// SAIR
// ==========================================

botaoSair.addEventListener(
  "click",
  async () => {
    if (!clienteLogin) return;

    botaoSair.disabled = true;

    try {
      const { error } =
        await clienteLogin.auth.signOut();

      if (error) throw error;

      mostrarDesconectado();

    } catch (erro) {
      console.error("Erro ao sair:", erro);

      mostrarMensagem(
        "Não foi possível encerrar a sessão."
      );

      botaoSair.disabled = false;
    }
  }
);

// ==========================================
// INICIALIZAR
// ==========================================

iniciarLogin();
