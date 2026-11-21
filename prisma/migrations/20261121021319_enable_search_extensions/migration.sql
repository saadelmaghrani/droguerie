-- Extensions PostgreSQL nécessaires à la recherche de produits.
--   unaccent : ignore les accents      → « eponge » trouve « éponge »
--   pg_trgm  : similarité de trigrammes → tolère les fautes de frappe (« detergant » → « détergent »)
-- Les deux sont des extensions « trusted » : le propriétaire de la base peut les activer
-- sans être super-utilisateur (important pour le VPS de production).

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
