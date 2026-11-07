
-- ==================================================
-- GESTOR BCA - 03_bonavere_estrutura.sql
-- Modulo Bonavere: estrutura, seguranca e historico
--
-- Requer a execucao previa do script
-- 01_login_permissoes.sql
--
-- Nao execute o antigo 01_schema.sql.
-- ==================================================

BEGIN;

-- 1. RESPONSAVEIS
CREATE TABLE public.bonavere_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL
    CHECK (length(trim(nome)) BETWEEN 1 AND 150),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 2. TIPOS DE ATIVIDADE
-- Valores financeiros serao guardados
-- em outra tabela, em etapa posterior.
CREATE TABLE public.bonavere_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL
    CHECK (length(trim(nome)) BETWEEN 1 AND 150),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 3. PROCESSOS E PRAZOS
CREATE TABLE public.bonavere_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  numero_processo text,
  cliente text,
  publicacao date,
  data_limite date,
  vencimento date,
  observacao text,

  responsavel_id uuid
    REFERENCES public.bonavere_responsaveis(id),

  tipo_id uuid
    REFERENCES public.bonavere_tipos(id),

  status text NOT NULL DEFAULT 'aberta'
    CHECK (
      status IN (
        'aberta',
        'em_processo',
        'concluida',
        'nada_a_fazer'
      )
    ),

  data_conclusao date,

  responsavel_execucao_id uuid
    REFERENCES public.bonavere_responsaveis(id),

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  criado_por uuid REFERENCES auth.users(id),
  atualizado_por uuid REFERENCES auth.users(id)
);

-- Indices para consultas e ordenacao.
CREATE INDEX idx_bonavere_status_limite
  ON public.bonavere_processos (
    status,
    data_limite
  );

CREATE INDEX idx_bonavere_vencimento
  ON public.bonavere_processos(vencimento);

CREATE INDEX idx_bonavere_responsavel
  ON public.bonavere_processos(responsavel_id);

-- 4. HISTORICO DE ALTERACOES
-- Estrutura compartilhavel com futuros modulos.
CREATE TABLE public.historico (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  tabela text NOT NULL,
  acao text NOT NULL,
  registro uuid NOT NULL,

  antes jsonb,
  depois jsonb,

  usuario uuid REFERENCES auth.users(id),
  em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_historico_registro
  ON public.historico(tabela, registro);

CREATE INDEX idx_historico_data
  ON public.historico(em);

-- 5. PREPARAR DATAS E RESPONSAVEIS
-- O servidor de banco define quem fez a alteracao.
CREATE FUNCTION private.bonavere_preparar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_em := now();
    NEW.criado_por := auth.uid();

    IF NEW.status = 'concluida' THEN
      NEW.data_conclusao := current_date;

      NEW.responsavel_execucao_id :=
        COALESCE(
          NEW.responsavel_execucao_id,
          NEW.responsavel_id
        );
    ELSE
      NEW.data_conclusao := NULL;
      NEW.responsavel_execucao_id := NULL;
    END IF;

  ELSE
    -- Impede alteracao dos dados originais
    -- de criacao.
    NEW.criado_em := OLD.criado_em;
    NEW.criado_por := OLD.criado_por;

    IF NEW.status = 'concluida' THEN
      IF OLD.status IS DISTINCT FROM 'concluida' THEN
        NEW.data_conclusao := current_date;

        NEW.responsavel_execucao_id :=
          COALESCE(
            NEW.responsavel_execucao_id,
            NEW.responsavel_id
          );
      ELSE
        -- Preserva a data original da conclusao.
        NEW.data_conclusao := OLD.data_conclusao;
      END IF;
    ELSE
      NEW.data_conclusao := NULL;
      NEW.responsavel_execucao_id := NULL;
    END IF;
  END IF;

  NEW.atualizado_em := now();
  NEW.atualizado_por := auth.uid();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.bonavere_preparar()
  FROM PUBLIC;

CREATE TRIGGER trg_bonavere_preparar
BEFORE INSERT OR UPDATE
ON public.bonavere_processos
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_preparar();

-- 6. REGISTRAR ALTERACOES AUTOMATICAMENTE
CREATE FUNCTION private.bonavere_auditar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dados_anteriores jsonb;
  dados_novos jsonb;
  registro_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    dados_anteriores := NULL;
    dados_novos := to_jsonb(NEW);
    registro_id := NEW.id;
  ELSE
    dados_anteriores := to_jsonb(OLD);
    dados_novos := to_jsonb(NEW);
    registro_id := NEW.id;
  END IF;

  INSERT INTO public.historico (
    tabela,
    acao,
    registro,
    antes,
    depois,
    usuario
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    registro_id,
    dados_anteriores,
    dados_novos,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.bonavere_auditar()
  FROM PUBLIC;

CREATE TRIGGER trg_auditar_bonavere_processos
AFTER INSERT OR UPDATE
ON public.bonavere_processos
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_auditar();

CREATE TRIGGER trg_auditar_bonavere_responsaveis
AFTER INSERT OR UPDATE
ON public.bonavere_responsaveis
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_auditar();

CREATE TRIGGER trg_auditar_bonavere_tipos
AFTER INSERT OR UPDATE
ON public.bonavere_tipos
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_auditar();

-- 7. BLOQUEAR EXCLUSOES
CREATE FUNCTION private.bonavere_bloquear_exclusao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'Exclusao nao permitida neste modulo.';
END;
$$;

REVOKE ALL
ON FUNCTION private.bonavere_bloquear_exclusao()
FROM PUBLIC;

CREATE TRIGGER trg_sem_delete_processos
BEFORE DELETE ON public.bonavere_processos
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_bloquear_exclusao();

CREATE TRIGGER trg_sem_delete_responsaveis
BEFORE DELETE ON public.bonavere_responsaveis
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_bloquear_exclusao();

CREATE TRIGGER trg_sem_delete_tipos
BEFORE DELETE ON public.bonavere_tipos
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_bloquear_exclusao();

CREATE TRIGGER trg_sem_delete_historico
BEFORE DELETE ON public.historico
FOR EACH ROW
EXECUTE FUNCTION private.bonavere_bloquear_exclusao();

-- 8. ATIVAR SEGURANCA RLS
ALTER TABLE public.bonavere_responsaveis
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bonavere_tipos
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bonavere_processos
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.historico
  ENABLE ROW LEVEL SECURITY;

-- 9. PERMISSOES DE ACESSO AS TABELAS
REVOKE ALL ON public.bonavere_responsaveis
  FROM anon, authenticated;

REVOKE ALL ON public.bonavere_tipos
  FROM anon, authenticated;

REVOKE ALL ON public.bonavere_processos
  FROM anon, authenticated;

REVOKE ALL ON public.historico
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.bonavere_responsaveis
  TO authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.bonavere_tipos
  TO authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.bonavere_processos
  TO authenticated;

GRANT SELECT
  ON public.historico
  TO authenticated;

-- 10. RESPONSAVEIS:
-- Usuarios do Bonavere consultam.
-- Apenas Master cadastra e altera.
CREATE POLICY "bonavere responsaveis consultar"
ON public.bonavere_responsaveis
FOR SELECT TO authenticated
USING (
  (SELECT private.pode('bonavere', 'ver'))
);

CREATE POLICY "bonavere responsaveis cadastrar"
ON public.bonavere_responsaveis
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.eh_master())
);

CREATE POLICY "bonavere responsaveis alterar"
ON public.bonavere_responsaveis
FOR UPDATE TO authenticated
USING (
  (SELECT private.eh_master())
)
WITH CHECK (
  (SELECT private.eh_master())
);

-- 11. TIPOS:
-- Usuarios do Bonavere consultam.
-- Apenas Master cadastra e altera.
CREATE POLICY "bonavere tipos consultar"
ON public.bonavere_tipos
FOR SELECT TO authenticated
USING (
  (SELECT private.pode('bonavere', 'ver'))
);

CREATE POLICY "bonavere tipos cadastrar"
ON public.bonavere_tipos
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.eh_master())
);

CREATE POLICY "bonavere tipos alterar"
ON public.bonavere_tipos
FOR UPDATE TO authenticated
USING (
  (SELECT private.eh_master())
)
WITH CHECK (
  (SELECT private.eh_master())
);

-- 12. PROCESSOS:
-- Consultar requer acesso de leitura.
-- Criar e editar requer acesso de edicao.
CREATE POLICY "bonavere processos consultar"
ON public.bonavere_processos
FOR SELECT TO authenticated
USING (
  (SELECT private.pode('bonavere', 'ver'))
);

CREATE POLICY "bonavere processos cadastrar"
ON public.bonavere_processos
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.pode('bonavere', 'editar'))
);

CREATE POLICY "bonavere processos alterar"
ON public.bonavere_processos
FOR UPDATE TO authenticated
USING (
  (SELECT private.pode('bonavere', 'editar'))
)
WITH CHECK (
  (SELECT private.pode('bonavere', 'editar'))
);

-- 13. HISTORICO:
-- Somente leitores autorizados do Bonavere
-- e o Master podem consultar.
-- Ninguem escreve diretamente pelo navegador.
CREATE POLICY "bonavere historico consultar"
ON public.historico
FOR SELECT TO authenticated
USING (
  (
    tabela IN (
      'bonavere_processos',
      'bonavere_responsaveis',
      'bonavere_tipos'
    )
    AND
    (SELECT private.pode('bonavere', 'ver'))
  )
  OR
  (SELECT private.eh_master())
);

COMMIT;
