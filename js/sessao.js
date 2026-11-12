
"use strict";

// ==========================================
// GESTOR BCA - CONTROLE DE SESSAO
// ==========================================

(function () {

  const SUPABASE_URL =
    "https://pdvipfzbtpsuenpumktb.supabase.co";

  const SUPABASE_PUBLIC_KEY =
    "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

  // 15 minutos de inatividade.
  const TEMPO_INATIVIDADE = 15 * 60 * 1000;

  // Identificador da ultima atividade.
  const CHAVE_ATIVIDADE =
    "gestor_bca_ultima_atividade";

  let monitoramentoIniciado = false;
  let encerrandoSessao = false;
  let ultimaGravacao = 0;

  // ========================================
  // CLIENTE SUPABASE
  // ========================================

  function criarCliente() {
    if (!window.supabase) {
      throw new Error(
        "Biblioteca do Supabase indisponível."
      );
    }

    return window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY,
      {
        auth: {
          persistSession: true,
          storage: window.sessionStorage,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  // ========================================
  // REGISTRAR ATIVIDADE
  // ========================================

  function registrarAtividade() {
    if (encerrandoSessao) return;

    const agora = Date.now();
    const ultima = obterUltimaAtividade();

    // Nunca renovar uma sessao que ja expirou.
    if (
      ultima !== null &&
      agora - ultima >= TEMPO_INATIVIDADE
    ) {
      return;
    }

    // Evita gravacoes excessivas.
    if (agora - ultimaGravacao < 5000) {
      return;
    }

    window.sessionStorage.setItem(
      CHAVE_ATIVIDADE,
      String(agora)
    );

    ultimaGravacao = agora;
  }

  function obterUltimaAtividade() {
    const registro = window.sessionStorage.getItem(
      CHAVE_ATIVIDADE
    );

    if (!registro) return null;

    const valor = Number(registro);

    if (!Number.isFinite(valor) || valor <= 0) {
      return null;
    }

    return valor;
  }

  // ========================================
  // ENCERRAR SESSAO EXPIRADA
  // ========================================

  async function encerrarPorInatividade(cliente) {
    if (encerrandoSessao) return;

    encerrandoSessao = true;

    try {
      const { error } = await cliente.auth.signOut();

      if (error) {
        console.error(
          "Erro ao encerrar sessão expirada:",
          error
        );
      }
    } catch (erro) {
      console.error(
        "Falha no encerramento da sessão:",
        erro
      );
    } finally {
      window.sessionStorage.removeItem(
        CHAVE_ATIVIDADE
      );

      window.location.replace("./index.html");
    }
  }

  // ========================================
  // VERIFICAR TEMPO DE INATIVIDADE
  // ========================================

  async function verificarInatividade(cliente) {
    if (encerrandoSessao) return false;

    const ultima = obterUltimaAtividade();

    if (ultima === null) {
      return false;
    }

    const agora = Date.now();

    if (
      ultima > agora ||
      agora - ultima >= TEMPO_INATIVIDADE
    ) {
      await encerrarPorInatividade(cliente);
      return false;
    }

    return true;
  }

  // ========================================
  // INICIAR MONITORAMENTO
  // ========================================

  function iniciarMonitoramento(cliente) {
    if (monitoramentoIniciado) return;

    monitoramentoIniciado = true;

    // Registrar atividades reais do usuario.
    const eventos = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart"
    ];

    for (const evento of eventos) {
      document.addEventListener(
        evento,
        () => registrarAtividade(),
        { passive: true }
      );
    }

    // Verificar periodicamente se a
    // sessao ultrapassou o limite.
    window.setInterval(
      () => {
        verificarInatividade(cliente);
      },
      30000
    );

    // Verificar quando o usuario retorna
    // para uma aba que estava em segundo plano.
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          verificarInatividade(cliente);
        }
      }
    );

    // Verificar ao retornar para a janela.
    window.addEventListener(
      "focus",
      () => {
        verificarInatividade(cliente);
      }
    );
  }

  // ========================================
  // DISPONIBILIZAR FUNCOES
  // ========================================

  window.GestorBCASessao = Object.freeze({
    criarCliente,
    TEMPO_INATIVIDADE,
    registrarAtividade,
    obterUltimaAtividade,
    verificarInatividade,
    iniciarMonitoramento,
    encerrarPorInatividade
  });

})();
