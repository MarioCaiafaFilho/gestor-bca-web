    /*
      CONFIGURAÇÃO DO SUPABASE

      Coloque somente a chave pública.
      Nunca coloque a chave secret ou service_role.
    */

    const SUPABASE_URL =
      "https://pdvipfzbtpsuenpumktb.supabase.co";

    const SUPABASE_PUBLIC_KEY =
      "sb_publishable_IOUb057J98PySmHjKai1Eg_mR4rSIjB";

    const SITE_URL =
      "https://mariocaiafafilho.github.io/gestor-bca-web/";

    const botaoEntrar =
      document.getElementById("botaoEntrar");

    const botaoSair =
      document.getElementById("botaoSair");

    const mensagem =
      document.getElementById("mensagem");

    function mostrarMensagem(texto) {
      mensagem.textContent = texto;
    }

    function mostrarDesconectado() {
      botaoEntrar.classList.remove("oculto");
      botaoSair.classList.add("oculto");
      botaoEntrar.disabled = false;

      mostrarMensagem(
        "Utilize uma conta Google autorizada " +
        "para acessar o sistema."
      );
    }

    function mostrarAutenticado(usuario) {
      botaoEntrar.classList.add("oculto");
      botaoSair.classList.remove("oculto");

      mostrarMensagem(
        "Conta Google autenticada: " +
        (usuario.email || "E-mail não disponível") +
        ". O acesso aos módulos será liberado " +
        "conforme as permissões do sistema."
      );
    }

    if (
      SUPABASE_PUBLIC_KEY ===
      "scole"
    ) {
      mostrarMensagem(
        "Configure a chave pública do Supabase " +
        "no arquivo index.html."
      );

    } else if (!window.supabase) {
      mostrarMensagem(
        "Não foi possível carregar o Supabase."
      );

    } else {
      const cliente = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY
      );

      botaoEntrar.addEventListener(
        "click",
        async () => {
          botaoEntrar.disabled = true;

          mostrarMensagem("Abrindo login Google...");

          try {
            const { error } =
              await cliente.auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: SITE_URL
                }
              });

            if (error) {
              throw error;
            }

          } catch (error) {
            mostrarMensagem(
              "Erro ao entrar: " + error.message
            );

            botaoEntrar.disabled = false;
          }
        }
      );

      botaoSair.addEventListener(
        "click",
        async () => {
          const { error } =
            await cliente.auth.signOut();

          if (error) {
            mostrarMensagem(
              "Erro ao sair: " + error.message
            );

            return;
          }

          mostrarDesconectado();
        }
      );

      cliente.auth.onAuthStateChange(
        (_evento, sessao) => {
          if (sessao?.user) {
            mostrarAutenticado(sessao.user);
          } else {
            mostrarDesconectado();
          }
        }
      );

      async function verificarSessao() {
        try {
          const { data, error } =
            await cliente.auth.getUser();

          if (error || !data.user) {
            mostrarDesconectado();
            return;
          }

          mostrarAutenticado(data.user);

        } catch (error) {
          mostrarMensagem(
            "Não foi possível verificar a sessão."
          );
        }
      }

      verificarSessao();
    }
