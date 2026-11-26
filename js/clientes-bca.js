
"use strict";

// ==========================================
// GESTOR BCA - CLIENTES DA CONTABILIDADE
// ==========================================

(() => {
  const botaoNovo = document.getElementById("novoClienteBCA");
  const pesquisa = document.getElementById("pesquisarClientesBCA");
  const lista = document.getElementById("listaClientesBCA");
  const mensagem = document.getElementById("mensagemClientesBCA");

  const modal = document.getElementById("modalClienteBCA");
  const formulario = document.getElementById("formClienteBCA");
  const botaoSalvar = document.getElementById("salvarClienteBCA");
  const botaoCancelar = document.getElementById("cancelarClienteBCA");
  const tituloModal = document.getElementById("tituloModalClienteBCA");

  if (
    !botaoNovo || !pesquisa || !lista || !mensagem ||
    !modal || !formulario || !botaoSalvar ||
    !botaoCancelar || !tituloModal
  ) {
    return;
  }

  let supabaseBCA = null;
  let clientesEmMemoria = [];
  let salvando = false;
  let acessoLiberado = false;

  const campo = nome => formulario.elements.namedItem(nome);

  function somenteNumeros(valor) {
    return String(valor ?? "").replace(/\D/g, "");
  }

  function validarCPF(cpf) {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) {
      return false;
    }

    for (let tamanho = 9; tamanho <= 10; tamanho++) {
      let soma = 0;

      for (let i = 0; i < tamanho; i++) {
        soma += Number(cpf[i]) * (tamanho + 1 - i);
      }

      const resto = (soma * 10) % 11;
      const digito = resto === 10 ? 0 : resto;

      if (Number(cpf[tamanho]) !== digito) {
        return false;
      }
    }

    return true;
  }

  function validarCNPJ(cnpj) {
    if (!/^\d{14}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) {
      return false;
    }

    const calcularDigito = (base, pesos) => {
      const soma = [...base].reduce(
        (total, numero, indice) =>
          total + Number(numero) * pesos[indice],
        0
      );

      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };

    const primeiro = calcularDigito(
      cnpj.slice(0, 12),
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    );

    if (primeiro !== Number(cnpj[12])) {
      return false;
    }

    const segundo = calcularDigito(
      cnpj.slice(0, 13),
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    );

    return segundo === Number(cnpj[13]);
  }

  function documentoValido(documento) {
    if (documento.length === 11) {
      return validarCPF(documento);
    }

    if (documento.length === 14) {
      return validarCNPJ(documento);
    }

    return false;
  }

  function formatarDocumento(valor) {
    const documento = somenteNumeros(valor);

    if (documento.length === 11) {
      return documento.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
      );
    }

    if (documento.length === 14) {
      return documento.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        "$1.$2.$3/$4-$5"
      );
    }

    return documento;
  }

  function atualizarMensagem(texto) {
    mensagem.textContent = texto;
  }

  function renderizarClientes() {
    lista.replaceChildren();

    const termo = pesquisa.value
      .trim()
      .toLocaleLowerCase("pt-BR");

    const termoNumerico = somenteNumeros(termo);

    const filtrados = clientesEmMemoria.filter(cliente => {
      const nome = String(cliente.nome ?? "")
        .toLocaleLowerCase("pt-BR");

      const documento = String(cliente.cpf_cnpj ?? "");

      return (
        nome.includes(termo) ||
        (termoNumerico.length > 0 &&
          documento.includes(termoNumerico))
      );
    });

    for (const cliente of filtrados) {
      const linha = document.createElement("tr");

      const valores = [
        cliente.nome,
        formatarDocumento(cliente.cpf_cnpj),
        cliente.contato || "—",
        cliente.cliente_fixo ? "Sim" : "Não",
        cliente.ativo ? "Ativo" : "Inativo"
      ];

      for (const valor of valores) {
        const celula = document.createElement("td");
        celula.textContent = valor;
        linha.appendChild(celula);
      }

      const celulaAcoes = document.createElement("td");
      const editar = document.createElement("button");

      editar.type = "button";
      editar.className = "botao-editar-cliente-bca";
      editar.textContent = "Editar";

      editar.addEventListener("click", () => {
        abrirEdicao(cliente);
      });

      celulaAcoes.appendChild(editar);
      linha.appendChild(celulaAcoes);
      lista.appendChild(linha);
    }

    atualizarMensagem(
      `${filtrados.length} cliente(s) encontrado(s).`
    );
  }

  async function carregarClientes() {
    const { data, error } = await supabaseBCA
      .from("bca_clientes")
      .select(
        "id, nome, cpf_cnpj, contato, cliente_fixo, ativo"
      )
      .order("nome", { ascending: true })
      .limit(1000);

    if (error) throw error;

    clientesEmMemoria = data || [];
    renderizarClientes();
  }

  function abrirNovo() {
    if (!acessoLiberado) return;

    formulario.reset();
    campo("id").value = "";
    campo("ativo").checked = true;

    tituloModal.textContent = "Novo cliente";
    modal.showModal();
  }

  function abrirEdicao(cliente) {
    if (!acessoLiberado) return;

    formulario.reset();

    campo("id").value = cliente.id;
    campo("nome").value = cliente.nome;
    campo("cpf_cnpj").value = formatarDocumento(
      cliente.cpf_cnpj
    );
    campo("contato").value = cliente.contato || "";
    campo("cliente_fixo").checked =
      cliente.cliente_fixo === true;
    campo("ativo").checked = cliente.ativo === true;

    tituloModal.textContent = "Editar cliente";
    modal.showModal();
  }

  async function verificarAcesso() {
    if (!window.GestorBCASessao || !supabaseBCA) {
      throw new Error("Sessão indisponível.");
    }

    const sessao = window.GestorBCASessao;
    const ultima = sessao.obterUltimaAtividade();
    const agora = Date.now();

    if (
      ultima === null ||
      ultima > agora ||
      agora - ultima >= sessao.TEMPO_INATIVIDADE
    ) {
      await sessao.encerrarPorInatividade(supabaseBCA);
      throw new Error("Sessão expirada.");
    }

    const { data, error } = await supabaseBCA.auth.getUser();

    if (error || !data?.user) {
      throw new Error("Usuário não autenticado.");
    }

    const { data: perfil, error: erroPerfil } =
      await supabaseBCA
        .from("perfis")
        .select("autorizado")
        .eq("id", data.user.id)
        .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    if (perfil?.autorizado !== true) {
      throw new Error("Usuário não autorizado.");
    }
  }

  botaoNovo.addEventListener("click", abrirNovo);

  botaoCancelar.addEventListener("click", () => {
    if (!salvando) modal.close();
  });

  pesquisa.addEventListener("input", renderizarClientes);

  formulario.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (salvando || !acessoLiberado) return;
    if (!formulario.reportValidity()) return;

    const id = campo("id").value.trim();
    const nome = campo("nome").value.trim();
    const documento = somenteNumeros(campo("cpf_cnpj").value);
    const contato = campo("contato").value.trim();

    if (!nome) {
      alert("Informe o nome ou razão social.");
      return;
    }

    if (!documentoValido(documento)) {
      alert("Informe um CPF ou CNPJ válido.");
      return;
    }

    const duplicado = clientesEmMemoria.some(cliente =>
      cliente.cpf_cnpj === documento &&
      cliente.id !== id
    );

    if (duplicado) {
      alert("Este CPF ou CNPJ já está cadastrado.");
      return;
    }

    const registro = {
      nome,
      cpf_cnpj: documento,
      contato: contato || null,
      cliente_fixo: campo("cliente_fixo").checked,
      ativo: campo("ativo").checked,
      atualizado_em: new Date().toISOString()
    };

    salvando = true;
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    let gravado = false;

    try {
      await verificarAcesso();

      let consulta = supabaseBCA.from("bca_clientes");

      if (id) {
        consulta = consulta.update(registro).eq("id", id);
      } else {
        consulta = consulta.insert(registro);
      }

      const { data, error } = await consulta
        .select("id")
        .single();

      if (error) throw error;

      if (!data?.id) {
        throw new Error("Gravação não confirmada.");
      }

      gravado = true;
      modal.close();

      await carregarClientes();

    } catch (erro) {
      console.error("Erro ao salvar cliente BCA:", erro);

      if (gravado) {
        alert(
          "Cliente salvo, mas não foi possível atualizar a lista."
        );
      } else if (erro.code === "23505") {
        alert("Este CPF ou CNPJ já está cadastrado.");
      } else {
        alert("Não foi possível salvar o cliente.");
      }
    } finally {
      salvando = false;
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar cliente";
    }
  });

  async function iniciarClientes() {
    try {
      if (!window.GestorBCASessao) {
        throw new Error("Sessão indisponível.");
      }

      supabaseBCA = window.GestorBCASessao.criarCliente();

      await verificarAcesso();

      atualizarMensagem("Carregando clientes...");
      await carregarClientes();

      acessoLiberado = true;
      botaoNovo.disabled = false;
      pesquisa.disabled = false;

    } catch (erro) {
      console.error("Erro ao iniciar clientes BCA:", erro);
      atualizarMensagem(
        "Não foi possível carregar os clientes."
      );
    }
  }

  iniciarClientes();
})();
