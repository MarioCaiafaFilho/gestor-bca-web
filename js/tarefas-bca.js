
"use strict";

// ==========================================
// GESTOR BCA - TAREFAS DA CONTABILIDADE
// ==========================================

(() => {
  const botaoNovo =
    document.getElementById("novaTarefaBCA");

  const pesquisa =
    document.getElementById("pesquisarTarefasBCA");

  const mensagem =
    document.getElementById("mensagemTarefasBCA");

  const listaAbertas =
    document.getElementById("listaTarefasAbertasBCA");

  const listaFinalizadas =
    document.getElementById("listaTarefasFinalizadasBCA");

  const indicadorTotal =
    document.getElementById("totalTarefasBCA");

  const indicadorAguardando =
    document.getElementById("aguardandoTarefasBCA");

  const indicadorProcesso =
    document.getElementById("processoTarefasBCA");

  if (
    !botaoNovo ||
    !pesquisa ||
    !mensagem ||
    !listaAbertas ||
    !listaFinalizadas ||
    !indicadorTotal ||
    !indicadorAguardando ||
    !indicadorProcesso
  ) {
    return;
  }

  let supabaseTarefasBCA = null;
  let tarefasEmMemoria = [];
  let clientesEmMemoria = [];

  // ==========================================
  // FUNCOES AUXILIARES
  // ==========================================

  function normalizarTexto(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim()
      .replace(/\s+/g, " ");
  }

  function formatarData(valor) {
    if (!valor) return "—";

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(data);
  }

  function nomeStatus(status) {
    const nomes = {
      aguardando_inicio: "Aguardando início",
      aguardando_informacao: "Aguardando informação",
      em_processo: "Em processo",
      finalizado: "Finalizado"
    };

    return nomes[status] || status;
  }

  function obterNomeCliente(clienteId) {
    const cliente = clientesEmMemoria.find(
      item => item.id === clienteId
    );

    return cliente?.nome || "Cliente não localizado";
  }

  // ==========================================
  // INDICADORES
  // ==========================================

  function atualizarIndicadores() {
    indicadorTotal.textContent =
      tarefasEmMemoria.length;

    indicadorAguardando.textContent =
      tarefasEmMemoria.filter(
        tarefa =>
          tarefa.status === "aguardando_informacao"
      ).length;

    indicadorProcesso.textContent =
      tarefasEmMemoria.filter(
        tarefa =>
          tarefa.status === "em_processo"
      ).length;
  }

  // ==========================================
  // CRIAR LINHAS DA TABELA
  // ==========================================

  function criarCelula(linha, valor, classe = "") {
    const celula = document.createElement("td");

    celula.textContent = valor;

    if (classe) {
      celula.className = classe;
    }

    linha.appendChild(celula);

    return celula;
  }

  function criarLinhaTarefa(tarefa, finalizada) {
    const linha = document.createElement("tr");

    criarCelula(
      linha,
      formatarData(tarefa.criado_em)
    );

    criarCelula(
      linha,
      obterNomeCliente(tarefa.cliente_id)
    );

    criarCelula(
      linha,
      tarefa.descricao,
      "descricao-tarefa-bca"
    );

    if (finalizada) {
      criarCelula(
        linha,
        formatarData(tarefa.concluido_em)
      );
    } else {
      const celulaStatus =
        document.createElement("td");

      const status = document.createElement("span");

      status.className =
        `status-tarefa-bca ${tarefa.status}`;

      status.textContent =
        nomeStatus(tarefa.status);

      celulaStatus.appendChild(status);
      linha.appendChild(celulaStatus);
    }

    const celulaAcoes =
      document.createElement("td");

    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = "botao-editar-tarefa-bca";
   
    botao.textContent = "Abrir";
    botao.disabled = false;

    botao.addEventListener("click", () => {
      abrirEdicaoTarefa(tarefa);
    });


    celulaAcoes.appendChild(botao);
    linha.appendChild(celulaAcoes);

    return linha;
  }

  // ==========================================
  // APRESENTAR TAREFAS
  // ==========================================

  function renderizarTarefas() {
    listaAbertas.replaceChildren();
    listaFinalizadas.replaceChildren();

    const termo = normalizarTexto(pesquisa.value);

    const filtradas = tarefasEmMemoria.filter(
      tarefa => normalizarTexto(
        obterNomeCliente(tarefa.cliente_id)
      ).includes(termo)
    );

    const abertas = filtradas.filter(
      tarefa => tarefa.status !== "finalizado"
    );

    const finalizadas = filtradas.filter(
      tarefa => tarefa.status === "finalizado"
    );

    for (const tarefa of abertas) {
      listaAbertas.appendChild(
        criarLinhaTarefa(tarefa, false)
      );
    }

    for (const tarefa of finalizadas) {
      listaFinalizadas.appendChild(
        criarLinhaTarefa(tarefa, true)
      );
    }

    mensagem.textContent =
      `${abertas.length} tarefa(s) em aberto e ` +
      `${finalizadas.length} finalizada(s).`;

    atualizarIndicadores();
  }

  // ==========================================
  // CONSULTAR DADOS NO SUPABASE
  // ==========================================

  async function carregarTarefas() {
    mensagem.textContent = "Carregando tarefas...";

    const { data: clientes, error: erroClientes } =
      await supabaseTarefasBCA
        .from("bca_clientes")
        .select("id, nome, ativo, cliente_fixo")
        .order("nome", { ascending: true })
        .limit(1000);

    if (erroClientes) {
      throw erroClientes;
    }

    const { data: tarefas, error: erroTarefas } =
      await supabaseTarefasBCA
        .from("bca_tarefas")
        .select(
          "id, cliente_id, descricao, status, " +
          "observacoes, criado_em, concluido_em"
        )
        .order("criado_em", { ascending: false })
        .limit(1000);

    if (erroTarefas) {
      throw erroTarefas;
    }

    clientesEmMemoria = clientes || [];
    tarefasEmMemoria = tarefas || [];

    renderizarTarefas();
  }

  // ==========================================
  // INICIAR CONTROLE DE TAREFAS
  // ==========================================

  // ==========================================
  // CADASTRO DE TAREFAS
  // ==========================================

  const modalTarefa =
    document.getElementById("modalTarefaBCA");

  const formularioTarefa =
    document.getElementById("formTarefaBCA");

  const tituloModalTarefa =
    document.getElementById("tituloModalTarefaBCA");

  const salvarTarefa =
    document.getElementById("salvarTarefaBCA");

  const cancelarTarefa =
    document.getElementById("cancelarTarefaBCA");

  const sugestoesClientes =
    document.getElementById("sugestoesClientesTarefaBCA");

  let salvandoTarefa = false;

  function campoTarefa(nome) {
    return formularioTarefa.elements.namedItem(nome);
  }

  function atualizarSugestoesClientes() {
    sugestoesClientes.replaceChildren();

    for (const cliente of clientesEmMemoria) {
      if (cliente.ativo !== true) continue;

      const opcao = document.createElement("option");
      opcao.value = cliente.nome;

      sugestoesClientes.appendChild(opcao);
    }
  }

  async function verificarAcessoTarefas() {
    const sessao = window.GestorBCASessao;

    if (!sessao || !supabaseTarefasBCA) {
      throw new Error("Sessão indisponível.");
    }

    const ultima = sessao.obterUltimaAtividade();
    const agora = Date.now();

    if (
      ultima === null ||
      ultima > agora ||
      agora - ultima >= sessao.TEMPO_INATIVIDADE
    ) {
      await sessao.encerrarPorInatividade(
        supabaseTarefasBCA
      );

      throw new Error("Sessão expirada.");
    }

    const { data, error } =
      await supabaseTarefasBCA.auth.getUser();

    if (error || !data?.user) {
      throw new Error("Usuário não autenticado.");
    }

    const { data: perfil, error: erroPerfil } =
      await supabaseTarefasBCA
        .from("perfis")
        .select("autorizado")
        .eq("id", data.user.id)
        .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    if (perfil?.autorizado !== true) {
      throw new Error("Usuário não autorizado.");
    }
  }

  // Localizar o cliente antes de criar outro.
  async function obterOuCadastrarCliente(nomeInformado) {
    const nome = nomeInformado.trim().replace(/\s+/g, " ");

    if (!nome) {
      throw new Error("Informe o nome do cliente.");
    }

    const nomeNormalizado = normalizarTexto(nome);

    // Atualizar a consulta antes de decidir cadastrar.
    const { data: clientes, error } =
      await supabaseTarefasBCA
        .from("bca_clientes")
        .select("id, nome, ativo")
        .order("nome", { ascending: true })
        .limit(1000);

    if (error) throw error;

    const existente = (clientes || []).find(
      cliente =>
        normalizarTexto(cliente.nome) === nomeNormalizado
    );

    if (existente) {
      if (existente.ativo !== true) {
        throw new Error(
          "Este cliente está inativo. " +
          "Ative-o na aba Clientes antes de cadastrar a tarefa."
        );
      }

      return existente.id;
    }

    // Cliente inexistente: cadastro basico automatico.
    const { data: novoCliente, error: erroCadastro } =
      await supabaseTarefasBCA
        .from("bca_clientes")
        .insert({
          nome,
          cpf_cnpj: null,
          contato: null,
          cliente_fixo: false,
          ativo: true
        })
        .select("id")
        .single();

    
    if (erroCadastro) {

      // Outro usuario pode ter cadastrado
      // o mesmo cliente simultaneamente.
      if (erroCadastro.code === "23505") {

        const { data: clientesAtualizados, error: erroBusca } =
          await supabaseTarefasBCA
            .from("bca_clientes")
            .select("id, nome, ativo")
            .is("cpf_cnpj", null)
            .limit(1000);

        if (erroBusca) throw erroBusca;

        const clienteExistente = (
          clientesAtualizados || []
        ).find(
          cliente =>
            normalizarTexto(cliente.nome) === nomeNormalizado
        );

        if (clienteExistente) {
          if (clienteExistente.ativo !== true) {
            throw new Error(
              "Este cliente está inativo. " +
              "Ative-o na aba Clientes antes de cadastrar a tarefa."
            );
          }

          return clienteExistente.id;
        }
      }

      throw erroCadastro;
    }

    if (!novoCliente?.id) {
      throw new Error(
        "O cadastro automático do cliente não foi confirmado."
      );
    }

        return novoCliente.id;
  }


  // ==========================================
  // ABRIR TAREFA PARA EDICAO
  // ==========================================

  function abrirEdicaoTarefa(tarefa) {
    if (salvandoTarefa) return;

    formularioTarefa.reset();

    campoTarefa("id").value = tarefa.id;

    campoTarefa("cliente").value =
      obterNomeCliente(tarefa.cliente_id);

    campoTarefa("descricao").value =
      tarefa.descricao || "";

    campoTarefa("status").value =
      tarefa.status;

    campoTarefa("observacoes").value =
      tarefa.observacoes || "";

    atualizarSugestoesClientes();

    tituloModalTarefa.textContent = "Editar tarefa";

    modalTarefa.showModal();
  }

  // ==========================================
  // ABRIR NOVA TAREFA
  // ==========================================

  botaoNovo.addEventListener("click", () => {
    if (botaoNovo.disabled || salvandoTarefa) {
      return;
    }

    formularioTarefa.reset();

    campoTarefa("id").value = "";
    campoTarefa("status").value = "aguardando_inicio";

    atualizarSugestoesClientes();

    tituloModalTarefa.textContent = "Nova tarefa";

    modalTarefa.showModal();
  });

  cancelarTarefa.addEventListener("click", () => {
    if (!salvandoTarefa) {
      modalTarefa.close();
    }
  });

  // ==========================================
  // SALVAR NOVA TAREFA
  // ==========================================

  formularioTarefa.addEventListener(
    "submit",
    async evento => {
      evento.preventDefault();

      if (salvandoTarefa) return;
      if (!formularioTarefa.reportValidity()) return;

      const tarefaId =
        campoTarefa("id").value.trim();

      const nomeCliente =
        campoTarefa("cliente").value.trim();

      const descricao =
        campoTarefa("descricao").value.trim();

      const status =
        campoTarefa("status").value;

      const observacoes =
        campoTarefa("observacoes").value.trim();

      const statusPermitidos = [
        "aguardando_inicio",
        "aguardando_informacao",
        "em_processo",
        "finalizado"
      ];

      if (!nomeCliente || !descricao) {
        alert("Informe o cliente e a descrição do serviço.");
        return;
      }

      if (!statusPermitidos.includes(status)) {
        alert("Selecione um status válido.");
        return;
      }

      salvandoTarefa = true;
      salvarTarefa.disabled = true;
      salvarTarefa.textContent = "Salvando...";

      let tarefaGravada = false;

      try {
        await verificarAcessoTarefas();

        const clienteId = await obterOuCadastrarCliente(
          nomeCliente
        );

       
        const tarefaAnterior = tarefaId
          ? tarefasEmMemoria.find(
              item => item.id === tarefaId
            )
          : null;

        if (tarefaId && !tarefaAnterior) {
          throw new Error(
            "Tarefa não localizada. Atualize a página."
          );
        }

        const registro = {
          cliente_id: clienteId,
          descricao,
          status,
          observacoes: observacoes || null,
          concluido_em:
            status === "finalizado"
              ? (
                  tarefaAnterior?.status === "finalizado" &&
                  tarefaAnterior.concluido_em
                    ? tarefaAnterior.concluido_em
                    : new Date().toISOString()
                )
              : null,
          atualizado_em: new Date().toISOString()
        };

        let consulta =
          supabaseTarefasBCA.from("bca_tarefas");

        if (tarefaId) {
          consulta = consulta
            .update(registro)
            .eq("id", tarefaId);
        } else {
          consulta = consulta.insert(registro);
        }

        const { data, error } = await consulta
          .select("id")
          .single();

        if (error) throw error;

        if (!data?.id) {
          throw new Error(
            "O banco não confirmou o salvamento da tarefa."
          );
        }


        tarefaGravada = true;
        modalTarefa.close();

        await carregarTarefas();


        alert(
          tarefaId
            ? "Tarefa atualizada com sucesso!"
            : "Tarefa cadastrada com sucesso!"
        );

      } catch (erro) {
        console.error(
          "Erro ao cadastrar tarefa BCA:",
          erro
        );

        alert(
          tarefaGravada
            ? "Tarefa salva, mas a lista não foi atualizada."
            : erro.message?.includes("inativo")
              ? erro.message
              : "Não foi possível cadastrar a tarefa."
        );

      } finally {
        salvandoTarefa = false;
        salvarTarefa.disabled = false;
        salvarTarefa.textContent = "Salvar tarefa";
      }
    }
  );

  async function iniciarTarefas() {
    try {
      const sessao = window.GestorBCASessao;

      if (!sessao) {
        throw new Error("Controle de sessão indisponível.");
      }

      supabaseTarefasBCA = sessao.criarCliente();

      const { data, error } =
        await supabaseTarefasBCA.auth.getUser();

      if (error || !data?.user) {
        throw new Error("Usuário não autenticado.");
      }

      const ultima = sessao.obterUltimaAtividade();
      const agora = Date.now();

      if (
        ultima === null ||
        ultima > agora ||
        agora - ultima >= sessao.TEMPO_INATIVIDADE
      ) {
        await sessao.encerrarPorInatividade(
          supabaseTarefasBCA
        );

        return;
      }

      const { data: perfil, error: erroPerfil } =
        await supabaseTarefasBCA
          .from("perfis")
          .select("autorizado")
          .eq("id", data.user.id)
          .maybeSingle();

      if (erroPerfil) throw erroPerfil;

      if (perfil?.autorizado !== true) {
        throw new Error("Acesso não autorizado.");
      }

  
      await carregarTarefas();

      pesquisa.disabled = false;
      botaoNovo.disabled = false;


    } catch (erro) {
      console.error(
        "Erro ao carregar tarefas BCA:",
        erro
      );

      mensagem.textContent =
        "Não foi possível carregar as tarefas.";
    }
  }

  pesquisa.addEventListener(
    "input",
    renderizarTarefas
  );

  iniciarTarefas();
})();
