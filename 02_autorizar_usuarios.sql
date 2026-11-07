
-- GESTOR BCA
-- 02_autorizar_usuarios.sql
-- Autoriza dois usuarios para acessar o sistema.

BEGIN;

INSERT INTO public.emails_autorizados (
  email,
  nome,
  master
)
VALUES
  (
    lower('elenbonavere@gmail.com'),
    'Elen Bonavere',
    false
  ),
  (
    lower('nayanebaptista@gmail.com'),
    'Nayane Baptista',
    false
  )
ON CONFLICT (email)
DO UPDATE SET
  nome = EXCLUDED.nome;

COMMIT;
