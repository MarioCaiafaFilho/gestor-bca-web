
"use strict";

// ==========================================
// GESTOR BCA - AGENDA
// ==========================================

(() => {
  const lista = document.getElementById("listaAgenda");
  const total = document.getElementById("totalAgenda");
  const botaoNovo = document.getElementById("novoCompromisso");

  if (!lista || !total || !botaoNovo) return;

  let cliente = null;

  // Filtros da Agenda por mes e ano
  const filtroMesAgenda = document.getElementById(
    "filtroMesAgenda"
  );

  const filtroAnoAgenda = document.getElementById(
    "filtroAnoAgenda"
  );

  let itensAgendaMemoria = [];

  const nomesMeses = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);

    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;

    return elemento;
  }

  function formatarData(data) {
    if (!data) return "—";

    const partes = data.split("-");

    if (partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function validarDataAgenda(valor) {
    const texto = String(valor ?? "").trim();

    const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);

    if (!partes) {
      throw new Error(
        "Digite a data completa no formato DD/MM/AAAA."
      );
    }

    const dia = Number(partes[1]);
    const mes = Number(partes[2]);
    const ano = Number(partes[3]);

    if (ano < 1900 || ano > 2199) {
      throw new Error(
        "Informe um ano válido entre 1900 e 2199."
      );
    }

    const data = new Date(Date.UTC(ano, mes - 1, dia));

    if (
      data.getUTCFullYear() !== ano ||
      data.getUTCMonth() !== mes - 1 ||
      data.getUTCDate() !== dia
    ) {
      throw new Error("A data informada não existe.");
    }

    return [
      String(ano).padStart(4, "0"),
      String(mes).padStart(2, "0"),
      String(dia).padStart(2, "0")
    ].join("-");
  }


  function formatarHora(hora) {
    return hora ? hora.slice(0, 5) : "—";
  }

  function diasAte(data) {
    const [ano, mes, dia] = data.split("-").map(Number);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const destino = new Date(ano, mes - 1, dia);

    return Math.round((destino - hoje) / 86400000);
  }

  function classePorSituacao(item) {
    if (item.situacao === "concluido") {
      return "agenda-concluida";
    }

    if (item.situacao === "cancelado") {
      return "agenda-cancelada";
    }

    const dias = diasAte(item.data);

    if (dias < 0) return "agenda-atrasada";
    if (dias <= 1) return "agenda-urgente";
    if (dias <= 3) return "agenda-proxima";
    if (dias <= 7) return "agenda-atencao";

    return "";
  }

  
  function normalizarAudiencias(registros) {
    return registros.map(audiencia => {
      const numeroProcesso = String(
        audiencia.numero_processo ?? ""
      ).trim();

      const nomeCliente = String(
        audiencia.cliente ?? ""
      ).trim();

      const identificacao = [
        numeroProcesso,
        nomeCliente
      ].filter(Boolean).join(" - ");

      return {
        id: audiencia.id,
        origem: "audiencia",
        data: audiencia.data_audiencia,
        hora: audiencia.horario,

        compromisso: identificacao
          ? `Audiência - ${identificacao}`
          : "Audiência - Sem identificação",

        tipo: "Audiência",

        situacao:
          audiencia.situacao === "realizada"
            ? "concluido"
            : audiencia.situacao === "cancelada"
              ? "cancelado"
              : "agendado"
      };
    });
  }


  function normalizarProcessos(registros) {
    return registros
      .filter(processo => processo.vencimento)
      .map(processo => ({
        id: processo.id,
        origem: "processo",
        data: processo.vencimento,
        hora: null,
        compromisso:
          processo.numero_processo
            ? `Processo - ${processo.numero_processo}`
            : `Processo - ${processo.cliente || "Sem identificação"}`,
        tipo: "Prazo processual",
        situacao: processo.data_conclusao
          ? "concluido"
          : "agendado"
      }));
  }

  function normalizarCompromissos(registros) {
    const tipos = {
      atendimento: "Atendimento",
      reuniao: "Reunião",
      diligencia: "Diligência",
      outros: "Outros"
    };

    return registros.map(compromisso => ({
      id: compromisso.id,
      origem: "manual",
      data: compromisso.data_compromisso,
      hora: compromisso.horario_inicio,
      compromisso: compromisso.titulo,
      tipo: tipos[compromisso.tipo] || compromisso.tipo,
      tipoCodigo: compromisso.tipo,
      situacao: compromisso.situacao
    }));
  }

 
function ordenarItens(itens) {
  return [...itens].sort((a, b) => {
    // Organizar primeiro pela data.
    const comparacaoData = a.data.localeCompare(b.data);

    if (comparacaoData !== 0) {
      return comparacaoData;
    }

    // Na mesma data, organizar pelo horario.
    return (a.hora || "").localeCompare(b.hora || "");
  });
}


  function mostrarMensagem(mensagem) {
    lista.replaceChildren(
      criarElemento("p", "vazio", mensagem)
    );
  }

  // ==========================================
  // AGENDA - EDICAO DIRETA DE CAMPOS
  // ==========================================

  function criarCampoEditavelAgenda(
    item,
    campo,
    tipo,
    valorExibido
  ) {
    const elemento = criarElemento(
      "span",
      "agenda-campo-editavel",
      valorExibido
    );

    elemento.tabIndex = 0;
    elemento.title = "Clique para editar";

    let editando = false;

    function iniciarEdicao() {
      if (editando) return;

      editando = true;

      const entrada = document.createElement("input");
      entrada.type = tipo;

      entrada.value =
        campo === "horario_inicio"
          ? (item.hora || "").slice(0, 5)
          : item.compromisso || "";

      let encerrado = false;

      function restaurar() {
        editando = false;
        elemento.textContent = valorExibido;
      }

      function cancelar() {
        if (encerrado) return;
        encerrado = true;
        restaurar();
      }

      async function salvar() {
        if (encerrado) return;

        const novoValor = entrada.value.trim();
        const valorAnterior =
          campo === "horario_inicio"
            ? (item.hora || "").slice(0, 5)
            : item.compromisso || "";

        if (campo === "titulo" && !novoValor) {
          alert("O compromisso não pode ficar vazio.");
          entrada.focus();
          return;
        }

        if (novoValor === valorAnterior) {
          cancelar();
          return;
        }

        encerrado = true;
        entrada.disabled = true;

        let gravado = false;

        try {
          await verificarAcessoAgenda();

          const { data, error } = await cliente
            .from("bonavere_agenda")
            .update({
              [campo]: novoValor || null
            })
            .eq("id", item.id)
            .select("id");

          if (error) throw error;

          if (!data || data.length !== 1) {
            throw new Error(
              "O banco não confirmou a alteração."
            );
          }

          gravado = true;

          if (campo === "horario_inicio") {
            item.hora = novoValor || null;
          } else {
            item.compromisso = novoValor;
          }

          await carregarAgenda();

        } catch (erro) {
          console.error(
            "Erro ao editar compromisso:",
            erro
          );

          restaurar();

          alert(
            gravado
              ? "Alteração salva, mas não foi possível atualizar a Agenda."
              : "Não foi possível salvar a alteração."
          );
        }
      }

      entrada.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          cancelar();
        }

        if (evento.key === "Enter") {
          evento.preventDefault();
          salvar();
        }
      });

      entrada.addEventListener("blur", salvar);

      elemento.replaceChildren(entrada);
      entrada.focus();
    }

    elemento.addEventListener("click", evento => {
      if (evento.target === elemento) {
        iniciarEdicao();
      }
    });

    elemento.addEventListener("keydown", evento => {
      if (
        evento.target === elemento &&
        (evento.key === "Enter" || evento.key === " ")
      ) {
        evento.preventDefault();
        iniciarEdicao();
      }
    });

    return elemento;
  }

  // ==========================================
  // AGENDA - EDICAO DE DATA E TIPO
  // ==========================================

  function criarCampoDataTipoAgenda(item, campo) {
    const ehData = campo === "data_compromisso";

    const nomesTipos = {
      atendimento: "Atendimento",
      reuniao: "Reunião",
      diligencia: "Diligência",
      outros: "Outros"
    };

    const elemento = criarElemento(
      "span",
      "agenda-campo-editavel",
      ehData ? formatarData(item.data) : item.tipo
    );

    elemento.tabIndex = 0;
    elemento.title = "Clique para editar";

    let editando = false;

    function iniciarEdicao() {
      if (editando) return;

      editando = true;

      const entrada = document.createElement(
        ehData ? "input" : "select"
      );

      if (ehData) {
       
entrada.type = "text";
entrada.inputMode = "numeric";
entrada.maxLength = 10;
entrada.placeholder = "DD/MM/AAAA";
entrada.value = formatarData(item.data);

      } else {
        for (const [valor, texto] of Object.entries(nomesTipos)) {
          const opcao = document.createElement("option");
          opcao.value = valor;
          opcao.textContent = texto;
          entrada.appendChild(opcao);
        }

        entrada.value = item.tipoCodigo;
      }

      let encerrado = false;

      function restaurar() {
        editando = false;
        elemento.textContent = ehData
          ? formatarData(item.data)
          : item.tipo;
      }

      function cancelar() {
        if (encerrado) return;
        encerrado = true;
        restaurar();
      }

      async function salvar() {
        if (encerrado) return;


        let novoValor = entrada.value;

        
if (ehData) {
  try {
    novoValor = validarDataAgenda(novoValor);
  } catch (erro) {
    cancelar();
    alert(erro.message);
    return;
  }
}


        const valorAnterior = ehData
          ? item.data
          : item.tipoCodigo;

        if (ehData && !novoValor) {
          alert("A data do compromisso é obrigatória.");
          entrada.focus();
          return;
        }

        if (novoValor === valorAnterior) {
          cancelar();
          return;
        }

        encerrado = true;
        entrada.disabled = true;

        let gravado = false;

        try {
          await verificarAcessoAgenda();

          const { data, error } = await cliente
            .from("bonavere_agenda")
            .update({ [campo]: novoValor })
            .eq("id", item.id)
            .select("id");

          if (error) throw error;

          if (!data || data.length !== 1) {
            throw new Error(
              "O banco não confirmou a alteração."
            );
          }

          gravado = true;

          if (ehData) {
            item.data = novoValor;
          } else {
            item.tipoCodigo = novoValor;
            item.tipo = nomesTipos[novoValor];
          }

          await carregarAgenda();

        } catch (erro) {
          console.error(
            "Erro ao editar Data ou Tipo:",
            erro
          );

          restaurar();

          alert(
            gravado
              ? "Alteração salva, mas não foi possível atualizar a Agenda."
              : "Não foi possível salvar a alteração."
          );
        }
      }

      entrada.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          cancelar();
          return;
        }

        if (evento.key === "Enter") {
          evento.preventDefault();
          salvar();
        }
      });

      entrada.addEventListener("change", () => {
        if (!ehData) salvar();
      });

      entrada.addEventListener("blur", salvar);

      elemento.replaceChildren(entrada);
      entrada.focus();
    }

    elemento.addEventListener("click", evento => {
      if (evento.target === elemento) {
        iniciarEdicao();
      }
    });

    elemento.addEventListener("keydown", evento => {
      if (
        evento.target === elemento &&
        !editando &&
        (evento.key === "Enter" || evento.key === " ")
      ) {
        evento.preventDefault();
        iniciarEdicao();
      }
    });

    return elemento;
  }

  // ==========================================
  // AGENDA - ALTERAR SITUACAO
  // ==========================================

  function criarSituacaoAgenda(item) {
    const seletor = document.createElement("select");

    seletor.className = "agenda-seletor-situacao";
    seletor.setAttribute(
      "aria-label",
      "Situação do compromisso"
    );

    const situacoes = [
      { valor: "agendado", texto: "Agendado" },
      { valor: "concluido", texto: "Concluído" },
      { valor: "cancelado", texto: "Cancelado" }
    ];

    for (const situacao of situacoes) {
      const opcao = document.createElement("option");

      opcao.value = situacao.valor;
      opcao.textContent = situacao.texto;

      seletor.appendChild(opcao);
    }

    seletor.value = item.situacao;

    seletor.addEventListener("change", async () => {
      const valorAnterior = item.situacao;
      const novoValor = seletor.value;

      if (novoValor === valorAnterior) return;

      seletor.disabled = true;

      let gravado = false;

      try {
        await verificarAcessoAgenda();

        const { data, error } = await cliente
          .from("bonavere_agenda")
          .update({
            situacao: novoValor
          })
          .eq("id", item.id)
          .select("id");

        if (error) throw error;

        if (!data || data.length !== 1) {
          throw new Error(
            "O banco não confirmou a alteração."
          );
        }

        gravado = true;
        item.situacao = novoValor;

        await carregarAgenda();

      } catch (erro) {
        console.error(
          "Erro ao alterar situação:",
          erro
        );

        seletor.value = item.situacao;

        alert(
          gravado
            ? "Situação salva, mas não foi possível atualizar a Agenda."
            : "Não foi possível alterar a situação."
        );

      } finally {
        seletor.disabled = false;
      }
    });

    return seletor;
  }

  function criarLinha(item) {
    const linha = criarElemento("div", "agenda-linha");

    const classe = classePorSituacao(item);
    if (classe) linha.classList.add(classe);

    linha.dataset.origem = item.origem;
    linha.dataset.id = item.id;

    const data = criarElemento(
      "span", "", formatarData(item.data)
    );

    const hora = criarElemento(
      "span", "", formatarHora(item.hora)
    );

    const compromisso = criarElemento(
      "span", "", item.compromisso
    );

    const tipo = criarElemento(
      "span", "", item.tipo
    );


    if (item.origem === "manual") {
      const horaEditavel = criarCampoEditavelAgenda(
        item,
        "horario_inicio",
        "time",
        formatarHora(item.hora)
      );

      const compromissoEditavel = criarCampoEditavelAgenda(
        item,
        "titulo",
        "text",
        item.compromisso
      );

     
const dataEditavel = criarCampoDataTipoAgenda(
  item,
  "data_compromisso"
);

const tipoEditavel = criarCampoDataTipoAgenda(
  item,
  "tipo"
);


const colunaTipo = document.createElement("div");

colunaTipo.className = "agenda-tipo-situacao";

colunaTipo.appendChild(tipoEditavel);
colunaTipo.appendChild(criarSituacaoAgenda(item));

linha.append(
  dataEditavel,
  horaEditavel,
  compromissoEditavel,
  colunaTipo
);

    } else {
      linha.append(data, hora, compromisso, tipo);
    }

    return linha;
  }

  // ==========================================
  // ANOS DISPONIVEIS NO FILTRO DA AGENDA
  // ==========================================

  // ==========================================
  // INDICADORES MENSAIS DA AGENDA
  // ==========================================

  function atualizarIndicadoresAgenda() {
    const indicadorCompromissos = document.getElementById(
      "indicadorCompromissosMes"
    );

    const indicadorAudiencias = document.getElementById(
      "indicadorAgendaAudienciasMes"
    );

    const indicadorAtendimentos = document.getElementById(
      "indicadorAgendaAtendimentosMes"
    );

    if (
      !indicadorCompromissos ||
      !indicadorAudiencias ||
      !indicadorAtendimentos
    ) {
      return;
    }

    const hoje = new Date();

    const anoAtual = hoje.getFullYear();

    const mesAtual = String(
      hoje.getMonth() + 1
    ).padStart(2, "0");

    const periodoAtual = `${anoAtual}-${mesAtual}`;

    // Todos os registros do mes atual.
    const itensDoMes = itensAgendaMemoria.filter(item =>
      item.data &&
      item.data.slice(0, 7) === periodoAtual
    );

    // Audiencias registradas no mes.
    const audienciasDoMes = itensDoMes.filter(item =>
      item.origem === "audiencia"
    );

    // Atendimentos manuais registrados no mes.
    const atendimentosDoMes = itensDoMes.filter(item =>
      item.origem === "manual" &&
      item.tipoCodigo === "atendimento"
    );

    indicadorCompromissos.textContent =
      itensDoMes.length;

    indicadorAudiencias.textContent =
      audienciasDoMes.length;

    indicadorAtendimentos.textContent =
      atendimentosDoMes.length;
  }

  function atualizarAnosAgenda() {
    if (!filtroAnoAgenda) return;

    const anoSelecionado = filtroAnoAgenda.value;

    const anos = [...new Set(
      itensAgendaMemoria
        .filter(item => item.data)
        .map(item => item.data.slice(0, 4))
    )].sort((a, b) => b.localeCompare(a));

    filtroAnoAgenda.replaceChildren();

    const todos = document.createElement("option");
    todos.value = "";
    todos.textContent = "Todos os anos";
    filtroAnoAgenda.appendChild(todos);

    for (const ano of anos) {
      const opcao = document.createElement("option");
      opcao.value = ano;
      opcao.textContent = ano;
      filtroAnoAgenda.appendChild(opcao);
    }

    filtroAnoAgenda.value = anos.includes(anoSelecionado)
      ? anoSelecionado
      : "";
  }

  
  function renderizarAgenda(itens) {
    const mesSelecionado = filtroMesAgenda?.value || "";
    const anoSelecionado = filtroAnoAgenda?.value || "";

    const itensFiltrados = itens.filter(item => {
      const data = item.data || "";

      const ano = data.slice(0, 4);
      const mes = data.slice(5, 7);

      return (
        (!mesSelecionado || mes === mesSelecionado) &&
        (!anoSelecionado || ano === anoSelecionado)
      );
    });

    lista.replaceChildren();


   if (!itensFiltrados.length) {
  mostrarMensagem(
    "Nenhum compromisso encontrado para o período selecionado."
  );
      total.textContent = "0 compromissos";
      return;
    }

    // Ordenacao cronologica, independentemente da situacao.
    const meses = new Map();

for (const item of ordenarItens(itensFiltrados)) {      if (!item.data) continue;

      const chaveMes = item.data.slice(0, 7);
      if (!meses.has(chaveMes)) meses.set(chaveMes, []);
      meses.get(chaveMes).push(item);
    }

    // Todos os meses em ordem de data, inclusive os anteriores.
    const mesesOrdenados = [...meses.entries()].sort(
      ([mesA], [mesB]) => mesA.localeCompare(mesB)
    );

    const diasSemana = [
      "Domingo", "Segunda-feira", "Terça-feira",
      "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"
    ];

    for (const [chaveMes, compromissos] of mesesOrdenados) {
      const [ano, mes] = chaveMes.split("-").map(Number);
      const secao = criarElemento("section", "agenda-mes");
      const titulo = criarElemento(
        "div",
        "agenda-mes-titulo",
        `${nomesMeses[mes - 1]} ${ano}`
      );
      secao.appendChild(titulo);

      let dataAnterior = null;

      // Itens ja ordenados por dia e horario em ordenarItens().
      for (const compromisso of compromissos) {
        if (compromisso.data !== dataAnterior) {
          const [anoDia, mesDia, dia] = compromisso.data
            .split("-").map(Number);
          const indiceSemana = new Date(
            Date.UTC(anoDia, mesDia - 1, dia)
          ).getUTCDay();

          const tituloDia = criarElemento(
            "div",
            "agenda-dia-titulo",
            `DIA ${String(dia).padStart(2, "0")} — ${diasSemana[indiceSemana]}`
          );

          // Visual independente de alteracoes no arquivo CSS.
          tituloDia.style.padding = "9px 16px";
          tituloDia.style.backgroundColor = "#f0f4f9";
          tituloDia.style.color = "#173b65";
          tituloDia.style.fontWeight = "700";
          tituloDia.style.fontSize = "12px";
          tituloDia.style.borderLeft = "4px solid #6b8caf";
          tituloDia.style.borderBottom = "1px solid #d6e1ed";

          secao.appendChild(tituloDia);
          dataAnterior = compromisso.data;
        }

           secao.appendChild(criarLinha(compromisso));
      }

      lista.appendChild(secao);
    }

    total.textContent =
      `${itensFiltrados.length} compromisso(s)`;
  }



  async function carregarAgenda() {
    mostrarMensagem("Carregando Agenda...");

    const [resultadoAudiencias, resultadoProcessos,
      resultadoManuais] = await Promise.all([
      cliente
        .from("bonavere_audiencias")
        .select(
          "id, numero_processo, cliente, data_audiencia, horario, situacao"
        ),

      cliente
        .from("bonavere_processos")
        .select(
          "id, numero_processo, cliente, vencimento, data_conclusao, status"
        ),

      cliente
        .from("bonavere_agenda")
        .select(
          "id, titulo, data_compromisso, horario_inicio, tipo, situacao"
        )
    ]);

    if (resultadoAudiencias.error) {
      throw resultadoAudiencias.error;
    }

    if (resultadoManuais.error) {
      throw resultadoManuais.error;
    }

    const itens = [
      ...normalizarAudiencias(resultadoAudiencias.data || []),
      ...normalizarCompromissos(resultadoManuais.data || [])
    ];

    // Os processos respeitam as permissoes
    // de leitura da tabela original.
    if (!resultadoProcessos.error) {
      itens.push(
        ...normalizarProcessos(resultadoProcessos.data || [])
      );
    } else {
      console.warn(
        "Processos indisponíveis para consulta na Agenda:",
        resultadoProcessos.error
      );
    }


    
    itensAgendaMemoria = itens;

    atualizarAnosAgenda();

    atualizarIndicadoresAgenda();

    renderizarAgenda(itensAgendaMemoria);

  }

  // ==========================================
  // EVENTOS DOS FILTROS DA AGENDA
  // ==========================================

  if (filtroMesAgenda) {
    filtroMesAgenda.addEventListener("change", () => {
      renderizarAgenda(itensAgendaMemoria);
    });
  }

  if (filtroAnoAgenda) {
    filtroAnoAgenda.addEventListener("change", () => {
      renderizarAgenda(itensAgendaMemoria);
    });
  }

  async function iniciarAgenda() {
    botaoNovo.disabled = true;

    try {
      if (!window.GestorBCASessao) {
        throw new Error("Controle de sessão indisponível.");
      }

      cliente = window.GestorBCASessao.criarCliente();

      const { data, error } = await cliente.auth.getUser();

      if (error || !data?.user) {
        mostrarMensagem("Sessão não autorizada.");
        return;
      }

      const { data: perfil, error: erroPerfil } =
        await cliente
          .from("perfis")
          .select("autorizado")
          .eq("id", data.user.id)
          .maybeSingle();

      if (erroPerfil) throw erroPerfil;

      if (perfil?.autorizado !== true) {
        mostrarMensagem("Acesso não autorizado.");
        return;
      }

      window.GestorBCASessao.iniciarMonitoramento(cliente);

      

await carregarResponsaveisAgenda();
await carregarAgenda();

botaoNovo.disabled = false;



    } catch (erro) {
      console.error("Erro ao carregar Agenda:", erro);

      mostrarMensagem(
        "Não foi possível carregar a Agenda."
      );
    }
  }

// ==========================================
// CADASTRO DE COMPROMISSOS MANUAIS
// ==========================================

const modalCompromisso =
  document.getElementById("modalCompromisso");

const formCompromisso =
  document.getElementById("formCompromisso");

const salvarCompromisso =
  document.getElementById("salvarCompromisso");

const cancelarCompromisso =
  document.getElementById("cancelarCompromisso");

let salvandoCompromisso = false;

async function verificarAcessoAgenda() {
  const sessao = window.GestorBCASessao;

  if (!sessao || !cliente) {
    throw new Error("Controle de sessão indisponível.");
  }

  const ultima = sessao.obterUltimaAtividade();
  const agora = Date.now();

  if (
    ultima === null ||
    ultima > agora ||
    agora - ultima >= sessao.TEMPO_INATIVIDADE
  ) {
    await sessao.encerrarPorInatividade(cliente);
    throw new Error("Sessão expirada.");
  }

  const { data, error } = await cliente.auth.getUser();

  if (error || !data?.user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: perfil, error: erroPerfil } =
    await cliente
      .from("perfis")
      .select("autorizado")
      .eq("id", data.user.id)
      .maybeSingle();

  if (erroPerfil) throw erroPerfil;

  if (perfil?.autorizado !== true) {
    throw new Error("Usuário não autorizado.");
  }
}

botaoNovo.addEventListener("click", () => {
  if (botaoNovo.disabled) return;

  formCompromisso.reset();

  formCompromisso.elements.namedItem("id").value = "";

  document.getElementById(
    "tituloModalCompromisso"
  ).textContent = "Novo compromisso";

  salvarCompromisso.disabled = false;

  modalCompromisso.showModal();
});

cancelarCompromisso.addEventListener("click", () => {
  modalCompromisso.close();
});

formCompromisso.addEventListener("submit", async evento => {
  evento.preventDefault();

  if (salvandoCompromisso) return;

  salvandoCompromisso = true;
  salvarCompromisso.disabled = true;
  salvarCompromisso.textContent = "Salvando...";

  let gravado = false;

  try {
    await verificarAcessoAgenda();

    if (!formCompromisso.reportValidity()) return;

    const campos = new FormData(formCompromisso);

    let dataValidada;

    try {
      dataValidada = validarDataAgenda(
        campos.get("data_compromisso")
      );
    } catch (erro) {
      alert(erro.message);
      return;
    }


    function valorOuNulo(nome) {
      return String(campos.get(nome) ?? "").trim() || null;
    }

    const horarioInicio = valorOuNulo("horario_inicio");
    const horarioFim = valorOuNulo("horario_fim");

    if (
      horarioInicio &&
      horarioFim &&
      horarioFim < horarioInicio
    ) {
      alert(
        "O horário de término não pode ser anterior ao início."
      );
      return;
    }

    const compromisso = {
      titulo: valorOuNulo("titulo"),
      tipo: valorOuNulo("tipo"),
data_compromisso: dataValidada,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      responsavel_id: valorOuNulo("responsavel_id"),
      local_link: valorOuNulo("local_link"),
      situacao: valorOuNulo("situacao"),
      descricao: valorOuNulo("descricao"),
      observacao: valorOuNulo("observacao")
    };

    const { data, error } = await cliente
      .from("bonavere_agenda")
      .insert(compromisso)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "O banco não confirmou o cadastro."
      );
    }

    gravado = true;
    modalCompromisso.close();

    await carregarAgenda();

    alert("Compromisso cadastrado com sucesso!");

  } catch (erro) {
    console.error(
      "Erro ao cadastrar compromisso:",
      erro
    );

    alert(
      gravado
        ? "Compromisso salvo, mas a Agenda não foi atualizada."
        : "Não foi possível cadastrar o compromisso."
    );

  } finally {
    salvandoCompromisso = false;
    salvarCompromisso.disabled = false;
    salvarCompromisso.textContent = "Salvar compromisso";
  }
});

  // ==========================================
  // RESPONSAVEIS DOS COMPROMISSOS
  // ==========================================

  async function carregarResponsaveisAgenda() {
    const { data, error } = await cliente
      .from("bonavere_responsaveis")
      .select("id, nome, ativo")
      .order("nome", { ascending: true });

    if (error) throw error;

    const seletor = formCompromisso.elements.namedItem(
      "responsavel_id"
    );

    seletor.replaceChildren();

    const primeira = document.createElement("option");
    primeira.value = "";
    primeira.textContent = "Selecione";
    seletor.appendChild(primeira);

    for (const responsavel of data || []) {
      const opcao = document.createElement("option");

      opcao.value = responsavel.id;
      opcao.textContent = responsavel.nome +
        (responsavel.ativo ? "" : " (Inativo)");

      opcao.disabled = !responsavel.ativo;

      seletor.appendChild(opcao);
    }
  }

// ==========================================
// ATUALIZAR AGENDA AO ABRIR A ABA
// ==========================================

const abaAgenda = document.querySelector(
  '.aba-bonavere[data-aba="agenda"]'
);

if (abaAgenda) {
  abaAgenda.addEventListener("click", async () => {
    if (!cliente || botaoNovo.disabled) return;

    try {
      await verificarAcessoAgenda();
      await carregarAgenda();
    } catch (erro) {
      console.error(
        "Erro ao atualizar a Agenda:",
        erro
      );

      mostrarMensagem(
        "Não foi possível atualizar a Agenda."
      );
    }
  });
}

  iniciarAgenda();
})();
