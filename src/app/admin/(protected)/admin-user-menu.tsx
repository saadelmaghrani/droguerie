import { getCurrentAdmin } from "@/server/auth/dal";
import { logout } from "@/server/auth/actions";

export async function AdminUserMenu() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-600">{admin.name}</span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
