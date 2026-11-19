
"use strict";

// ==========================================
// GESTOR BCA - MODULO AUDIENCIAS
// ==========================================

(() => {
  const modal = document.getElementById("modalAudiencia");
  const formulario = document.getElementById("formAudiencia");
  const botaoNovo = document.getElementById("novaAudiencia");
  const botaoSalvar = document.getElementById("salvarAudiencia");
  const botaoCancelar = document.getElementById("cancelarAudiencia");
  const lista = document.getElementById("listaAudiencias");
  const total = document.getElementById("totalAudiencias");

  let cliente = null;
  let autorizado = false;

  const situacoes = {
    agendada: "Agendada",
    realizada: "Realizada",
    redesignada: "Redesignada",
    cancelada: "Cancelada"
  };

  function mostrarMensagem(mensagem) {
    const linha = document.createElement("tr");
    const celula = document.createElement("td");

    celula.colSpan = 10;
    celula.className = "vazio";
    celula.textContent = mensagem;

    linha.appendChild(celula);
    lista.replaceChildren(linha);
  }

  function formatarData(data) {
    if (!data) return "—";

    const partes = data.split("-");

    return partes.length === 3
      ? `${partes[2]}/${partes[1]}/${partes[0]}`
      : data;
  }

  function adicionarCelula(linha, valor) {
    const celula = document.createElement("td");
    celula.textContent = valor ?? "—";
    linha.appendChild(celula);
  }

  async function conferirAcesso() {
    if (!window.GestorBCASessao) {
      throw new Error("Controle de sessão indisponível.");
    }

    cliente = window.GestorBCASessao.criarCliente();

    const { data, error } = await cliente.auth.getUser();

    if (error || !data?.user) {
      return false;
    }

    const { data: perfil, error: erroPerfil } =
      await cliente
        .from("perfis")
        .select("autorizado")
        .eq("id", data.user.id)
        .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    return perfil?.autorizado === true;
  }

  async function carregarAudiencias() {
    mostrarMensagem("Carregando audiências...");

    const { data, error } = await cliente
      .from("bonavere_audiencias")
      .select(`
        id,
        numero_processo,
        cliente,
        tribunal,
        data_audiencia,
        horario,
        modalidade,
        local_link,
        responsavel_id,
        situacao,
        observacao
      `)
      .order("data_audiencia", { ascending: true })
      .order("horario", { ascending: true })
      .limit(1000);

    if (error) throw error;

    lista.replaceChildren();

    for (const audiencia of data || []) {
      const linha = document.createElement("tr");

      adicionarCelula(
        linha,
        formatarData(audiencia.data_audiencia)
      );

      adicionarCelula(
        linha,
        audiencia.horario?.slice(0, 5)
      );

      adicionarCelula(linha, audiencia.numero_processo);
      adicionarCelula(linha, audiencia.cliente);
      adicionarCelula(linha, audiencia.tribunal);
      adicionarCelula(linha, audiencia.modalidade);
      adicionarCelula(linha, audiencia.local_link);
      
const responsavel = responsaveisAudiencias.find(
  item => item.id === audiencia.responsavel_id
);

adicionarCelula(
  linha,
  responsavel?.nome || "—"
);

      adicionarCelula(
        linha,
        situacoes[audiencia.situacao] || audiencia.situacao
      );
     
const celulaObservacoes = document.createElement("td");

const textoObservacao = document.createElement("div");
textoObservacao.textContent = audiencia.observacao || "—";

const botaoEditar = document.createElement("button");
botaoEditar.type = "button";
botaoEditar.textContent = "Editar";
botaoEditar.className = "botao-editar-audiencia";

botaoEditar.addEventListener("click", () => {
  abrirEdicaoAudiencia(audiencia);
});

celulaObservacoes.appendChild(textoObservacao);
celulaObservacoes.appendChild(botaoEditar);
linha.appendChild(celulaObservacoes);


      lista.appendChild(linha);
    }

    total.textContent =
      `${data?.length || 0} audiência(s)`;

    if (!data?.length) {
      mostrarMensagem("Nenhuma audiência cadastrada.");
    }
  }

  
botaoNovo.addEventListener("click", () => {
  if (!autorizado) return;

  formulario.reset();
  formulario.elements.namedItem("id").value = "";

  document.getElementById(
    "tituloModalAudiencia"
  ).textContent = "Cadastrar audiência";

  botaoSalvar.disabled = false;
  modal.showModal();
});

      

formulario.reset();
formulario.elements.namedItem("id").value = "";

document.getElementById(
  "tituloModalAudiencia"
).textContent = "Cadastrar audiência";

botaoSalvar.disabled = false;
modal.showModal();



    } catch (erro) {
      console.error("Erro de acesso:", erro);
      alert("Não foi possível abrir o formulário.");
    }
  });

  botaoCancelar.addEventListener("click", () => {
    modal.close();
  });

  async function iniciarAudiencias() {
    botaoNovo.disabled = true;
    botaoSalvar.disabled = true;

    try {
      autorizado = await conferirAcesso();

if (autorizado) {
  window.GestorBCASessao.iniciarMonitoramento(cliente);
}


      if (!autorizado) {
        mostrarMensagem("Acesso não autorizado.");
        return;
      }


await carregarResponsaveisAudiencias();
await carregarAudiencias();

      botaoNovo.disabled = false;

    } catch (erro) {
      console.error("Erro ao iniciar Audiências:", erro);
      mostrarMensagem("Não foi possível carregar as audiências.");
    }
  }

// ==========================================
// CADASTRAR E EDITAR AUDIENCIAS
// ==========================================

let audienciasCadastradas = [];

function valorOuNulo(valor) {
  return String(valor ?? "").trim() || null;
}

function obterDadosAudiencia() {
  const dados = new FormData(formulario);

  return {
    numero_processo: valorOuNulo(
      dados.get("numero_processo")
    ),
    cliente: valorOuNulo(dados.get("cliente")),
    tribunal: valorOuNulo(dados.get("tribunal")),
    data_audiencia: dados.get("data_audiencia"),
    horario: dados.get("horario"),
    modalidade: dados.get("modalidade"),
    local_link: valorOuNulo(dados.get("local_link")),
    responsavel_id: valorOuNulo(
      dados.get("responsavel_id")
    ),
    situacao: dados.get("situacao"),
    observacao: valorOuNulo(dados.get("observacao"))
  };
}

async function verificarSessaoAudiencia() {
  if (!window.GestorBCASessao) {
    throw new Error("Controle de sessão indisponível.");
  }

  const ultima =
    window.GestorBCASessao.obterUltimaAtividade();

  const agora = Date.now();

  if (
    ultima === null ||
    ultima > agora ||
    agora - ultima >=
      window.GestorBCASessao.TEMPO_INATIVIDADE
  ) {
    autorizado = false;
    botaoNovo.disabled = true;

    await window.GestorBCASessao
      .encerrarPorInatividade(cliente);

    throw new Error("Sessão expirada.");
  }

  const acesso = await conferirAcesso();

  if (!acesso) {
    autorizado = false;
    botaoNovo.disabled = true;
    throw new Error("Usuário não autorizado.");
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (botaoSalvar.disabled) return;

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  try {
    await verificarSessaoAudiencia();

    if (!formulario.reportValidity()) return;

    const dados = obterDadosAudiencia();
    const id = formulario.elements.namedItem("id").value;

    let consulta;

    if (id) {
      consulta = cliente
        .from("bonavere_audiencias")
        .update(dados)
        .eq("id", id);
    } else {
      consulta = cliente
        .from("bonavere_audiencias")
        .insert(dados);
    }

    const { data, error } = await consulta
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "O banco não confirmou a gravação."
      );
    }

    modal.close();
    await carregarAudiencias();

    alert("Audiência salva com sucesso!");

  } catch (erro) {
    console.error("Erro ao salvar audiência:", erro);
    alert("Não foi possível salvar a audiência.");

  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar audiência";
  }
});

// ==========================================
// HABILITAR FORMULARIO DE CADASTRO
// ==========================================


// ==========================================
// RESPONSAVEIS DAS AUDIENCIAS
// ==========================================

let responsaveisAudiencias = [];

async function carregarResponsaveisAudiencias() {
  const { data, error } = await cliente
    .from("bonavere_responsaveis")
    .select("id, nome, ativo")
    .order("nome", { ascending: true });

  if (error) throw error;

  responsaveisAudiencias = data || [];

  const seletor = formulario.elements.namedItem(
    "responsavel_id"
  );

  seletor.replaceChildren();

  const primeira = document.createElement("option");
  primeira.value = "";
  primeira.textContent = "Selecione";
  seletor.appendChild(primeira);

  for (const responsavel of responsaveisAudiencias) {
    const opcao = document.createElement("option");

    opcao.value = responsavel.id;
    opcao.textContent = responsavel.nome +
      (responsavel.ativo ? "" : " (Inativo)");

    opcao.disabled = !responsavel.ativo;

    seletor.appendChild(opcao);
  }
}

// ==========================================
// EDITAR AUDIENCIA EXISTENTE
// ==========================================

async function abrirEdicaoAudiencia(audiencia) {
  if (!autorizado) return;

  try {
    await verificarSessaoAudiencia();

    formulario.reset();

    const campos = [
      "id",
      "numero_processo",
      "cliente",
      "tribunal",
      "data_audiencia",
      "horario",
      "modalidade",
      "local_link",
      "responsavel_id",
      "situacao",
      "observacao"
    ];

    for (const campo of campos) {
      const elemento = formulario.elements.namedItem(campo);

      if (!elemento) continue;

      let valor = audiencia[campo] ?? "";

      if (campo === "horario" && valor) {
        valor = valor.slice(0, 5);
      }

      elemento.value = valor;
    }

    document.getElementById(
      "tituloModalAudiencia"
    ).textContent = "Editar audiência";

    botaoSalvar.disabled = false;
    modal.showModal();

  } catch (erro) {
    console.error("Erro ao editar audiência:", erro);
    alert("Não foi possível abrir a edição da audiência.");
  }
}

  iniciarAudiencias();
})();
