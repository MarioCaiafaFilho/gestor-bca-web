
"use strict";

// ==========================================
// GESTOR BCA - LOGIN GOOGLE
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

// ==========================================
// MENSAGENS E CONTROLE DOS BOTOES
// ==========================================

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

function mostrarDesconectado() {
  botaoEntrar.classList.remove("oculto");
  botaoSair.classList.add("oculto");

  botaoEntrar.disabled = false;
  botaoSair.disabled = false;

  mostrarMensagem(
    "Utilize uma conta Google autorizada para acessar o sistema."
  );
}

function mostrarAutenticado() {
  window.location.replace("./menu.html");
}

// ==========================================
// CONTROLE DE VALIDADE DA SESSAO
// ==========================================

function sessaoDentroDoPrazo() {
  const ultima =
    window.GestorBCASessao.obterUltimaAtividade();

  const agora = Date.now();

  return (
    ultima !== null &&
    ultima <= agora &&
    agora - ultima <
      window.GestorBCASessao.TEMPO_INATIVIDADE
  );
}

// ==========================================
// INICIALIZAR LOGIN
// ==========================================

async function iniciarLogin() {
  try {
    if (!window.GestorBCASessao) {
      throw new Error(
        "Configuração de sessão não carregada."
      );
    }

    clienteLogin =
      window.GestorBCASessao.criarCliente();

    mostrarMensagem(
      "Verificando autenticação..."
    );

    // Identificar retorno da autenticacao Google.
    const parametros =
      new URLSearchParams(window.location.search);

    const retornoOAuth =
      parametros.has("code") ||
      window.location.hash.includes(
        "access_token="
      );

    const { data, error } =
      await clienteLogin.auth.getUser();

    if (error || !data?.user) {
      mostrarDesconectado();
      return;
    }

    // Se o Google acabou de autenticar,
    // registrar o inicio da atividade.
    if (retornoOAuth) {
      window.sessionStorage.setItem(
        "gestor_bca_ultima_atividade",
        String(Date.now())
      );
    }

    // Nao aceitar sessoes antigas ou expiradas.
    if (!sessaoDentroDoPrazo()) {
      const { error: erroSaida } =
        await clienteLogin.auth.signOut();

      if (erroSaida) {
        console.error(
          "Erro ao encerrar sessão anterior:",
          erroSaida
        );
      }

      mostrarDesconectado();
      return;
    }

    mostrarAutenticado();

  } catch (erro) {
    console.error(
      "Erro ao iniciar autenticação:",
      erro
    );

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

    mostrarMensagem(
      "Abrindo login Google..."
    );

    try {
      // Um login novo nao deve aproveitar
      // a atividade da sessao anterior.
      window.sessionStorage.removeItem(
        "gestor_bca_ultima_atividade"
      );

      const { error } =
        await clienteLogin.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: SITE_URL
          }
        });

      if (error) throw error;

    } catch (erro) {
      console.error(
        "Erro no login Google:",
        erro
      );

      mostrarMensagem(
        "Não foi possível entrar: " +
        erro.message
      );

      botaoEntrar.disabled = false;
    }
  }
);

// ==========================================
// SAIR DO SISTEMA
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

      window.sessionStorage.removeItem(
        "gestor_bca_ultima_atividade"
      );

      mostrarDesconectado();

    } catch (erro) {
      console.error(
        "Erro ao sair:",
        erro
      );

      mostrarMensagem(
        "Não foi possível encerrar a sessão."
      );

      botaoSair.disabled = false;
    }
  }
);

// ==========================================
// INICIAR
// ==========================================

iniciarLogin();
