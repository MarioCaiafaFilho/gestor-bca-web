
"use strict";

// ==========================================
// GESTOR BCA - ROLAGEM HORIZONTAL DOS PRAZOS
// ==========================================

(() => {
  const abaPrazos = document.getElementById("conteudoPrazos");
  const barra = document.getElementById("barraRolagemPrazos");
  const controle = barra?.querySelector(".rolagem-prazos-controle");
  const largura = barra?.querySelector(".rolagem-prazos-largura");

  if (!abaPrazos || !barra || !controle || !largura) {
    console.error("Elementos da rolagem de Prazos não encontrados.");
    return;
  }

  const tabelas = Array.from(
    abaPrazos.querySelectorAll(".tabela-rolagem")
  );

  if (!tabelas.length) return;

  let tabelaAtiva = null;
  let sincronizando = false;
  let atualizacaoAgendada = false;

  function abaEstaVisivel() {
    return !abaPrazos.hidden &&
      getComputedStyle(abaPrazos).display !== "none";
  }

  function obterTabelaVisivel() {
    const alturaTela = window.innerHeight;
    const centroTela = alturaTela / 2;

    let melhorTabela = null;
    let melhorPontuacao = -Infinity;

    for (const tabela of tabelas) {
      const area = tabela.getBoundingClientRect();

      if (area.width === 0 || area.height === 0) {
        continue;
      }

      const topoVisivel = Math.max(0, area.top);
      const baseVisivel = Math.min(alturaTela, area.bottom);

      const alturaVisivel = Math.max(
        0,
        baseVisivel - topoVisivel
      );

      const centroTabela = Math.max(
        area.top,
        Math.min(centroTela, area.bottom)
      );

      const distanciaCentro = Math.abs(
        centroTabela - centroTela
      );

      const pontuacao =
        alturaVisivel > 0
          ? 100000 + alturaVisivel - distanciaCentro
          : -Math.min(
              Math.abs(area.top - centroTela),
              Math.abs(area.bottom - centroTela)
            );

      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        melhorTabela = tabela;
      }
    }

    return melhorTabela;
  }

  function atualizarBarra() {
    atualizacaoAgendada = false;

    if (!abaEstaVisivel()) {
      barra.hidden = true;
      tabelaAtiva = null;
      return;
    }

    const tabela = obterTabelaVisivel();

    if (!tabela) {
      barra.hidden = true;
      tabelaAtiva = null;
      return;
    }

    const larguraTabela = tabela.scrollWidth;
    const larguraVisivel = tabela.clientWidth;

    if (larguraTabela <= larguraVisivel + 1) {
      barra.hidden = true;
      tabelaAtiva = tabela;
      return;
    }

    tabelaAtiva = tabela;

    // A barra acompanha horizontalmente a largura
    // real da area da tabela na pagina.
    const area = tabela.getBoundingClientRect();

    barra.style.left = `${area.left}px`;
    barra.style.width = `${area.width}px`;
    barra.style.padding = "9px 0 11px";

    largura.style.width = `${larguraTabela}px`;
    barra.hidden = false;

    // Mantem a posicao da barra igual a da tabela.
    if (!sincronizando) {
      controle.scrollLeft = tabela.scrollLeft;
    }
  }

  function agendarAtualizacao() {
    if (atualizacaoAgendada) return;

    atualizacaoAgendada = true;
    requestAnimationFrame(atualizarBarra);
  }

  // Movimentar a barra fixa movimenta a tabela.
  controle.addEventListener("scroll", () => {
    if (!tabelaAtiva || sincronizando) return;

    sincronizando = true;
    tabelaAtiva.scrollLeft = controle.scrollLeft;
    sincronizando = false;
  });

  // Movimentar a tabela atualiza a barra fixa.
  for (const tabela of tabelas) {
    tabela.addEventListener("scroll", () => {
      if (tabela !== tabelaAtiva || sincronizando) {
        return;
      }

      sincronizando = true;
      controle.scrollLeft = tabela.scrollLeft;
      sincronizando = false;
    });
  }

  // Identifica a tabela conforme a posicao vertical.
  window.addEventListener(
    "scroll",
    agendarAtualizacao,
    { passive: true }
  );

  window.addEventListener(
    "resize",
    agendarAtualizacao
  );

  // Atualiza a barra ao trocar de aba.
  document.querySelectorAll(".aba-bonavere")
    .forEach(botao => {
      botao.addEventListener("click", () => {
        requestAnimationFrame(agendarAtualizacao);
      });
    });

  // Atualiza quando processos forem carregados,
  // filtrados ou tiverem sua listagem modificada.
  const observador = new MutationObserver(
    agendarAtualizacao
  );

  for (const tabela of tabelas) {
    observador.observe(tabela, {
      childList: true,
      subtree: true
    });
  }

  agendarAtualizacao();
})();
