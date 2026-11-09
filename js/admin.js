
"use strict";

// ==========================================
// GESTOR BCA - PAINEL ADMINISTRATIVO
// ==========================================

const SUPABASE_URL =
  "https://pdvipfzbtpsuenpumktb.supabase.co";

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

let clienteSupabase = null;
let acessoMaster = false;

// ==========================================
// ELEMENTOS DA PAGINA
// ==========================================

const mensagemAdmin =
  document.getElementById("mensagemAdmin");

const painelMaster =
  document.getElementById("painelMaster");

const formResponsavel =
  document.getElementById("formResponsavel");

const nomeResponsavel =
  document.getElementById("nomeResponsavel");

const salvarResponsavel =
  document.getElementById("salvarResponsavel");

const mensagemResponsavel =
  document.getElementById("mensagemResponsavel");

const listaResponsaveis =
  document.getElementById("listaResponsaveis");

const formTipo =
  document.getElementById("formTipo");

const nomeTipo =
  document.getElementById("nomeTipo");
const valorTipo =
  document.getElementById("valorTipo");

const salvarTipo =
  document.getElementById("salvarTipo");

const mensagemTipo =
  document.getElementById("mensagemTipo");

const listaTipos =
  document.getElementById("listaTipos");

// ==========================================
// FUNCOES AUXILIARES
// ==========================================

function verificarMaster() {
  if (!acessoMaster || !clienteSupabase) {
    throw new Error(
      "Operação restrita ao administrador Master."
    );
  }
}

function criarBotao(texto, acao) {
  const botao = document.createElement("button");

  botao.type = "button";
  botao.textContent = texto;

  botao.addEventListener("click", acao);

  return botao;
}

function validarNome(nome) {
  return nome.length > 0 && nome.length <= 150;
}

// ==========================================
// LISTAR RESPONSAVEIS
// ==========================================

async function carregarResponsaveis() {
  verificarMaster();

  listaResponsaveis.textContent =
    "Carregando responsáveis...";

  const { data, error } = await clienteSupabase
    .from("bonavere_responsaveis")
    .select("id, nome, ativo")
    .order("nome", { ascending: true });

  if (error) {
    console.error(
      "Erro ao consultar responsáveis:",
      error
    );

    listaResponsaveis.textContent =
      "Não foi possível carregar os responsáveis.";

    throw error;
  }

  listaResponsaveis.replaceChildren();

  if (!data || data.length === 0) {
    listaResponsaveis.textContent =
      "Nenhum responsável cadastrado.";
    return;
  }

  for (const responsavel of data) {
    const item = document.createElement("div");

    item.className = "item-responsavel";

    if (!responsavel.ativo) {
      item.classList.add("inativo");
    }

    const nome = document.createElement("span");

    nome.textContent = responsavel.nome;

    if (!responsavel.ativo) {
      nome.textContent += " (Inativo)";
    }

    const acoes = document.createElement("div");
    acoes.className = "acoes-responsavel";

    const botaoEditar = criarBotao(
      "Editar",
      () => editarResponsavel(responsavel)
    );

    const botaoSituacao = criarBotao(
      responsavel.ativo ? "Desativar" : "Reativar",
      () => alterarAtividadeResponsavel(responsavel)
    );

    acoes.appendChild(botaoEditar);
    acoes.appendChild(botaoSituacao);

    item.appendChild(nome);
    item.appendChild(acoes);

    listaResponsaveis.appendChild(item);
  }
}

// ==========================================
// CADASTRAR RESPONSAVEL
// ==========================================

formResponsavel.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    if (!acessoMaster) {
      mensagemResponsavel.textContent =
        "Você não possui autorização.";
      return;
    }

    const nome = nomeResponsavel.value.trim();

    if (!validarNome(nome)) {
      mensagemResponsavel.textContent =
        "Informe um nome com até 150 caracteres.";
      return;
    }

    salvarResponsavel.disabled = true;
    salvarResponsavel.textContent = "Salvando...";

    mensagemResponsavel.textContent = "";

    try {
      const { data, error } = await clienteSupabase
        .from("bonavere_responsaveis")
        .insert({
          nome,
          ativo: true
        })
        .select("id");

      if (error) throw error;

      if (!data || data.length !== 1) {
        throw new Error(
          "Cadastro não confirmado pelo banco."
        );
      }

      nomeResponsavel.value = "";

      mensagemResponsavel.textContent =
        "Responsável cadastrado com sucesso!";

      await carregarResponsaveis();

    } catch (erro) {
      console.error(
        "Erro ao cadastrar responsável:",
        erro
      );

      mensagemResponsavel.textContent =
        "Não foi possível cadastrar o responsável.";
    } finally {
      salvarResponsavel.disabled = false;
      salvarResponsavel.textContent = "Cadastrar";
    }
  }
);

// ==========================================
// EDITAR NOME DO RESPONSAVEL
// ==========================================

async function editarResponsavel(responsavel) {
  if (!acessoMaster) return;

  const resposta = window.prompt(
    "Digite o novo nome do responsável:",
    responsavel.nome
  );

  if (resposta === null) return;

  const novoNome = resposta.trim();

  if (!validarNome(novoNome)) {
    alert("Informe um nome com até 150 caracteres.");
    return;
  }

  if (novoNome === responsavel.nome) return;

  mensagemResponsavel.textContent =
    "Salvando alteração...";

  try {
    const { data, error } = await clienteSupabase
      .from("bonavere_responsaveis")
      .update({ nome: novoNome })
      .eq("id", responsavel.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "Alteração não confirmada pelo banco."
      );
    }

    await carregarResponsaveis();

    mensagemResponsavel.textContent =
      "Nome atualizado com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao editar responsável:",
      erro
    );

    mensagemResponsavel.textContent =
      "Não foi possível alterar o nome.";
  }
}

// ==========================================
// DESATIVAR OU REATIVAR RESPONSAVEL
// ==========================================

async function alterarAtividadeResponsavel(responsavel) {
  if (!acessoMaster) return;

  const novoEstado = !responsavel.ativo;

  const acao = novoEstado
    ? "reativar"
    : "desativar";

  const confirmado = window.confirm(
    `Deseja ${acao} o responsável "${responsavel.nome}"?`
  );

  if (!confirmado) return;

  mensagemResponsavel.textContent =
    "Atualizando cadastro...";

  try {
    const { data, error } = await clienteSupabase
      .from("bonavere_responsaveis")
      .update({ ativo: novoEstado })
      .eq("id", responsavel.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "Alteração não confirmada pelo banco."
      );
    }

    await carregarResponsaveis();

    mensagemResponsavel.textContent =
      novoEstado
        ? "Responsável reativado com sucesso!"
        : "Responsável desativado com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao alterar situação do responsável:",
      erro
    );

    mensagemResponsavel.textContent =
      "Não foi possível atualizar o responsável.";
  }
}

// ==========================================
// LISTAR TIPOS DE ATIVIDADES
// ==========================================


 // ==========================================
 // LISTAR TIPOS DE ATIVIDADES E VALORES
 // ==========================================

async function carregarTipos() {
  verificarMaster();

  listaTipos.textContent =
    "Carregando tipos de atividades...";

  try {
    // Busca os tipos de atividades.
    const { data: tipos, error: erroTipos } =
      await clienteSupabase
        .from("bonavere_tipos")
        .select("id, nome, ativo")
        .order("nome", { ascending: true });

    if (erroTipos) throw erroTipos;

    // Busca os valores financeiros separadamente.
    // A tabela de precos possui acesso exclusivo
    // ao Master pelas politicas do Supabase.
    const { data: precos, error: erroPrecos } =
      await clienteSupabase
        .from("bonavere_precos")
        .select("tipo_id, valor_atual");

    if (erroPrecos) throw erroPrecos;

    const mapaPrecos = new Map();

    for (const preco of precos || []) {
      mapaPrecos.set(
        preco.tipo_id,
        Number(preco.valor_atual)
      );
    }

    listaTipos.replaceChildren();

    if (!tipos || tipos.length === 0) {
      listaTipos.textContent =
        "Nenhum tipo de atividade cadastrado.";
      return;
    }

    for (const tipo of tipos) {
      const item = document.createElement("div");
      item.className = "item-responsavel";

      if (!tipo.ativo) {
        item.classList.add("inativo");
      }

      const informacoes = document.createElement("div");

      const nome = document.createElement("div");
      nome.textContent =
        tipo.nome + (tipo.ativo ? "" : " (Inativo)");

      const valor = mapaPrecos.get(tipo.id);

      const textoValor = document.createElement("small");

      textoValor.textContent = valor === undefined
        ? "Valor ainda não definido"
        : "Valor: " + valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
          });

      informacoes.appendChild(nome);
      informacoes.appendChild(textoValor);

      const acoes = document.createElement("div");
      acoes.className = "acoes-responsavel";

      const botaoEditar = criarBotao(
        "Editar",
        () => editarTipo(tipo, valor)
      );

      const botaoSituacao = criarBotao(
        tipo.ativo ? "Desativar" : "Reativar",
        () => alterarAtividadeTipo(tipo)
      );

      acoes.appendChild(botaoEditar);
      acoes.appendChild(botaoSituacao);

      item.appendChild(informacoes);
      item.appendChild(acoes);

      listaTipos.appendChild(item);
    }

  } catch (erro) {
    console.error(
      "Erro ao carregar tipos e valores:",
      erro
    );

    listaTipos.textContent =
      "Não foi possível carregar as atividades e seus valores.";

    throw erro;
  }
}


// ==========================================
// EDITAR NOME E VALOR DA ATIVIDADE
// ==========================================

async function editarTipo(tipo, valorAtual) {
  if (!acessoMaster || !clienteSupabase) return;

  const respostaNome = window.prompt(
    "Nome da atividade:",
    tipo.nome
  );

  if (respostaNome === null) return;

  const novoNome = respostaNome.trim();

  if (!validarNome(novoNome)) {
    alert("Informe um nome com até 150 caracteres.");
    return;
  }

  const valorAnterior = valorAtual === undefined
    ? ""
    : valorAtual.toFixed(2).replace(".", ",");

  const respostaValor = window.prompt(
    "Valor da atividade (R$):",
    valorAnterior
  );

  if (respostaValor === null) return;

  const textoValor = respostaValor.trim()
    .replace(",", ".");

  const novoValor = Number(textoValor);

  if (
    textoValor === "" ||
    !Number.isFinite(novoValor) ||
    novoValor < 0 ||
    novoValor > 9999999999.99 ||
    Math.abs(
      novoValor * 100 - Math.round(novoValor * 100)
    ) > 0.000001
  ) {
    alert(
      "Informe um valor válido com até duas casas decimais."
    );
    return;
  }

  if (
    novoNome === tipo.nome &&
    valorAtual !== undefined &&
    novoValor === valorAtual
  ) {
    return;
  }

  mensagemTipo.textContent =
    "Salvando alterações...";

  try {
    const { error } = await clienteSupabase
      .rpc("bonavere_editar_tipo_com_valor", {
        p_tipo_id: tipo.id,
        p_nome: novoNome,
        p_valor: novoValor
      });

    if (error) throw error;

    await carregarTipos();

    mensagemTipo.textContent =
      "Nome e valor atualizados com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao editar atividade:",
      erro
    );

    mensagemTipo.textContent =
      "Não foi possível atualizar a atividade.";
  }
}


// ==========================================
// DESATIVAR OU REATIVAR TIPO DE ATIVIDADE
// ==========================================

async function alterarAtividadeTipo(tipo) {
  if (!acessoMaster || !clienteSupabase) return;

  const novoEstado = !tipo.ativo;

  const acao = novoEstado
    ? "reativar"
    : "desativar";

  const confirmado = window.confirm(
    `Deseja ${acao} a atividade "${tipo.nome}"?`
  );

  if (!confirmado) return;

  mensagemTipo.textContent =
    "Atualizando situação da atividade...";

  try {
    const { data, error } = await clienteSupabase
      .from("bonavere_tipos")
      .update({ ativo: novoEstado })
      .eq("id", tipo.id)
      .select("id");

    if (error) throw error;

    if (!data || data.length !== 1) {
      throw new Error(
        "Alteração não confirmada pelo banco."
      );
    }

    await carregarTipos();

    mensagemTipo.textContent = novoEstado
      ? "Atividade reativada com sucesso!"
      : "Atividade desativada com sucesso!";

  } catch (erro) {
    console.error(
      "Erro ao alterar situação da atividade:",
      erro
    );

    mensagemTipo.textContent =
      "Não foi possível alterar a situação da atividade.";
  }
}

// ==========================================
// CADASTRAR TIPO DE ATIVIDADE
// ==========================================

 // ==========================================
 // CADASTRAR TIPO DE ATIVIDADE
 // ==========================================

formTipo.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    if (!acessoMaster || !clienteSupabase) {
      mensagemTipo.textContent =
        "Você não possui autorização.";
      return;
    }

    const nome = nomeTipo.value.trim();
    const valorInformado = valorTipo.value.trim();
    const valor = Number(valorInformado);

    if (!validarNome(nome)) {
      mensagemTipo.textContent =
        "Informe uma atividade com até 150 caracteres.";
      return;
    }

    if (
      valorInformado === "" ||
      !Number.isFinite(valor) ||
      valor < 0 ||
      valor > 9999999999.99 ||
      Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001
    ) {
      mensagemTipo.textContent =
        "Informe um valor válido em reais, com até duas casas decimais.";
      return;
    }

    salvarTipo.disabled = true;
    salvarTipo.textContent = "Salvando...";
    mensagemTipo.textContent = "";

    try {
      const { data, error } = await clienteSupabase
        .rpc("bonavere_cadastrar_tipo_com_valor", {
          p_nome: nome,
          p_valor: valor
        });

      if (error) throw error;

      if (!data) {
        throw new Error(
          "O cadastro não foi confirmado pelo banco."
        );
      }

      nomeTipo.value = "";
      valorTipo.value = "";

      await carregarTipos();

      mensagemTipo.textContent =
        "Atividade e valor cadastrados com sucesso!";

    } catch (erro) {
      console.error(
        "Erro ao cadastrar atividade com valor:",
        erro
      );

      mensagemTipo.textContent =
        "Não foi possível cadastrar a atividade. Verifique os dados ou consulte o console.";

    } finally {
      salvarTipo.disabled = false;
      salvarTipo.textContent = "Cadastrar";
    }
  }
);


// ==========================================
// VERIFICAR ACESSO MASTER
// ==========================================

async function iniciarAdministracao() {
  painelMaster.classList.add("oculto");

  salvarResponsavel.disabled = true;
  salvarTipo.disabled = true;

  acessoMaster = false;

  try {
    if (
      SUPABASE_PUBLIC_KEY ===
      "COLE_AQUI_SUA_CHAVE_PUBLISHABLE"
    ) {
      throw new Error(
        "Chave pública não configurada."
      );
    }

    if (!window.supabase) {
      throw new Error(
        "Biblioteca Supabase indisponível."
      );
    }

    clienteSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );

    const { data, error } =
      await clienteSupabase.auth.getUser();

    if (error || !data.user) {
      window.location.replace("./index.html");
      return;
    }

    const {
      data: perfil,
      error: erroPerfil
    } = await clienteSupabase
      .from("perfis")
      .select("master, autorizado")
      .eq("id", data.user.id)
      .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    if (
      !perfil ||
      perfil.master !== true ||
      perfil.autorizado !== true
    ) {
      mensagemAdmin.textContent =
        "Acesso restrito ao administrador Master.";
      return;
    }

    acessoMaster = true;

    painelMaster.classList.remove("oculto");
    mensagemAdmin.textContent = "";

    salvarResponsavel.disabled = false;
    salvarTipo.disabled = false;

    await Promise.all([
      carregarResponsaveis(),
      carregarTipos()
    ]);

  } catch (erro) {
    console.error(
      "Erro no painel administrativo:",
      erro
    );

    acessoMaster = false;
    painelMaster.classList.add("oculto");

    salvarResponsavel.disabled = true;
    salvarTipo.disabled = true;

    mensagemAdmin.textContent =
      "Não foi possível verificar o acesso administrativo.";
  }
}

iniciarAdministracao();
