
"use strict";

// ==========================================
// GESTOR BCA - CLIENTES DO BONAVERE
// ==========================================

(() => {
  const lista = document.getElementById(
    "listaClientesBonavere"
  );

  const total = document.getElementById(
    "totalClientesBonavere"
  );

  const pesquisa = document.getElementById(
    "pesquisarClienteBonavere"
  );

  const botaoNovo = document.getElementById(
    "novoClienteBonavere"
  );

  const modal = document.getElementById(
    "modalClienteBonavere"
  );

  const formulario = document.getElementById(
    "formClienteBonavere"
  );

  const botaoSalvar = document.getElementById(
    "salvarClienteBonavere"
  );

  const botaoCancelar = document.getElementById(
    "cancelarClienteBonavere"
  );

  if (
    !lista || !total || !pesquisa || !botaoNovo ||
    !modal || !formulario || !botaoSalvar ||
    !botaoCancelar
  ) {
    console.error("Elementos do módulo Clientes ausentes.");
    return;
  }

  let cliente = null;
  let usuarioAtual = null;
  let podeEditar = false;
  let clientesCadastrados = [];
  let salvando = false;

  // ==========================================
  // FUNCOES AUXILIARES
  // ==========================================

  function textoOuNulo(valor) {
    return String(valor ?? "").trim() || null;
  }

  // Mesmo criterio de normalizacao do indice
  // de unicidade criado no Supabase.
  function normalizarNomeCliente(nome) {
    return String(nome ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pt-BR");
  }

  function verificarNomeDuplicado(nome, idAtual) {
    const nomeNormalizado = normalizarNomeCliente(nome);

    return clientesCadastrados.some(registro =>
      registro.id !== idAtual &&
      normalizarNomeCliente(registro.nome_completo) ===
        nomeNormalizado
    );
  }

  function erroDeNomeDuplicado(erro) {
    return erro?.code === "23505" &&
      (
        String(erro?.message ?? "").includes(
          "bonavere_clientes_nome_unico"
        ) ||
        String(erro?.details ?? "").includes(
          "nome_completo"
        )
      );
  }

  function mostrarMensagem(mensagem) {
    const linha = document.createElement("tr");
    const celula = document.createElement("td");

    celula.colSpan = 5;
    celula.className = "vazio";
    celula.textContent = mensagem;

    linha.appendChild(celula);
    lista.replaceChildren(linha);
  }

  function adicionarCelula(linha, valor) {
    const celula = document.createElement("td");

    celula.textContent = valor ?? "—";
    linha.appendChild(celula);

    return celula;
  }

  // ==========================================
  // SEGURANCA E PERMISSOES
  // ==========================================

  async function verificarAcesso() {
    const sessao = window.GestorBCASessao;

    if (!sessao || !cliente) {
      throw new Error(
        "Controle de sessão indisponível."
      );
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
        .select("master, autorizado")
        .eq("id", data.user.id)
        .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    if (perfil?.autorizado !== true) {
      throw new Error("Usuário não autorizado.");
    }

    usuarioAtual = data.user;

    if (perfil.master === true) {
      podeEditar = true;
      return true;
    }

    const { data: permissao, error: erroPermissao } =
      await cliente
        .from("permissoes")
        .select("nivel")
        .eq("user_id", usuarioAtual.id)
        .eq("modulo", "bonavere")
        .maybeSingle();

    if (erroPermissao) throw erroPermissao;

    podeEditar = permissao?.nivel === "editar";

    return (
      podeEditar ||
      permissao?.nivel === "ver"
    );
  }

  // ==========================================
  // LISTAGEM E PESQUISA
  // ==========================================

  function renderizarClientes() {
    const termo = pesquisa.value
      .trim()
      .toLocaleLowerCase("pt-BR");

    const filtrados = clientesCadastrados
      .filter(registro =>
        registro.nome_completo
          .toLocaleLowerCase("pt-BR")
          .includes(termo)
      )
      .sort((a, b) =>
        a.nome_completo.localeCompare(
          b.nome_completo,
          "pt-BR",
          { sensitivity: "base" }
        )
      );

    lista.replaceChildren();

    let letraAtual = "";

    for (const registro of filtrados) {
      const primeiraLetra = registro.nome_completo
        .trim()
        .charAt(0)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleUpperCase("pt-BR");

      const letra = /^[A-Z]$/.test(primeiraLetra)
        ? primeiraLetra
        : "#";

      if (letra !== letraAtual) {
        letraAtual = letra;

        const linhaLetra = document.createElement("tr");
        linhaLetra.className = "cliente-grupo-letra";

        const celulaLetra = document.createElement("td");
        celulaLetra.colSpan = 5;
        celulaLetra.textContent = letra;

        linhaLetra.appendChild(celulaLetra);
        lista.appendChild(linhaLetra);
      }

      const linha = document.createElement("tr");

      adicionarCelula(linha, registro.nome_completo);
      adicionarCelula(
        linha,
        registro.endereco || "—"
      );
      adicionarCelula(
        linha,
        registro.telefone || "—"
      );
      adicionarCelula(
        linha,
        registro.ativo ? "Ativo" : "Inativo"
      );

      const celulaAcoes = document.createElement("td");

      if (podeEditar) {
        const editar = document.createElement("button");

        editar.type = "button";
        editar.className = "botao-editar-cliente";
        editar.textContent = "Editar";

        editar.addEventListener("click", () => {
          abrirFormulario(registro);
        });

        celulaAcoes.appendChild(editar);
      } else {
        celulaAcoes.textContent = "Somente leitura";
      }

      linha.appendChild(celulaAcoes);
      lista.appendChild(linha);
    }

    if (filtrados.length === 0) {
      mostrarMensagem("Nenhum cliente encontrado.");
    }

    total.textContent =
      `${filtrados.length} de ` +
      `${clientesCadastrados.length} cliente(s)`;
  }

  async function carregarClientes() {
    mostrarMensagem("Carregando clientes...");

    const { data, error } = await cliente
      .from("bonavere_clientes")
      .select(
        "id, nome_completo, endereco, telefone, ativo"
      )
      .order("nome_completo", { ascending: true })
      .limit(1000);

    if (error) throw error;

    clientesCadastrados = data || [];

    renderizarClientes();
  }

  pesquisa.addEventListener(
    "input",
    renderizarClientes
  );

  // ==========================================
  // FORMULARIO DE CLIENTES
  // ==========================================

  function abrirFormulario(registro = null) {
    if (!podeEditar || botaoNovo.disabled) return;

    formulario.reset();

    formulario.elements.namedItem("id").value =
      registro?.id || "";

    formulario.elements.namedItem(
      "nome_completo"
    ).value = registro?.nome_completo || "";

    formulario.elements.namedItem(
      "endereco"
    ).value = registro?.endereco || "";

    formulario.elements.namedItem(
      "telefone"
    ).value = registro?.telefone || "";

    formulario.elements.namedItem(
      "ativo"
    ).value = String(registro?.ativo ?? true);

    document.getElementById(
      "tituloModalClienteBonavere"
    ).textContent = registro
      ? "Editar cliente"
      : "Cadastrar cliente";

    botaoSalvar.disabled = false;

    modal.showModal();
  }

  botaoNovo.addEventListener("click", () => {
    abrirFormulario();
  });

  botaoCancelar.addEventListener("click", () => {
    modal.close();
  });

  // ==========================================
  // CADASTRAR E EDITAR
  // ==========================================

  formulario.addEventListener(
    "submit",
    async evento => {
      evento.preventDefault();

      if (salvando || !podeEditar) return;

      salvando = true;
      botaoSalvar.disabled = true;
      botaoSalvar.textContent = "Salvando...";

      let gravado = false;

      try {
        const autorizado = await verificarAcesso();

        if (!autorizado || !podeEditar) {
          throw new Error(
            "Usuário sem permissão de edição."
          );
        }

        if (!formulario.reportValidity()) return;

        const campos = new FormData(formulario);

        const id = textoOuNulo(
          campos.get("id")
        );

        const nome = textoOuNulo(
          campos.get("nome_completo")
        );

        if (!nome) {
          throw new Error(
            "Informe o nome completo do cliente."
          );
        }

        // Impedir nome duplicado antes de salvar.
        // Na edicao, ignora o proprio registro.
        if (verificarNomeDuplicado(nome, id)) {
          throw new Error(
            "Já existe um cliente cadastrado com esse nome."
          );
        }

        const dados = {
          nome_completo: nome,

          endereco: textoOuNulo(
            campos.get("endereco")
          ),

          telefone: textoOuNulo(
            campos.get("telefone")
          ),

          ativo: campos.get("ativo") === "true"
        };

        let consulta;

        if (id) {
          consulta = cliente
            .from("bonavere_clientes")
            .update(dados)
            .eq("id", id);
        } else {
          consulta = cliente
            .from("bonavere_clientes")
            .insert(dados);
        }

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

        await carregarClientes();

        alert(
          id
            ? "Cliente atualizado com sucesso!"
            : "Cliente cadastrado com sucesso!"
        );

      } catch (erro) {
        console.error(
          "Erro ao salvar cliente:",
          erro
        );

        const mensagem = gravado
          ? "Cliente salvo, mas a lista não foi atualizada."
          : erroDeNomeDuplicado(erro)
            ? "Já existe um cliente cadastrado com esse nome."
            : erro?.message ===
              "Já existe um cliente cadastrado com esse nome."
              ? erro.message
              : "Não foi possível salvar o cliente.";

        alert(mensagem);

      } finally {
        salvando = false;
        botaoSalvar.disabled = !podeEditar;
        botaoSalvar.textContent = "Salvar cliente";
      }
    }
  );

  // ==========================================
  // INICIALIZACAO
  // ==========================================

  async function iniciarClientes() {
    botaoNovo.disabled = true;
    botaoSalvar.disabled = true;

    try {
      if (!window.GestorBCASessao) {
        throw new Error(
          "Controle de sessão indisponível."
        );
      }

      cliente = window.GestorBCASessao.criarCliente();

      const autorizado = await verificarAcesso();

      if (!autorizado) {
        mostrarMensagem(
          "Você não possui acesso aos clientes."
        );
        return;
      }

      window.GestorBCASessao.iniciarMonitoramento(
        cliente
      );

      botaoNovo.disabled = !podeEditar;

      await carregarClientes();

    } catch (erro) {
      console.error(
        "Erro ao iniciar Clientes:",
        erro
      );

      botaoNovo.disabled = true;

      mostrarMensagem(
        "Não foi possível carregar os clientes."
      );
    }
  }

  iniciarClientes();
})();
