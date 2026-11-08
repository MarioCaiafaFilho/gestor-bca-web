
"use strict";

// ==========================================
// GESTOR BCA - MODULO BONAVERE
// ==========================================

// Utilize a mesma chave publica do login.js.
const SUPABASE_URL =
  "https://pdvipfzbtpsuenpumktb.supabase.co";

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

let clienteSupabase = null;
let usuarioAtual = null;
let podeEditar = false;

const tabelaAbertos =
  document.getElementById("processosAbertos");

const tabelaFechados =
  document.getElementById("processosFechados");

const totalAbertos =
  document.getElementById("totalAbertos");

const totalFechados =
  document.getElementById("totalFechados");

const botaoNovo =
  document.getElementById("novoPrazo");

const modal =
  document.getElementById("modalNovoPrazo");

const formulario =
  document.getElementById("formNovoPrazo");

const botaoCancelar =
  document.getElementById("cancelarPrazo");

const botaoSalvar =
  document.getElementById("salvarPrazo");

const situacoes = {
  aberta: "Aberta",
  em_processo: "Em processo",
  concluida: "Concluída",
  nada_a_fazer: "Nada a fazer"
};

// ==========================================
// MENSAGENS E DATAS
// ==========================================

function mensagemTabela(tabela, mensagem) {
  tabela.replaceChildren();

  const linha = document.createElement("tr");
  const celula = document.createElement("td");

  celula.colSpan = 10;
  celula.className = "vazio";
  celula.textContent = mensagem;

  linha.appendChild(celula);
  tabela.appendChild(linha);
}

function formatarData(data) {
  if (!data) return "—";

  const partes = data.split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dataEmDias(data) {
  if (!data) return null;

  const partes = data.split("-").map(Number);

  return Math.floor(
    Date.UTC(
      partes[0],
      partes[1] - 1,
      partes[2]
    ) / 86400000
  );
}

function diasAteVencimento(data) {
  if (!data) return null;

  const hoje = new Date();

  const hojeEmDias = Math.floor(
    Date.UTC(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    ) / 86400000
  );

  return dataEmDias(data) - hojeEmDias;
}

// ==========================================
// CORES DOS PRAZOS
// ==========================================

function aplicarCorVencimento(celula, processo) {
  if (
    !processo.vencimento ||
    processo.status === "concluida" ||
    processo.status === "nada_a_fazer"
  ) {
    return;
  }

  const dias =
    diasAteVencimento(processo.vencimento);

  if (dias === null || dias > 7) return;

  const intensidade =
    dias <= 0 ? 1 : (7 - dias) / 7;

  const inicio = [255, 242, 239];
  const fim = [220, 53, 53];

  const cor = inicio.map((valor, indice) =>
    Math.round(
      valor +
      (fim[indice] - valor) * intensidade
    )
  );

  celula.style.backgroundColor =
    `rgb(${cor.join(",")})`;

  celula.style.color =
    intensidade >= 0.65
      ? "#ffffff"
      : "#752a2a";

  celula.style.fontWeight = "bold";

  if (dias < 0) {
    celula.title = "Prazo vencido";
  } else if (dias === 0) {
    celula.title = "Vence hoje";
  } else {
    celula.title =
      `Faltam ${dias} dias corridos`;
  }
}

// ==========================================
// LINHAS DAS TABELAS
// ==========================================

function adicionarCelula(linha, valor) {
  const celula = document.createElement("td");

  celula.textContent = valor ?? "—";

  linha.appendChild(celula);

  return celula;
}

/* ==========================================
   EDICAO DIRETA DOS CAMPOS DE TEXTO
   ========================================== */

function adicionarCelulaEditavel(linha, processo, campo) {
  const celula = adicionarCelula(
    linha,
    processo[campo] || "—"
  );

  if (!podeEditar) return celula;

  celula.classList.add("celula-editavel");
  celula.title = "Clique para editar";

  celula.addEventListener("click", () => {
    if (celula.querySelector("input")) return;

    const valorOriginal = processo[campo] || "";

    const entrada = document.createElement("input");
    entrada.type = "text";
    entrada.className = "entrada-celula";
    entrada.value = valorOriginal;
    entrada.setAttribute("aria-label", `Editar ${campo}`);

    celula.replaceChildren(entrada);
    entrada.focus();
    entrada.select();

    let finalizada = false;

    function restaurar() {
      celula.textContent = valorOriginal || "—";
    }

    async function salvar() {
      if (finalizada) return;
      finalizada = true;

      const novoValor = entrada.value.trim();

      if (novoValor === valorOriginal.trim()) {
        restaurar();
        return;
      }

      entrada.disabled = true;

      try {
        const { data, error } = await clienteSupabase
          .from("bonavere_processos")
          .update({
            [campo]: novoValor || null
          })
          .eq("id", processo.id)
          .select("id");

        if (error) throw error;

        if (!data || data.length !== 1) {
          throw new Error(
            "Alteração não confirmada pelo banco."
          );
        }

        await carregarProcessos();

      } catch (erro) {
        console.error("Erro ao editar campo:", erro);
        restaurar();

        alert(
          "Não foi possível salvar a alteração. " +
          "Verifique o Console."
        );
      }
    }

    entrada.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") {
        evento.preventDefault();
        salvar();
      }

      if (evento.key === "Escape") {
        evento.preventDefault();
        finalizada = true;
        restaurar();
      }
    });

    entrada.addEventListener("blur", salvar);
  });

  return celula;
}

function adicionarCelulaData(linha, processo, campo) {
  const celula = adicionarCelula(
    linha,
    formatarData(processo[campo])
  );

  if (campo === "vencimento") {
    aplicarCorVencimento(celula, processo);
  }

  if (!podeEditar) return celula;

  celula.classList.add("celula-editavel");
  celula.title = "Clique para escolher uma data";

  celula.addEventListener("click", () => {
    if (celula.querySelector("input")) return;

    const valorOriginal = processo[campo] || "";
    const entrada = document.createElement("input");

    entrada.type = "date";
    entrada.className = "entrada-celula";
    entrada.value = valorOriginal;

    celula.style.backgroundColor = "";
    celula.style.color = "";
    celula.replaceChildren(entrada);

    let finalizada = false;

    function restaurar() {
      celula.textContent = formatarData(valorOriginal);

      if (campo === "vencimento") {
        aplicarCorVencimento(celula, processo);
      }
    }

    async function salvar() {
      if (finalizada) return;
      finalizada = true;

      const novaData = entrada.value || null;

      if (novaData === (valorOriginal || null)) {
        restaurar();
        return;
      }

      entrada.disabled = true;

      try {
        const { data, error } = await clienteSupabase
          .from("bonavere_processos")
          .update({ [campo]: novaData })
          .eq("id", processo.id)
          .select("id");

        if (error) throw error;

        if (!data || data.length !== 1) {
          throw new Error(
            "O banco não confirmou a alteração."
          );
        }

        await carregarProcessos();

      } catch (erro) {
        console.error("Erro ao alterar data:", erro);
        restaurar();
        alert("Não foi possível salvar a data.");
      }
    }

    entrada.addEventListener("change", salvar);

    entrada.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") {
        evento.preventDefault();
        salvar();
      }

      if (evento.key === "Escape") {
        evento.preventDefault();
        finalizada = true;
        restaurar();
      }
    });

    entrada.focus();
  });

  return celula;
}


function criarLinha(processo) {
  const linha = document.createElement("tr");

  if (processo.status === "em_processo") {
    linha.classList.add("em-processo");
  }

  if (processo.status === "concluida") {
    linha.classList.add("concluida");
  }

 
adicionarCelulaEditavel(
  linha,
  processo,
  "numero_processo"
);

adicionarCelulaEditavel(
  linha,
  processo,
  "origem"
);

adicionarCelulaEditavel(
  linha,
  processo,
  "cliente"
);
adicionarCelulaData(linha, processo, "publicacao");

adicionarCelulaData(linha, processo, "data_limite");

adicionarCelulaData(linha, processo, "vencimento");

  aplicarCorVencimento(
    celulaVencimento,
    processo
  );

  adicionarCelulaEditavel(
  linha,
  processo,
  "observacao"
);

  adicionarCelula(
    linha,
    processo.bonavere_responsaveis?.nome || "—"
  );

  adicionarCelula(
    linha,
    processo.bonavere_tipos?.nome || "—"
  );

 const celulaSituacao = document.createElement("td");

if (podeEditar) {
  const seletor = document.createElement("select");

  seletor.className = "seletor-situacao";
  seletor.setAttribute(
    "aria-label",
    "Situação do processo " +
      (processo.numero_processo || "")
  );

  for (const [valor, descricao] of Object.entries(situacoes)) {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = descricao;
    seletor.appendChild(opcao);
  }

  seletor.value = processo.status;

  seletor.addEventListener("change", async () => {
    await alterarSituacao(processo, seletor);
  });

  celulaSituacao.appendChild(seletor);
} else {
  celulaSituacao.textContent =
    situacoes[processo.status] || processo.status;
}

linha.appendChild(celulaSituacao);

  return linha;
}

// ==========================================
// ORGANIZACAO DOS PROCESSOS
// ==========================================

function ordenarAbertos(a, b) {
  // Sem data limite: primeiro.
  if (!a.data_limite && b.data_limite) {
    return -1;
  }

  if (a.data_limite && !b.data_limite) {
    return 1;
  }

  // Data limite mais proxima: primeiro.
  if (a.data_limite && b.data_limite) {
    const diferenca =
      a.data_limite.localeCompare(b.data_limite);

    if (diferenca !== 0) return diferenca;
  }

  // Desempate pela data de vencimento.
  if (!a.vencimento && b.vencimento) {
    return 1;
  }

  if (a.vencimento && !b.vencimento) {
    return -1;
  }

  if (a.vencimento && b.vencimento) {
    const diferenca =
      a.vencimento.localeCompare(b.vencimento);

    if (diferenca !== 0) return diferenca;
  }

  return a.criado_em.localeCompare(b.criado_em);
}

function mostrarProcessos(processos) {
  const abertos = processos
    .filter(processo =>
      processo.status === "aberta" ||
      processo.status === "em_processo"
    )
    .sort(ordenarAbertos);

  const fechados = processos
    .filter(processo =>
      processo.status === "concluida" ||
      processo.status === "nada_a_fazer"
    )
    .sort((a, b) =>
      b.atualizado_em.localeCompare(
        a.atualizado_em
      )
    );

  tabelaAbertos.replaceChildren();
  tabelaFechados.replaceChildren();

  for (const processo of abertos) {
    tabelaAbertos.appendChild(
      criarLinha(processo)
    );
  }

  for (const processo of fechados) {
    tabelaFechados.appendChild(
      criarLinha(processo)
    );
  }

  if (abertos.length === 0) {
    mensagemTabela(
      tabelaAbertos,
      "Nenhum processo em aberto."
    );
  }

  if (fechados.length === 0) {
    mensagemTabela(
      tabelaFechados,
      "Nenhum processo fechado."
    );
  }

  totalAbertos.textContent =
    `${abertos.length} registro(s)`;

  totalFechados.textContent =
    `${fechados.length} registro(s)`;
}
async function alterarSituacao(processo, seletor) {
  if (!podeEditar || !usuarioAtual) {
    seletor.value = processo.status;
    return;
  }

  const novaSituacao = seletor.value;

  if (novaSituacao === processo.status) {
    return;
  }

  if (
    novaSituacao === "concluida" ||
    novaSituacao === "nada_a_fazer"
  ) {
    const confirmar = window.confirm(
      "Deseja encerrar este prazo como " +
      `"${situacoes[novaSituacao]}"?\n\n` +
      "O registro será transferido para " +
      "Processos fechados."
    );

    if (!confirmar) {
      seletor.value = processo.status;
      return;
    }
  }

  seletor.disabled = true;

  try {
    const { data, error } = await clienteSupabase
      .from("bonavere_processos")
      .update({
        status: novaSituacao
      })
      .eq("id", processo.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "A alteração não foi confirmada pelo banco."
      );
    }

    await carregarProcessos();

  } catch (erro) {
    console.error(
      "Erro ao alterar situação:",
      erro
    );

    seletor.value = processo.status;

    alert(
      "Não foi possível alterar a situação. " +
      "Verifique o Console do navegador."
    );
  } finally {
    seletor.disabled = false;
  }
}
// ==========================================
// CONSULTAR PROCESSOS
// ==========================================

async function carregarProcessos() {
  const { data, error } = await clienteSupabase
    .from("bonavere_processos")
    .select(`
      id,
      numero_processo,
      origem,
      cliente,
      publicacao,
      data_limite,
      vencimento,
      observacao,
      status,
      criado_em,
      atualizado_em,
      bonavere_responsaveis!bonavere_processos_responsavel_id_fkey(nome),
      bonavere_tipos(nome)
    `)
    .order("criado_em", {
      ascending: true
    })
    .limit(1000);

  if (error) throw error;

  mostrarProcessos(data || []);
}

// ==========================================
// VERIFICAR PERMISSAO DE EDICAO
// ==========================================

async function verificarPermissao() {
  podeEditar = false;
  botaoNovo.disabled = true;

  const { data: perfil, error: erroPerfil } =
    await clienteSupabase
      .from("perfis")
      .select("id, master, autorizado")
      .eq("id", usuarioAtual.id)
      .maybeSingle();

  if (erroPerfil) throw erroPerfil;

  if (!perfil || !perfil.autorizado) {
    return;
  }

  if (perfil.master) {
    podeEditar = true;
    botaoNovo.disabled = false;
    return;
  }

  const { data: permissao, error: erroPermissao } =
    await clienteSupabase
      .from("permissoes")
      .select("nivel")
      .eq("user_id", usuarioAtual.id)
      .eq("modulo", "bonavere")
      .maybeSingle();

  if (erroPermissao) throw erroPermissao;

  // A autorizacao efetiva continua sendo
  // validada pelo RLS no banco de dados.
  if (permissao?.nivel === "editar") {
    podeEditar = true;
    botaoNovo.disabled = false;
  }
}

// ==========================================
// CARREGAR RESPONSAVEIS E TIPOS
// ==========================================

function preencherSelecao(campo, registros) {
  campo.replaceChildren();

  const opcaoInicial =
    document.createElement("option");

  opcaoInicial.value = "";
  opcaoInicial.textContent = "Selecione";

  campo.appendChild(opcaoInicial);

  for (const registro of registros) {
    const opcao =
      document.createElement("option");

    opcao.value = registro.id;
    opcao.textContent = registro.nome;

    campo.appendChild(opcao);
  }
}

async function carregarOpcoesFormulario() {
  const [
    resultadoResponsaveis,
    resultadoTipos
  ] = await Promise.all([
    clienteSupabase
      .from("bonavere_responsaveis")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),

    clienteSupabase
      .from("bonavere_tipos")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome")
  ]);

  if (resultadoResponsaveis.error) {
    throw resultadoResponsaveis.error;
  }

  if (resultadoTipos.error) {
    throw resultadoTipos.error;
  }

  preencherSelecao(
    formulario.elements.namedItem(
      "responsavel_id"
    ),
    resultadoResponsaveis.data || []
  );

  preencherSelecao(
    formulario.elements.namedItem("tipo_id"),
    resultadoTipos.data || []
  );
}

// ==========================================
// ABRIR E FECHAR FORMULARIO
// ==========================================

botaoNovo.addEventListener("click", async () => {
  if (!podeEditar) return;

  botaoNovo.disabled = true;

  try {
    formulario.reset();

    await carregarOpcoesFormulario();

    botaoSalvar.disabled = false;

    modal.showModal();
  } catch (erro) {
    console.error(
      "Erro ao preparar formulário:",
      erro
    );

    alert(
      "Não foi possível carregar o formulário. " +
      "Verifique o Console do navegador."
    );
  } finally {
    botaoNovo.disabled = !podeEditar;
  }
});

botaoCancelar.addEventListener("click", () => {
  modal.close();
});

// ==========================================
// CADASTRAR NOVO PRAZO
// ==========================================

function textoOuNulo(valor) {
  const texto = String(valor || "").trim();

  return texto === "" ? null : texto;
}

formulario.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    if (!podeEditar || !usuarioAtual) {
      alert("Você não possui permissão de edição.");
      return;
    }

    const dados =
      new FormData(formulario);

    const novoProcesso = {
      numero_processo: textoOuNulo(
        dados.get("numero_processo")
      ),

      origem: textoOuNulo(
        dados.get("origem")
      ),

      cliente: textoOuNulo(
        dados.get("cliente")
      ),

      publicacao: textoOuNulo(
        dados.get("publicacao")
      ),

      data_limite: textoOuNulo(
        dados.get("data_limite")
      ),

      vencimento: textoOuNulo(
        dados.get("vencimento")
      ),

      observacao: textoOuNulo(
        dados.get("observacao")
      ),

      responsavel_id: textoOuNulo(
        dados.get("responsavel_id")
      ),

      tipo_id: textoOuNulo(
        dados.get("tipo_id")
      ),

      status:
        dados.get("status") || "aberta"
    };

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
      const { error } = await clienteSupabase
        .from("bonavere_processos")
        .insert(novoProcesso);

      if (error) throw error;

      modal.close();

      await carregarProcessos();

      alert("Prazo cadastrado com sucesso!");
    } catch (erro) {
      console.error(
        "Erro ao salvar prazo:",
        erro
      );

      alert(
        "Não foi possível concluir a operação. " +
        "Verifique a mensagem no Console."
      );
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar prazo";
    }
  }
);

// ==========================================
// INICIAR MODULO BONAVERE
// ==========================================

async function iniciarBonavere() {
  if (
    SUPABASE_PUBLIC_KEY ===
    "COLE_AQUI_SUA_CHAVE_PUBLISHABLE"
  ) {
    mensagemTabela(
      tabelaAbertos,
      "Configure a chave pública no bonavere.js."
    );
    return;
  }

  if (!window.supabase) {
    mensagemTabela(
      tabelaAbertos,
      "Não foi possível carregar o Supabase."
    );
    return;
  }

  clienteSupabase =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );

  try {
    mensagemTabela(
      tabelaAbertos,
      "Verificando autenticação..."
    );

    const {
      data: autenticacao,
      error: erroAuth
    } = await clienteSupabase.auth.getUser();

    if (erroAuth || !autenticacao.user) {
      window.location.replace("./index.html");
      return;
    }

    usuarioAtual = autenticacao.user;

    mensagemTabela(
      tabelaAbertos,
      "Carregando processos..."
    );

    await carregarProcessos();

    try {
      await verificarPermissao();
      await carregarProcessos();
    } catch (erroPermissao) {
      // Falha na verificacao nao libera edicao.
      console.error(
        "Erro ao verificar permissão:",
        erroPermissao
      );

      podeEditar = false;
      botaoNovo.disabled = true;
    }

  } catch (erro) {
    console.error(
      "Erro ao carregar Bonavere:",
      erro
    );

    mensagemTabela(
      tabelaAbertos,
      "Não foi possível carregar os processos."
    );

    mensagemTabela(
      tabelaFechados,
      "Carregamento indisponível."
    );
  }
}

iniciarBonavere();
