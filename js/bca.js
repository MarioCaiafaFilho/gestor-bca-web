
"use strict";

// ==========================================
// GESTOR BCA - MODULO CONTABILIDADE
// ==========================================

(() => {

  const abas = document.querySelectorAll(".aba-bca");

  const conteudos = {
    clientes: document.getElementById("conteudoClientesBCA"),
    tarefas: document.getElementById("conteudoTarefasBCA"),
    rotinas: document.getElementById("conteudoRotinasBCA")
  };

  const areaPrincipal = document.querySelector(".conteudo-bca");

  let clienteSupabaseBCA = null;
  let acessoAutorizadoBCA = false;

  // Mantem as abas protegidas durante a verificacao.
  for (const conteudo of Object.values(conteudos)) {
    if (conteudo) conteudo.hidden = true;
  }

  abas.forEach(aba => {
    aba.disabled = true;
  });

  // ==========================================
  // NAVEGACAO ENTRE ABAS
  // ==========================================

  function abrirAba(nome) {
    if (!acessoAutorizadoBCA || !conteudos[nome]) {
      return;
    }

    abas.forEach(aba => {
      const selecionada = aba.dataset.aba === nome;

      aba.classList.toggle("ativa", selecionada);

      aba.setAttribute(
        "aria-selected",
        String(selecionada)
      );
    });

    for (const [chave, conteudo] of Object.entries(conteudos)) {
      if (conteudo) {
        conteudo.hidden = chave !== nome;
      }
    }
  }

  abas.forEach(aba => {
    aba.addEventListener("click", () => {
      abrirAba(aba.dataset.aba);
    });
  });

  // ==========================================
  // INICIALIZAR E VALIDAR ACESSO
  // ==========================================

  async function iniciarBCA() {
    try {
      if (!window.GestorBCASessao) {
        throw new Error(
          "Controle de sessão indisponível."
        );
      }

      clienteSupabaseBCA =
        window.GestorBCASessao.criarCliente();

      // Confirmar usuario autenticado.
      const { data, error } =
        await clienteSupabaseBCA.auth.getUser();

      if (error || !data?.user) {
        window.location.replace("./index.html");
        return;
      }

      // Verificar a validade da sessao.
      const sessao = window.GestorBCASessao;

      const ultimaAtividade =
        sessao.obterUltimaAtividade();

      const agora = Date.now();

      if (
        ultimaAtividade === null ||
        ultimaAtividade > agora ||
        agora - ultimaAtividade >= sessao.TEMPO_INATIVIDADE
      ) {
        await sessao.encerrarPorInatividade(
          clienteSupabaseBCA
        );
        return;
      }

      // Todos os usuarios autorizados possuem acesso.
      const { data: perfil, error: erroPerfil } =
        await clienteSupabaseBCA
          .from("perfis")
          .select("autorizado")
          .eq("id", data.user.id)
          .maybeSingle();

      if (erroPerfil) throw erroPerfil;

      if (perfil?.autorizado !== true) {
        throw new Error(
          "Usuário sem autorização para acessar o BCA."
        );
      }

      acessoAutorizadoBCA = true;

      sessao.iniciarMonitoramento(clienteSupabaseBCA);

      // Habilitar a navegacao somente apos autorizacao.
      abas.forEach(aba => {
        aba.disabled = false;
      });

      abrirAba("clientes");

    } catch (erro) {
      console.error(
        "Erro ao iniciar o módulo BCA:",
        erro
      );

      acessoAutorizadoBCA = false;

      if (areaPrincipal) {
        const aviso = document.createElement("p");
        aviso.setAttribute("role", "alert");

        aviso.textContent =
          "Não foi possível acessar o módulo BCA. " +
          "Verifique sua autorização ou tente novamente.";

        aviso.style.color = "#b42318";
        aviso.style.fontWeight = "700";
        aviso.style.padding = "16px";

        areaPrincipal.prepend(aviso);
      }
    }
  }

  iniciarBCA();

})();
