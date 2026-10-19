-- El slug no puede ser una ruta fija de la web de reservas (ingresar, perfil…):
-- si el nombre genera una de ellas, se le agrega -2, -3… como con los duplicados.
-- Debe mantenerse igual a RESERVED_SLUGS en src/online-booking/online-booking.service.ts.
CREATE OR REPLACE FUNCTION make_business_slug(business_name TEXT, business_id TEXT)
RETURNS TEXT AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  n INT := 1;
BEGIN
  base := left(coalesce(nullif(trim(both '-' from regexp_replace(
    translate(lower(business_name), 'áéíóúüñàèìòùç', 'aeiouunaeiouc'),
    '[^a-z0-9]+', '-', 'g')), ''), 'negocio'), 50);
  candidate := base;
  WHILE candidate IN ('ingresar', 'registro', 'recuperar', 'perfil', 'mis-sedes', 'politica-de-datos')
    OR EXISTS (SELECT 1 FROM "Business" WHERE "slug" = candidate AND "id" <> business_id) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;
