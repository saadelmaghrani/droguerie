# Interface d'administration

Composants : **shadcn/ui** (style `radix-nova`, base Radix, icônes Lucide, police Geist).
Les composants sont copiés dans `src/components/ui/` : ils font partie du projet et peuvent être modifiés.

```bash
npx shadcn@4.23.0 add <composant>   # ajouter un composant (ex. table, dialog, select)
```

## Structure

```
src/app/admin/
├── layout.tsx                  métadonnées (noindex) communes à tout /admin
├── login/                      page de connexion (hors menu)
└── (protected)/                groupe de routes : n'apparaît pas dans l'URL
    ├── layout.tsx              menu latéral (≥ 1024 px) / barre + menu ☰ (mobile)
    ├── page.tsx                /admin — tableau de bord
    ├── produits/ categories/ whatsapp/ statistiques/ parametres/
    └── _components/            composants propres à l'admin (exclus du routage)
        ├── nav-items.ts        ⇐ entrées du menu (source unique)
        ├── admin-nav.tsx       liens + lien actif (aria-current)
        ├── mobile-nav.tsx      panneau latéral mobile
        ├── admin-user-menu.tsx utilisateur connecté + déconnexion
        ├── page-header.tsx     titre / description / actions d'une page
        └── coming-soon.tsx     contenu provisoire des sections à venir
```

## Ajouter une page admin

```tsx
// src/app/admin/(protected)/exemple/page.tsx
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth/dal";
import { PageHeader } from "../_components/page-header";

async function Content() {
  await requireAdmin();          // 1. TOUJOURS en premier
  // 2. lire les données ici
  return <div>…</div>;
}

export default function Page() {
  return (
    <>
      <PageHeader title="Exemple" description="…" />
      <Suspense fallback={<p>Chargement…</p>}>   {/* 3. obligatoire (Cache Components) */}
        <Content />
      </Suspense>
    </>
  );
}
```

Pour l'ajouter au menu : une ligne dans `_components/nav-items.ts`.

## Thème

Les couleurs sont des variables CSS dans `src/app/globals.css` (`--primary`, `--muted`, `--sidebar`…).
Utiliser les classes du thème (`bg-primary`, `text-muted-foreground`, `border`…) plutôt que des
couleurs fixes : la couleur principale du site deviendra personnalisable depuis les paramètres.

La police Geist est déclarée dans `src/app/layout.tsx` sous la variable `--font-sans`
(nom attendu par le thème shadcn).
