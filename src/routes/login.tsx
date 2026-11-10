import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { getCurrentUserFn, loginFn } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (user) throw redirect({ to: "/boards" });
  },
  head: () => ({
    meta: [{ title: "Log in — MSU Bookstore Analytics" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginFn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => login({ data: { email, password } }),
    onSuccess: () => navigate({ to: "/boards" }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="size-8 rounded-sm bg-primary grid place-items-center text-primary-foreground font-bold">
            M
          </div>
          <div className="leading-tight">
            <div className="font-display text-base tracking-tight">MSU Bookstore</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Analytics
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md shadow-[var(--shadow-panel)] p-6">
          <h1 className="font-display text-xl tracking-tight">Log in</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Use your staff account to access Boards.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
                autoFocus
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                required
              />
            </Field>

            {loginMutation.isError && (
              <p className="text-[12px] text-negative">
                {loginMutation.error instanceof Error
                  ? loginMutation.error.message
                  : "Something went wrong."}
              </p>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-2 h-10 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
            >
              <LogIn className="size-3.5" />
              {loginMutation.isPending ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const fieldClass =
  "w-full bg-surface border border-border rounded-sm px-3 h-10 text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-border-strong";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
