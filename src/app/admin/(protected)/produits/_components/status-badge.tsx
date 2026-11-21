import { Badge } from "@/components/ui/badge";
import { STATUS_INFO, type ProductStatusValue } from "@/lib/product-status";

const STYLES: Record<ProductStatusValue, string> = {
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800",
  HIDDEN: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StatusBadge({ status }: { status: ProductStatusValue }) {
  return (
    <Badge variant="outline" className={STYLES[status]}>
      {STATUS_INFO[status].label}
    </Badge>
  );
}
