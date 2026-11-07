
-- GESTOR BCA
-- 01_login_permissoes.sql
-- Configuracao inicial de usuarios e permissoes.
-- Executar uma unica vez em um projeto Supabase novo.

BEGIN;

-- 1. Lista de e-mails autorizados.
CREATE TABLE public.emails_autorizados (
  email text PRIMARY KEY,
  nome text,
  master boolean NOT NULL DEFAULT false
);

-- 2. Perfis associados ao login Google.
CREATE TABLE public.perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id)
    ON DELETE CASCADE,
  email text NOT NULL,
  nome text,
  master boolean NOT NULL DEFAULT false,
  autorizado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 3. Permissoes por modulo.
CREATE TABLE public.permissoes (
  user_id uuid NOT NULL REFERENCES public.perfis(id)
    ON DELETE CASCADE,
  modulo text NOT NULL CHECK (
    modulo IN (
      'clientes',
      'tarefas',
      'bonavere',
      'financeiro'
    )
  ),
  nivel text NOT NULL CHECK (
    nivel IN ('ver', 'editar')
  ),
  PRIMARY KEY (user_id, modulo)
);

-- 4. Ativa a protecao das tabelas.
ALTER TABLE public.emails_autorizados
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.perfis
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissoes
  ENABLE ROW LEVEL SECURITY;

-- Remove acessos automaticos desnecessarios.
REVOKE ALL ON public.emails_autorizados
  FROM anon, authenticated;

REVOKE ALL ON public.perfis
  FROM anon, authenticated;

REVOKE ALL ON public.permissoes
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.emails_autorizados TO authenticated;

GRANT SELECT, UPDATE
  ON public.perfis TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.permissoes TO authenticated;

-- 5. Funcoes internas de seguranca.
CREATE SCHEMA IF NOT EXISTS private;

CREATE FUNCTION private.eh_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis p
    WHERE p.id = (SELECT auth.uid())
      AND p.master = true
      AND p.autorizado = true
  );
$$;

CREATE FUNCTION private.pode(
  p_modulo text,
  p_nivel text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT private.eh_master())
    OR EXISTS (
      SELECT 1
      FROM public.perfis p
      JOIN public.permissoes pm
        ON pm.user_id = p.id
      WHERE p.id = (SELECT auth.uid())
        AND p.autorizado = true
        AND pm.modulo = p_modulo
        AND (
          (p_nivel = 'ver'
            AND pm.nivel IN ('ver', 'editar'))
          OR
          (p_nivel = 'editar'
            AND pm.nivel = 'editar')
        )
    );
$$;

REVOKE ALL ON FUNCTION private.eh_master()
  FROM PUBLIC;

REVOKE ALL ON FUNCTION private.pode(text, text)
  FROM PUBLIC;

GRANT USAGE ON SCHEMA private TO authenticated;

GRANT EXECUTE ON FUNCTION private.eh_master()
  TO authenticated;

GRANT EXECUTE ON FUNCTION private.pode(text, text)
  TO authenticated;

-- 6. Politicas de acesso aos perfis.
CREATE POLICY "perfil proprio ou master"
ON public.perfis
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT private.eh_master())
);

CREATE POLICY "master atualiza perfis"
ON public.perfis
FOR UPDATE TO authenticated
USING ((SELECT private.eh_master()))
WITH CHECK ((SELECT private.eh_master()));

-- 7. Politicas das permissoes.
CREATE POLICY "permissoes visiveis"
ON public.permissoes
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.eh_master())
);

CREATE POLICY "master insere permissoes"
ON public.permissoes
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.eh_master()));

CREATE POLICY "master altera permissoes"
ON public.permissoes
FOR UPDATE TO authenticated
USING ((SELECT private.eh_master()))
WITH CHECK ((SELECT private.eh_master()));

CREATE POLICY "master remove permissoes"
ON public.permissoes
FOR DELETE TO authenticated
USING ((SELECT private.eh_master()));

-- 8. Politicas dos e-mails autorizados.
CREATE POLICY "master consulta autorizacoes"
ON public.emails_autorizados
FOR SELECT TO authenticated
USING ((SELECT private.eh_master()));

CREATE POLICY "master cria autorizacoes"
ON public.emails_autorizados
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.eh_master()));

CREATE POLICY "master altera autorizacoes"
ON public.emails_autorizados
FOR UPDATE TO authenticated
USING ((SELECT private.eh_master()))
WITH CHECK ((SELECT private.eh_master()));

CREATE POLICY "master remove autorizacoes"
ON public.emails_autorizados
FOR DELETE TO authenticated
USING ((SELECT private.eh_master()));

-- 9. Cria o perfil de futuros usuarios Google.
CREATE FUNCTION private.criar_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  a public.emails_autorizados%ROWTYPE;
BEGIN
  SELECT * INTO a
  FROM public.emails_autorizados
  WHERE email = lower(NEW.email);

  INSERT INTO public.perfis (
    id, email, nome, master, autorizado
  )
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      a.nome,
      NEW.email
    ),
    COALESCE(a.master, false),
    a.email IS NOT NULL
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.criar_perfil()
  FROM PUBLIC;

CREATE TRIGGER ao_criar_usuario
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.criar_perfil();

-- 10. Define o e-mail do Master.
-- IMPORTANTE: substitua o texto abaixo.
DO $$
DECLARE
  email_master text :=
    lower('caiafamariofilho@gmail.com');
BEGIN
  IF email_master =
    lower('COLE_AQUI_O_EMAIL_GOOGLE_DO_MASTER')
  THEN
    RAISE EXCEPTION
      'Substitua o e-mail do Master antes de executar.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = email_master
  ) THEN
    RAISE EXCEPTION
      'O e-mail do Master nao foi encontrado em Authentication.';
  END IF;

  INSERT INTO public.emails_autorizados (
    email, nome, master
  )
  VALUES (email_master, 'Master', true);
END;
$$;

-- 11. Inclui usuarios que ja fizeram login.
-- Isso e necessario porque o Master entrou
-- antes da criacao das tabelas.
INSERT INTO public.perfis (
  id, email, nome, master, autorizado
)
SELECT
  u.id,
  lower(u.email),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.email
  ),
  COALESCE(a.master, false),
  a.email IS NOT NULL
FROM auth.users u
LEFT JOIN public.emails_autorizados a
  ON a.email = lower(u.email)
ON CONFLICT (id) DO NOTHING;

COMMIT;
