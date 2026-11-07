
"use strict";

// GESTOR BCA - MODULO BONAVERE
// Leitura dos processos e organizacao da planilha.

// Use a mesma chave publica do js/login.js.
// Nunca utilize uma chave secret ou service_role.
const SUPABASE_URL = "https://pdvipfzbtpsuenpumktb.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

const tabelaAbertos = document.getElementById("processosAbertos");
const tabelaFechados = document.getElementById("processosFechados");
const totalAbertos = document.getElementById("totalAbertos");
const totalFechados = document.getElementById("totalFechados");

const situacoes = {
  aberta: "Aberta",
  em_processo: "Em processo",
  concluida: "Concluída",
  nada_a_fazer: "Nada a fazer"
};

function mensagemTabela(tabela, mensagem) {
  tabela.replaceChildren();

  const linha = document.createElement("tr");
  const celula = document.createElement("td");

  celula.colSpan = 9;
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
    Date.UTC(partes[0], partes[1] - 1, partes[2]) /
    86400000
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

function aplicarCorVencimento(celula, processo) {
  if (
    !processo.vencimento ||
    processo.status === "concluida" ||
    processo.status === "nada_a_fazer"
  ) {
    return;
  }

  const dias = diasAteVencimento(processo.vencimento);

  if (dias === null || dias > 7) return;

  // Comeca com vermelho suave aos 7 dias.
  // Chega ao vermelho intenso no vencimento.
  const intensidade = dias <= 0
    ? 1
    : (7 - dias) / 7;

  const inicio = [255, 242, 239];
  const fim = [220, 53, 53];

  const cor = inicio.map((valor, indice) =>
    Math.round(
      valor + (fim[indice] - valor) * intensidade
    )
  );

  celula.style.backgroundColor =
    `rgb(${cor.join(",")})`;

  celula.style.color =
    intensidade >= 0.65 ? "#ffffff" : "#752a2a";

  celula.style.fontWeight = "bold";

  if (dias < 0) {
    celula.title = "Prazo vencido";
  } else if (dias === 0) {
    celula.title = "Vence hoje";
  } else {
    celula.title = `Faltam ${dias} dias corridos`;
  }
}

function adicionarCelula(linha, valor) {
  const celula = document.createElement("td");
  celula.textContent = valor ?? "—";
  linha.appendChild(celula);
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

  adicionarCelula(linha, processo.numero_processo || "—");
  adicionarCelula(linha, processo.cliente || "—");
  adicionarCelula(linha, formatarData(processo.publicacao));
  adicionarCelula(linha, formatarData(processo.data_limite));

  const celulaVencimento = adicionarCelula(
    linha,
    formatarData(processo.vencimento)
  );

  aplicarCorVencimento(celulaVencimento, processo);

  adicionarCelula(linha, processo.observacao || "—");

  adicionarCelula(
    linha,
    processo.bonavere_responsaveis?.nome || "—"
  );

  adicionarCelula(
    linha,
    processo.bonavere_tipos?.nome || "—"
  );

  adicionarCelula(
    linha,
    situacoes[processo.status] || processo.status
  );

  return linha;
}

function ordenarAbertos(a, b) {
  // Sem data limite sempre primeiro.
  if (!a.data_limite && b.data_limite) return -1;
  if (a.data_limite && !b.data_limite) return 1;

  // Datas mais proximas primeiro.
  if (a.data_limite && b.data_limite) {
    const diferenca = a.data_limite.localeCompare(
      b.data_limite
    );

    if (diferenca !== 0) return diferenca;
  }

  // Desempate pela data de vencimento.
  if (!a.vencimento && b.vencimento) return 1;
  if (a.vencimento && !b.vencimento) return -1;

  if (a.vencimento && b.vencimento) {
    const diferenca = a.vencimento.localeCompare(
      b.vencimento
    );

    if (diferenca !== 0) return diferenca;
  }

  return a.criado_em.localeCompare(b.criado_em);
}

function mostrarProcessos(processos) {
  const abertos = processos
    .filter(p =>
      p.status === "aberta" ||
      p.status === "em_processo"
    )
    .sort(ordenarAbertos);

  const fechados = processos
    .filter(p =>
      p.status === "concluida" ||
      p.status === "nada_a_fazer"
    )
    .sort((a, b) =>
      b.atualizado_em.localeCompare(a.atualizado_em)
    );

  tabelaAbertos.replaceChildren();
  tabelaFechados.replaceChildren();

  for (const processo of abertos) {
    tabelaAbertos.appendChild(criarLinha(processo));
  }

  for (const processo of fechados) {
    tabelaFechados.appendChild(criarLinha(processo));
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

async function iniciarBonavere() {
  if (
    SUPABASE_PUBLIC_KEY ===
    "COLE_AQUI_SUA_CHAVE_PUBLISHABLE"
  ) {
    mensagemTabela(
      tabelaAbertos,
      "Configure a chave pública no arquivo bonavere.js."
    );
    return;
  }

  if (!window.supabase) {
    mensagemTabela(
      tabelaAbertos,
      "Não foi possível carregar a biblioteca Supabase."
    );
    return;
  }

  const clienteSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY
  );

  try {
    mensagemTabela(
      tabelaAbertos,
      "Verificando autenticação..."
    );

    const { data: autenticacao, error: erroAuth } =
      await clienteSupabase.auth.getUser();

    if (erroAuth || !autenticacao.user) {
      window.location.replace("./index.html");
      return;
    }

    mensagemTabela(
      tabelaAbertos,
      "Carregando processos..."
    );

    // Nesta primeira versão, carregamos até 1000 registros.
    // Antes do uso com grande volume, teremos paginação.
    const { data, error } = await clienteSupabase
      .from("bonavere_processos")
      .select(`
        id,
        numero_processo,
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
      .order("criado_em", { ascending: true })
      .limit(1000);

    if (error) throw error;

    mostrarProcessos(data || []);

  } catch (erro) {
    console.error("Erro ao carregar Bonavere:", erro);

    mensagemTabela(
      tabelaAbertos,
      "Não foi possível carregar os processos. " +
      "Verifique o Console do navegador."
    );

    mensagemTabela(
      tabelaFechados,
      "Carregamento indisponível."
    );
  }
}

iniciarBonavere();
