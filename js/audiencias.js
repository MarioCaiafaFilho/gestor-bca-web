
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
  const listaSugestoes = document.getElementById("listaSugestoesClientesAudiencia");

  if (!modal || !formulario || !botaoNovo || !botaoSalvar ||
      !botaoCancelar || !lista || !total || !listaSugestoes) {
    console.error("Elementos do modulo Audiencias nao encontrados no HTML.");
    return;
  }

  let cliente = null;
  let autorizado = false;
  let responsaveisAudiencias = [];
  let salvandoFormulario = false;

  function mostrarMensagem(mensagem) {
    const linha = document.createElement("tr");
    const celula = document.createElement("td");
    celula.colSpan = 10;
    celula.className = "vazio";
    celula.textContent = mensagem;
    linha.appendChild(celula);
    lista.replaceChildren(linha);
  }

  function valorOuNulo(valor) {
    return String(valor ?? "").trim() || null;
  }

  function formatarData(data) {
    if (!data) return "—";
    const partes = data.split("-");
    return partes.length === 3
      ? `${partes[2]}/${partes[1]}/${partes[0]}`
      : data;
  }

  function validarDataAudiencia(valor) {
    const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
      String(valor ?? "").trim()
    );

    if (!partes) {
      throw new Error("Digite a data completa no formato DD/MM/AAAA.");
    }

    const dia = Number(partes[1]);
    const mes = Number(partes[2]);
    const ano = Number(partes[3]);

    if (ano < 1900 || ano > 2199) {
      throw new Error("Informe um ano válido entre 1900 e 2199.");
    }

    const data = new Date(Date.UTC(ano, mes - 1, dia));

    if (
      data.getUTCFullYear() !== ano ||
      data.getUTCMonth() !== mes - 1 ||
      data.getUTCDate() !== dia
    ) {
      throw new Error("A data informada não existe.");
    }

    return `${partes[3]}-${partes[2]}-${partes[1]}`;
  }

  function diasAteAudiencia(data) {
    const [ano, mes, dia] = data.split("-").map(Number);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const audiencia = new Date(ano, mes - 1, dia);
    return Math.round((audiencia - hoje) / 86400000);
  }

  function prioridadeAudiencia(audiencia) {
    if (audiencia.situacao === "cancelada") return 3;
    if (audiencia.situacao === "realizada") return 2;

    return diasAteAudiencia(audiencia.data_audiencia) >= 0 ? 0 : 1;
  }

  function classeCorAudiencia(audiencia) {
    if (audiencia.situacao === "realizada") {
      return "audiencia-concluida";
    }

    if (audiencia.situacao === "cancelada") {
      return "audiencia-cancelada";
    }

    const dias = diasAteAudiencia(audiencia.data_audiencia);

    if (dias < 0) return "audiencia-atrasada";
    if (dias <= 1) return "audiencia-urgente";
    if (dias <= 3) return "audiencia-proxima";
    if (dias <= 7) return "audiencia-atencao";

    return "";
  }

  function ordenarAudiencias(audiencias) {
    return [...audiencias].sort((a, b) => {
      const prioridadeA = prioridadeAudiencia(a);
      const prioridadeB = prioridadeAudiencia(b);

      if (prioridadeA !== prioridadeB) {
        return prioridadeA - prioridadeB;
      }

      const comparacao =
        a.data_audiencia.localeCompare(b.data_audiencia) ||
        (a.horario || "").localeCompare(b.horario || "");

      return prioridadeA === 1 ? -comparacao : comparacao;
    });
  }

  // ==========================================
  // SESSAO E ACESSO
  // ==========================================

  async function conferirAcesso() {
    if (!window.GestorBCASessao) {
      throw new Error("Controle de sessão indisponível.");
    }

    if (!cliente) {
      cliente = window.GestorBCASessao.criarCliente();
    }

    const { data, error } = await cliente.auth.getUser();

    if (error || !data?.user) {
      return false;
    }

    const { data: perfil, error: erroPerfil } = await cliente
      .from("perfis")
      .select("autorizado")
      .eq("id", data.user.id)
      .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    return perfil?.autorizado === true;
  }

  async function verificarSessaoAudiencia() {
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
      autorizado = false;
      botaoNovo.disabled = true;

      await sessao.encerrarPorInatividade(cliente);

      throw new Error("Sessão expirada.");
    }

    if (!(await conferirAcesso())) {
      autorizado = false;
      botaoNovo.disabled = true;

      throw new Error("Usuário não autorizado.");
    }
  }

  // ==========================================
  // CLIENTES E RESPONSAVEIS
  // ==========================================

  async function carregarSugestoesClientesAudiencia() {
    const { data, error } = await cliente
      .from("bonavere_clientes")
      .select("nome_completo")
      .eq("ativo", true)
      .order("nome_completo", { ascending: true })
      .limit(1000);

    if (error) throw error;

    listaSugestoes.replaceChildren();

    for (const registro of data || []) {
      const opcao = document.createElement("option");
      opcao.value = registro.nome_completo;
      listaSugestoes.appendChild(opcao);
    }
  }

  
  async function carregarSugestoesClientesAudiencia() {
    let listaEdicao = document.getElementById(
      "listaClientesEdicaoAudiencia"
    );

    // Lista independente do formulario modal.
    if (!listaEdicao) {
      listaEdicao = document.createElement("datalist");
      listaEdicao.id = "listaClientesEdicaoAudiencia";
      document.body.appendChild(listaEdicao);
    }

    const { data, error } = await cliente
      .from("bonavere_clientes")
      .select("nome_completo")
      .eq("ativo", true)
      .order("nome_completo", { ascending: true })
      .limit(1000);

    if (error) throw error;

    // Atualiza as duas listas.
    listaSugestoes.replaceChildren();
    listaEdicao.replaceChildren();

    for (const registro of data || []) {
      const opcaoFormulario = document.createElement("option");
      opcaoFormulario.value = registro.nome_completo;
      listaSugestoes.appendChild(opcaoFormulario);

      const opcaoEdicao = document.createElement("option");
      opcaoEdicao.value = registro.nome_completo;
      listaEdicao.appendChild(opcaoEdicao);
    }
  }


  async function carregarResponsaveisAudiencias() {
    const { data, error } = await cliente
      .from("bonavere_responsaveis")
      .select("id, nome, ativo")
      .order("nome", { ascending: true });

    if (error) throw error;

    responsaveisAudiencias = data || [];

    const seletor = formulario.elements.namedItem("responsavel_id");

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
  // EDICAO DIRETA DOS CAMPOS
  // ==========================================

  function adicionarCelulaEditavel(
    linha,
    audiencia,
    campo,
    tipo = "text"
  ) {
    const celula = document.createElement("td");
    celula.classList.add("campo-editavel");
    celula.tabIndex = 0;

    let editando = false;

    function mostrarValor() {
      celula.replaceChildren();

      let valor = audiencia[campo];

      if (campo === "data_audiencia") {
        valor = formatarData(valor);
      } else if (campo === "horario") {
        valor = valor?.slice(0, 5);
      }

      celula.textContent = valor || "—";
    }

    async function iniciarEdicao() {
      if (editando || !autorizado) return;

      editando = true;

      // Apenas o campo Cliente consulta os nomes ativos.
      if (campo === "cliente") {
        try {
          await verificarSessaoAudiencia();
          await carregarSugestoesClientesAudiencia();
        } catch (erro) {
          editando = false;

          console.error(
            "Erro ao carregar clientes na edição:",
            erro
          );

          alert(
            "Não foi possível carregar os clientes cadastrados."
          );

          return;
        }
      }

      const entrada = document.createElement(
        tipo === "textarea" ? "textarea" : "input"
      );

      if (tipo === "textarea") {
        entrada.rows = 3;
      } else {
        entrada.type =
          campo === "data_audiencia" ? "text" : tipo;

        if (campo === "data_audiencia") {
          entrada.inputMode = "numeric";
          entrada.maxLength = 10;
          entrada.placeholder = "DD/MM/AAAA";
        }

        
if (campo === "cliente") {
  entrada.setAttribute(
    "list",
    "listaClientesEdicaoAudiencia"
  );

          entrada.setAttribute("autocomplete", "off");

          entrada.placeholder = "Digite o nome do cliente";
        }
      }

      entrada.value = campo === "data_audiencia"
        ? (
          audiencia[campo]
            ? formatarData(audiencia[campo])
            : ""
        )
        : (audiencia[campo] ?? "");

      if (campo === "horario" && entrada.value) {
        entrada.value = entrada.value.slice(0, 5);
      }

      let encerrado = false;

      function cancelar() {
        if (encerrado) return;

        encerrado = true;
        editando = false;

        mostrarValor();
      }

      async function salvar() {
        if (encerrado) return;

        let novoValor = entrada.value.trim();

        if (campo === "data_audiencia") {
          try {
            novoValor = validarDataAudiencia(novoValor);
          } catch (erro) {
            // Evita alertas repetidos ao perder o foco.
            cancelar();
            alert(erro.message);
            return;
          }
        }

        if (campo === "horario" && !novoValor) {
          cancelar();
          alert("Este campo é obrigatório.");
          return;
        }

        const anterior = audiencia[campo] ?? "";

        const anteriorComparavel = campo === "horario"
          ? String(anterior).slice(0, 5)
          : String(anterior);

        if (novoValor === anteriorComparavel) {
          cancelar();
          return;
        }

        // Validar novo nome ao editar Cliente.
        if (campo === "cliente") {
          try {
            novoValor = validarClienteAudiencia(novoValor);
          } catch (erro) {
            cancelar();
            alert(erro.message);
            return;
          }
        }

        encerrado = true;
        entrada.disabled = true;

        let gravado = false;

        try {
          await verificarSessaoAudiencia();

          const { data, error } = await cliente
            .from("bonavere_audiencias")
            .update({ [campo]: novoValor || null })
            .eq("id", audiencia.id)
            .select("id");

          if (error) throw error;

          if (!data || data.length !== 1) {
            throw new Error(
              "O banco não confirmou a alteração."
            );
          }

          gravado = true;
          audiencia[campo] = novoValor || null;
          editando = false;

          if (
            campo === "data_audiencia" ||
            campo === "horario"
          ) {
            await carregarAudiencias();
          } else {
            mostrarValor();
          }
        } catch (erro) {
          console.error(
            "Erro ao editar audiência:",
            erro
          );

          editando = false;
          mostrarValor();

          alert(
            gravado
              ? "Alteração salva, mas não foi possível atualizar a tabela."
              : "Não foi possível salvar a alteração."
          );
        }
      }

      entrada.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          cancelar();
        } else if (
          evento.key === "Enter" &&
          (tipo !== "textarea" || evento.ctrlKey)
        ) {
          evento.preventDefault();
          salvar();
        }
      });

      entrada.addEventListener("blur", salvar);

      celula.replaceChildren(entrada);
      entrada.focus();
    }

    celula.addEventListener("click", evento => {
      if (evento.target === celula && !editando) {
        iniciarEdicao();
      }
    });

    celula.addEventListener("keydown", evento => {
      if (
        evento.target === celula &&
        !editando &&
        (evento.key === "Enter" || evento.key === " ")
      ) {
        evento.preventDefault();
        iniciarEdicao();
      }
    });

    mostrarValor();
    linha.appendChild(celula);
  }

  // ==========================================
  // EDICAO DIRETA DOS SELETORES
  // ==========================================

  function adicionarCelulaSelecao(
    linha,
    audiencia,
    campo,
    opcoes
  ) {
    const celula = document.createElement("td");
    celula.classList.add("campo-editavel");

    const seletor = document.createElement("select");

    seletor.setAttribute(
      "aria-label",
      `Alterar ${campo.replaceAll("_", " ")}`
    );

    for (const opcao of opcoes) {
      const elemento = document.createElement("option");

      elemento.value = opcao.valor;
      elemento.textContent = opcao.texto;

      seletor.appendChild(elemento);
    }

    seletor.value = audiencia[campo] ?? "";

    seletor.addEventListener("change", async () => {
      const novoValor = seletor.value || null;
      const anterior = audiencia[campo] ?? null;

      if (novoValor === anterior) return;

      seletor.disabled = true;

      let gravado = false;

      try {
        await verificarSessaoAudiencia();

        const { data, error } = await cliente
          .from("bonavere_audiencias")
          .update({ [campo]: novoValor })
          .eq("id", audiencia.id)
          .select("id");

        if (error) throw error;

        if (!data || data.length !== 1) {
          throw new Error(
            "O banco não confirmou a alteração."
          );
        }

        audiencia[campo] = novoValor;
        gravado = true;

        if (campo === "situacao") {
          await carregarAudiencias();
        }
      } catch (erro) {
        console.error(
          "Erro ao atualizar audiência:",
          erro
        );

        seletor.value = audiencia[campo] ?? "";

        alert(
          gravado
            ? "Alteração salva, mas não foi possível atualizar a tabela."
            : "Não foi possível salvar a alteração."
        );
      } finally {
        seletor.disabled = false;
      }
    });

    celula.appendChild(seletor);
    linha.appendChild(celula);
  }

  // ==========================================
  // CARREGAR E EXIBIR AUDIENCIAS
  // ==========================================

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

    for (const audiencia of ordenarAudiencias(data || [])) {
      const linha = document.createElement("tr");
      const classe = classeCorAudiencia(audiencia);

      if (classe) {
        linha.classList.add(classe);
      }

      adicionarCelulaEditavel(
        linha,
        audiencia,
        "data_audiencia",
        "date"
      );

      adicionarCelulaEditavel(
        linha,
        audiencia,
        "horario",
        "time"
      );

      adicionarCelulaEditavel(
        linha,
        audiencia,
        "numero_processo"
      );

      adicionarCelulaEditavel(
        linha,
        audiencia,
        "cliente"
      );

      adicionarCelulaEditavel(
        linha,
        audiencia,
        "tribunal"
      );

      adicionarCelulaSelecao(
        linha,
        audiencia,
        "modalidade",
        [
          { valor: "presencial", texto: "Presencial" },
          { valor: "virtual", texto: "Virtual" }
        ]
      );

      adicionarCelulaEditavel(
        linha,
        audiencia,
        "local_link"
      );

      adicionarCelulaSelecao(
        linha,
        audiencia,
        "responsavel_id",
        [
          { valor: "", texto: "Selecione" },

          ...responsaveisAudiencias
            .filter(
              r => r.ativo || r.id === audiencia.responsavel_id
            )
            .map(r => ({
              valor: r.id,
              texto: r.nome
            }))
        ]
      );

      adicionarCelulaSelecao(
        linha,
        audiencia,
        "situacao",
        [
          { valor: "agendada", texto: "Agendada" },
          { valor: "realizada", texto: "Concluída" },
          { valor: "redesignada", texto: "Redesignada" },
          { valor: "cancelada", texto: "Cancelada" }
        ]
      );

      adicionarCelulaEditavel(
        linha,
        audiencia,
        "observacao",
        "textarea"
      );

      lista.appendChild(linha);
    }

    total.textContent =
      `${data?.length || 0} audiência(s)`;

    if (!data?.length) {
      mostrarMensagem("Nenhuma audiência cadastrada.");
    }
  }

  // ==========================================
  // FORMULARIO DE NOVA AUDIENCIA
  // ==========================================

  botaoNovo.addEventListener("click", async () => {
    if (!autorizado || botaoNovo.disabled) return;

    botaoNovo.disabled = true;

    try {
      await verificarSessaoAudiencia();
      await carregarSugestoesClientesAudiencia();

      formulario.reset();

      formulario.elements.namedItem("id").value = "";

      document.getElementById(
        "tituloModalAudiencia"
      ).textContent = "Cadastrar audiência";

      botaoSalvar.disabled = false;
      modal.showModal();
    } catch (erro) {
      console.error(
        "Erro ao abrir Nova audiência:",
        erro
      );

      alert(
        "Não foi possível preparar o formulário de audiência."
      );
    } finally {
      botaoNovo.disabled = !autorizado;
    }
  });

  botaoCancelar.addEventListener(
    "click",
    () => modal.close()
  );

  function obterDadosAudiencia() {
    const dados = new FormData(formulario);

    return {
      numero_processo: valorOuNulo(
        dados.get("numero_processo")
      ),

      cliente: validarClienteAudiencia(
        dados.get("cliente")
      ),

      tribunal: valorOuNulo(
        dados.get("tribunal")
      ),

      data_audiencia: validarDataAudiencia(
        dados.get("data_audiencia")
      ),

      horario: dados.get("horario"),

      modalidade: dados.get("modalidade"),

      local_link: valorOuNulo(
        dados.get("local_link")
      ),

      responsavel_id: valorOuNulo(
        dados.get("responsavel_id")
      ),

      situacao: dados.get("situacao"),

      observacao: valorOuNulo(
        dados.get("observacao")
      )
    };
  }

  formulario.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (salvandoFormulario || botaoSalvar.disabled) return;

    salvandoFormulario = true;
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    let gravado = false;

    try {
      await verificarSessaoAudiencia();

      if (!formulario.reportValidity()) return;

      const dados = obterDadosAudiencia();

      const id = formulario.elements.namedItem("id").value;

      const consulta = id
        ? cliente
            .from("bonavere_audiencias")
            .update(dados)
            .eq("id", id)
        : cliente
            .from("bonavere_audiencias")
            .insert(dados);

      const { data, error } =
        await consulta.select("id");

      if (error) throw error;

      if (!data || data.length !== 1) {
        throw new Error(
          "O banco não confirmou a gravação."
        );
      }

      gravado = true;
      modal.close();

      await carregarAudiencias();

      alert("Audiência salva com sucesso!");
    } catch (erro) {
      console.error(
        "Erro ao salvar audiência:",
        erro
      );

      alert(
        gravado
          ? "Audiência salva, mas não foi possível atualizar a tabela."
          : (
              erro.message ||
              "Não foi possível salvar a audiência."
            )
      );
    } finally {
      salvandoFormulario = false;
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar audiência";
    }
  });

  // ==========================================
  // INICIALIZACAO
  // ==========================================

  async function iniciarAudiencias() {
    botaoNovo.disabled = true;
    botaoSalvar.disabled = true;

    try {
      autorizado = await conferirAcesso();

      if (!autorizado) {
        mostrarMensagem("Acesso não autorizado.");
        return;
      }

      window.GestorBCASessao.iniciarMonitoramento(
        cliente
      );

      await carregarResponsaveisAudiencias();
      await carregarAudiencias();

      botaoNovo.disabled = false;
    } catch (erro) {
      console.error(
        "Erro ao iniciar Audiências:",
        erro
      );

      mostrarMensagem(
        "Não foi possível carregar as audiências."
      );
    }
  }

  iniciarAudiencias();
})();
