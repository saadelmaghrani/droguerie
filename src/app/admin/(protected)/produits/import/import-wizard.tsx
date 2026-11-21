"use client";

// Import CSV en 3 étapes : 1. choisir le fichier → 2. vérifier l'analyse → 3. importer.
// Le fichier reste dans le navigateur entre l'analyse et l'import, puis il est renvoyé :
// le serveur le ré-analyse avant d'écrire (rien n'est stocké entre les deux étapes).
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  PencilLine,
  Plus,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_INFO } from "@/lib/product-status";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, type ImportRow } from "@/lib/product-import";
import { cn } from "@/lib/utils";
import { analyzeProductImport, runProductImport } from "@/server/products/import-actions";
import type { ImportAnalysis } from "@/server/products/import";

type Step =
  | { name: "choose" }
  | { name: "review"; file: File; analysis: ImportAnalysis }
  | { name: "done"; created: number; updated: number; skipped: number };

const PREVIEW_LIMIT = 100;
const plural = (n: number, word: string) => `${n.toLocaleString("fr-FR")} ${word}${n > 1 ? "s" : ""}`;

export function ImportWizard({ categoryNames }: { categoryNames: string[] }) {
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [isPending, startTransition] = useTransition();

  const withFile = (file: File) => {
    const data = new FormData();
    data.set("file", file);
    return data;
  };

  function analyze(file: File) {
    if (file.size > IMPORT_MAX_BYTES) {
      toast.error(`Fichier trop lourd. Maximum : ${IMPORT_MAX_BYTES / 1024 / 1024} Mo.`);
      return;
    }
    startTransition(async () => {
      try {
        const result = await analyzeProductImport(withFile(file));
        if (result.ok) setStep({ name: "review", file, analysis: result.analysis });
        else toast.error(result.message);
      } catch {
        toast.error("Analyse impossible. Vérifiez la connexion et réessayez.");
      }
    });
  }

  function runImport(file: File) {
    startTransition(async () => {
      try {
        const result = await runProductImport(withFile(file));
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(`Import terminé : ${plural(result.created, "produit")} créé${result.created > 1 ? "s" : ""}.`);
        setStep({ name: "done", ...result });
      } catch {
        toast.error("Import impossible. Rien n'a été enregistré : réessayez.");
      }
    });
  }

  if (step.name === "done") return <Done {...step} onRestart={() => setStep({ name: "choose" })} />;
  if (step.name === "review") {
    return (
      <Review
        analysis={step.analysis}
        fileName={step.file.name}
        pending={isPending}
        onCancel={() => setStep({ name: "choose" })}
        onImport={() => runImport(step.file)}
      />
    );
  }
  return <Choose pending={isPending} onFile={analyze} categoryNames={categoryNames} />;
}

/* ─────────────────────────── Étape 1 : choisir le fichier ─────────────────────────── */

function Choose({ pending, onFile, categoryNames }: { pending: boolean; onFile: (file: File) => void; categoryNames: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>1. Choisir le fichier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // permet de renvoyer le même fichier après correction
              if (file) onFile(file);
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!pending) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !pending) onFile(file);
            }}
            className={cn(
              "flex min-h-52 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors",
              "hover:border-ring hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60",
              dragging && "border-primary bg-primary/5",
            )}
          >
            {pending ? <Loader2 className="size-8 animate-spin" aria-hidden /> : <FileUp className="size-8" aria-hidden />}
            <span className="font-medium text-foreground">{pending ? "Analyse du fichier…" : "Choisir un fichier CSV"}</span>
            {!pending && (
              <span className="text-xs">
                Glissez-déposez ou cliquez · {IMPORT_MAX_ROWS.toLocaleString("fr-FR")} lignes et {IMPORT_MAX_BYTES / 1024 / 1024} Mo max
              </span>
            )}
          </button>
          <p className="text-sm text-muted-foreground">
            Rien n&apos;est enregistré à cette étape : le fichier est d&apos;abord vérifié, et vous confirmez ensuite l&apos;import.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comment préparer le fichier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <Button variant="outline" asChild className="w-full">
            <a href="/admin/produits/import/modele" download>
              <Download className="size-4" aria-hidden />
              Télécharger le modèle
            </a>
          </Button>
          <ol className="grid list-decimal gap-1.5 pl-5 text-muted-foreground">
            <li>Ouvrez le modèle dans Excel et remplissez une ligne par produit.</li>
            <li>
              Enregistrez sous <span className="font-medium text-foreground">« CSV (séparateur : point-virgule) »</span>.
            </li>
            <li>Choisissez ce fichier ici.</li>
          </ol>
          <dl className="grid gap-2 rounded-lg bg-muted/50 p-3">
            <div>
              <dt className="font-medium">Nom, Catégorie</dt>
              <dd className="text-muted-foreground">Obligatoires pour un nouveau produit.</dd>
            </div>
            <div>
              <dt className="font-medium">Référence</dt>
              <dd className="text-muted-foreground">
                Si elle existe déjà, le produit est <strong>mis à jour</strong> (une case vide ne change rien). Sinon, il est créé.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Description, Marque</dt>
              <dd className="text-muted-foreground">Facultatives.</dd>
            </div>
            <div>
              <dt className="font-medium">Statut</dt>
              <dd className="text-muted-foreground">Brouillon (par défaut), Publié ou Masqué.</dd>
            </div>
            <div>
              <dt className="font-medium">Mis en avant</dt>
              <dd className="text-muted-foreground">Oui ou Non.</dd>
            </div>
          </dl>
          <p className="text-muted-foreground">
            Pas de prix (jamais affichés sur le site). Les photos s&apos;ajoutent ensuite depuis chaque fiche.
          </p>
          <div className="grid gap-1.5">
            <p className="font-medium">Catégories existantes</p>
            {categoryNames.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {categoryNames.map((name) => (
                  <li key={name}>
                    <Badge variant="secondary">{name}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-amber-700">
                Aucune catégorie : <Link href="/admin/categories" className="underline">créez-en d&apos;abord</Link>.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────── Étape 2 : vérifier ─────────────────────────── */

function Review({
  analysis,
  fileName,
  pending,
  onCancel,
  onImport,
}: {
  analysis: ImportAnalysis;
  fileName: string;
  pending: boolean;
  onCancel: () => void;
  onImport: () => void;
}) {
  const { counts, rows } = analysis;
  const valid = rows.filter((r) => r.action !== "error");
  const errors = rows.filter((r): r is Extract<ImportRow, { action: "error" }> => r.action === "error");
  const total = counts.create + counts.update;

  return (
    <div className="grid gap-6 pb-24">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="size-4" aria-hidden />
        {fileName} · {plural(rows.length, "ligne")}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="À créer" value={counts.create} icon={<Plus className="size-4" aria-hidden />} tone="text-emerald-700" />
        <Stat label="À mettre à jour" value={counts.update} icon={<PencilLine className="size-4" aria-hidden />} tone="text-sky-700" />
        <Stat label="Lignes en erreur" value={counts.error} icon={<CircleAlert className="size-4" aria-hidden />} tone={counts.error ? "text-destructive" : "text-muted-foreground"} />
      </div>

      {analysis.publishDeferred > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {plural(analysis.publishDeferred, "produit")} marqué{analysis.publishDeferred > 1 ? "s" : ""} « Publié » ser
          {analysis.publishDeferred > 1 ? "ont" : "a"} importé{analysis.publishDeferred > 1 ? "s" : ""} non publié
          {analysis.publishDeferred > 1 ? "s" : ""} : la photo principale est obligatoire pour publier. Ajoutez leur photo, puis publiez-les
          depuis la liste (filtre « Sans photo »).
        </p>
      )}

      {(analysis.priceColumns.length > 0 || analysis.ignoredColumns.length > 0) && (
        <div className="grid gap-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {analysis.priceColumns.length > 0 && (
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Colonne « {analysis.priceColumns.join(" », « ")} » ignorée : les prix ne sont jamais importés ni affichés.
            </p>
          )}
          {analysis.ignoredColumns.length > 0 && (
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Colonne{analysis.ignoredColumns.length > 1 ? "s" : ""} non reconnue{analysis.ignoredColumns.length > 1 ? "s" : ""}, ignorée
              {analysis.ignoredColumns.length > 1 ? "s" : ""} : « {analysis.ignoredColumns.join(" », « ")} ».
            </p>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">
              {plural(errors.length, "ligne")} à corriger (elle{errors.length > 1 ? "s" : ""} ne ser{errors.length > 1 ? "ont" : "a"} pas importée{errors.length > 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">Produit</th>
                    <th className="px-3 py-2 font-medium">Problème</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {errors.map((row) => (
                    <tr key={row.line} className="align-top">
                      <td className="px-3 py-2 tabular-nums">{row.line}</td>
                      <td className="max-w-48 truncate px-3 py-2">{row.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-destructive">
                        <ul className="grid gap-0.5">
                          {row.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Corrigez ces lignes dans Excel puis choisissez à nouveau le fichier, ou importez seulement les lignes valides.
            </p>
          </CardContent>
        </Card>
      )}

      {valid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lignes valides{valid.length > PREVIEW_LIMIT ? ` (${PREVIEW_LIMIT} premières sur ${valid.length.toLocaleString("fr-FR")})` : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[28rem] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Catégorie</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">Référence</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {valid.slice(0, PREVIEW_LIMIT).map((row) => {
                    const unchanged = <span className="text-muted-foreground">inchangé</span>;
                    const isCreate = row.action === "create";
                    return (
                      <tr key={row.line}>
                        <td className="px-3 py-2 tabular-nums">{row.line}</td>
                        <td className="px-3 py-2">
                          <Badge variant={isCreate ? "default" : "secondary"}>{isCreate ? "Création" : "Mise à jour"}</Badge>
                        </td>
                        <td className="max-w-64 truncate px-3 py-2">{row.data.name ?? unchanged}</td>
                        <td className="hidden px-3 py-2 sm:table-cell">{row.data.categoryName ?? unchanged}</td>
                        <td className="hidden px-3 py-2 font-mono text-xs md:table-cell">{row.data.reference ?? "—"}</td>
                        <td className="hidden px-3 py-2 md:table-cell">
                          {row.publishDeferred
                            ? isCreate ? "Brouillon (photo requise)" : "Inchangé (photo requise)"
                            : row.data.status ? STATUS_INFO[row.data.status].label : isCreate ? STATUS_INFO.DRAFT.label : unchanged}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barre d'action toujours visible */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <p className="w-full text-sm text-muted-foreground sm:mr-auto sm:w-auto" aria-live="polite">
            {pending
              ? "Import en cours… ne fermez pas la page."
              : total === 0
                ? "Aucune ligne valide : corrigez le fichier."
                : counts.error > 0
                  ? `${plural(counts.error, "ligne")} en erreur ser${counts.error > 1 ? "ont" : "a"} ignorée${counts.error > 1 ? "s" : ""}.`
                  : "Toutes les lignes sont valides."}
          </p>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            <RotateCcw className="size-4" aria-hidden />
            Autre fichier
          </Button>
          <Button onClick={onImport} disabled={pending || total === 0}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
            Importer {plural(total, "produit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="py-4">
      <CardContent className="grid gap-1 px-4">
        <span className={cn("flex items-center gap-1.5 text-sm font-medium", tone)}>
          {icon}
          {label}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{value.toLocaleString("fr-FR")}</span>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Étape 3 : terminé ─────────────────────────── */

function Done({ created, updated, skipped, onRestart }: { created: number; updated: number; skipped: number; onRestart: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CircleCheck className="size-6" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">Import terminé</h2>
        <ul className="mt-2 grid gap-0.5 text-sm text-muted-foreground">
          <li>{plural(created, "produit")} créé{created > 1 ? "s" : ""}</li>
          <li>{plural(updated, "produit")} mis à jour</li>
          {skipped > 0 && <li>{plural(skipped, "ligne")} ignorée{skipped > 1 ? "s" : ""} (erreurs)</li>}
        </ul>
        {created > 0 && (
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Pensez à ajouter les photos depuis la fiche de chaque produit, et à vérifier l&apos;aperçu avant de publier.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw className="size-4" aria-hidden />
            Importer un autre fichier
          </Button>
          <Button asChild>
            <Link href="/admin/produits">Voir les produits</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
