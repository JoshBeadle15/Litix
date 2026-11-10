import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { logoutFn } from "@/lib/auth";

export function UserMenu({ user }: { user: { name: string; role: "admin" | "member" } }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useServerFn(logoutFn);

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <div className="text-right leading-tight">
        <div className="text-[12px]">{user.name}</div>
        <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {user.role}
        </div>
      </div>
      {user.role === "admin" && (
        <Link
          to="/settings"
          className="size-8 grid place-items-center rounded-sm border border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
          aria-label="Settings"
        >
          <SettingsIcon className="size-3.5" />
        </Link>
      )}
      <button
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="size-8 grid place-items-center rounded-sm border border-border text-muted-foreground hover:text-negative hover:border-negative/40"
        aria-label="Log out"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
