// Pictogrammes des catégories (menu, pastilles, tuiles). Icônes en trait fin (lucide, licence ISC),
// dans la couleur principale du site. L'admin en choisit une ; sinon, suggestion d'après le nom.
// Logique pure : serveur + navigateur. Testé par category-icons.test.ts.
import {
  AirVent, Archive, Bath, Bike, Boxes, BrickWall, Brush, Cable, Car, CookingPot, Drill, Droplets, Fish, Flame, Flower2,
  Gift, Hammer, House, KeyRound, Lamp, LayoutGrid, Lightbulb, Lock, Nut, Package, PaintBucket, Paintbrush, PaintRoller,
  PawPrint, Plug, Ruler, Scissors, Shirt, Shovel, ShowerHead, Smartphone, Sofa, Sparkles, SprayCan, Sprout, Thermometer,
  Toolbox, Trash, Utensils, WashingMachine, WavesLadder, Wrench, Zap, type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS = {
  sparkles: { label: "Entretien", Icon: Sparkles },
  "spray-can": { label: "Produits ménagers", Icon: SprayCan },
  brush: { label: "Brosse", Icon: Brush },
  "washing-machine": { label: "Lessive", Icon: WashingMachine },
  trash: { label: "Poubelles", Icon: Trash },
  "paint-roller": { label: "Peinture", Icon: PaintRoller },
  paintbrush: { label: "Pinceaux", Icon: Paintbrush },
  "paint-bucket": { label: "Pot de peinture", Icon: PaintBucket },
  nut: { label: "Quincaillerie", Icon: Nut },
  hammer: { label: "Outillage", Icon: Hammer },
  wrench: { label: "Clés", Icon: Wrench },
  drill: { label: "Perceuse", Icon: Drill },
  toolbox: { label: "Boîte à outils", Icon: Toolbox },
  ruler: { label: "Mesure", Icon: Ruler },
  scissors: { label: "Découpe", Icon: Scissors },
  lock: { label: "Serrurerie", Icon: Lock },
  key: { label: "Clés / sécurité", Icon: KeyRound },
  droplets: { label: "Plomberie", Icon: Droplets },
  "shower-head": { label: "Sanitaire", Icon: ShowerHead },
  bath: { label: "Salle de bain", Icon: Bath },
  zap: { label: "Électricité", Icon: Zap },
  plug: { label: "Prises", Icon: Plug },
  cable: { label: "Câbles", Icon: Cable },
  lightbulb: { label: "Éclairage", Icon: Lightbulb },
  lamp: { label: "Luminaire", Icon: Lamp },
  sprout: { label: "Jardinage", Icon: Sprout },
  flower: { label: "Fleurs", Icon: Flower2 },
  shovel: { label: "Outils de jardin", Icon: Shovel },
  "waves-ladder": { label: "Piscine", Icon: WavesLadder },
  "paw-print": { label: "Animalerie", Icon: PawPrint },
  fish: { label: "Aquariophilie", Icon: Fish },
  "cooking-pot": { label: "Cuisine", Icon: CookingPot },
  utensils: { label: "Ustensiles", Icon: Utensils },
  boxes: { label: "Rangement", Icon: Boxes },
  archive: { label: "Stockage", Icon: Archive },
  house: { label: "Maison", Icon: House },
  sofa: { label: "Décoration", Icon: Sofa },
  thermometer: { label: "Climatisation", Icon: Thermometer },
  "air-vent": { label: "Ventilation", Icon: AirVent },
  flame: { label: "Chauffage / gaz", Icon: Flame },
  "layout-grid": { label: "Sols et carrelage", Icon: LayoutGrid },
  "brick-wall": { label: "Construction", Icon: BrickWall },
  smartphone: { label: "Téléphonie", Icon: Smartphone },
  car: { label: "Auto", Icon: Car },
  bike: { label: "Vélo", Icon: Bike },
  shirt: { label: "Textile", Icon: Shirt },
  gift: { label: "Cadeaux", Icon: Gift },
  package: { label: "Divers", Icon: Package },
} as const satisfies Record<string, { label: string; Icon: LucideIcon }>;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIconKey[];
export const DEFAULT_CATEGORY_ICON: CategoryIconKey = "package";

export function isCategoryIconKey(value: unknown): value is CategoryIconKey {
  return typeof value === "string" && Object.hasOwn(CATEGORY_ICONS, value);
}

/** Mots-clés (sans accents, minuscules) → pictogramme. Le premier qui correspond l'emporte. */
const KEYWORDS: [RegExp, CategoryIconKey][] = [
  [/piscin/, "waves-ladder"],
  [/anima|chien|chat/, "paw-print"],
  [/aquari|poisson/, "fish"],
  [/jardin|plein air|plante|arros/, "sprout"],
  [/fleur/, "flower"],
  [/peint|vernis|enduit/, "paint-roller"],
  [/pinceau|rouleau/, "paintbrush"],
  [/sanitair|salle de bain|douche/, "shower-head"],
  [/plomb|robinet|eau/, "droplets"],
  [/electri/, "zap"],
  [/lumin|eclair|ampoule|lampe/, "lightbulb"],
  [/cable|fil/, "cable"],
  [/chauff|gaz/, "flame"],
  [/clim|ventil/, "thermometer"],
  [/cuisin|vaissel|menag/, "cooking-pot"],
  [/lessiv|linge/, "washing-machine"],
  [/entretien|nettoy|hygien|detergen/, "sparkles"],
  [/rangement|stockage/, "boxes"],
  [/deco|meuble/, "sofa"],
  [/sol|carrel|revetement|parquet/, "layout-grid"],
  [/quincaill|visserie|fixation/, "nut"],
  [/serrur|cadenas|securit/, "lock"],
  [/outil|bricol/, "hammer"],
  [/mesur/, "ruler"],
  [/construct|maconn|ciment|batiment/, "brick-wall"],
  [/telephon|connect|informat/, "smartphone"],
  [/auto|voiture/, "car"],
  [/maison|habitat/, "house"],
];

export function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function suggestCategoryIcon(name: string): CategoryIconKey {
  const normalized = normalizeName(name);
  return KEYWORDS.find(([pattern]) => pattern.test(normalized))?.[1] ?? DEFAULT_CATEGORY_ICON;
}

/** Pictogramme à afficher : choix de l'admin s'il est valide, sinon suggestion. */
export function categoryIconKey(icon: string | null | undefined, name: string): CategoryIconKey {
  return isCategoryIconKey(icon) ? icon : suggestCategoryIcon(name);
}

export function CategoryIcon({ icon, className }: { icon: CategoryIconKey; className?: string }) {
  const { Icon } = CATEGORY_ICONS[icon];
  return <Icon className={className} aria-hidden strokeWidth={1.75} />;
}
