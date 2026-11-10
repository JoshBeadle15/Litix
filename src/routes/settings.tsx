import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { KeyRound, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelEyebrow, PanelTitle, Topbar } from "@/components/dashboard-ui";
import { UserMenu } from "@/components/user-menu";
import { changePasswordFn, getCurrentUserFn, updateMyProfileFn } from "@/lib/auth";
import {
  createDepartmentFn,
  createEmployeeFn,
  deleteDepartmentFn,
  deleteEmployeeFn,
  listDepartmentsFn,
  listEmployeesFn,
  renameDepartmentFn,
  updateEmployeeFn,
} from "@/lib/tickets";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  head: () => ({
    meta: [{ title: "Settings — MSU Bookstore Analytics" }],
  }),
  component: SettingsPage,
});

type Role = "admin" | "member";
interface Department {
  id: string;
  name: string;
}

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const isAdmin = user.role === "admin";
  const queryClient = useQueryClient();

  const listEmployees = useServerFn(listEmployeesFn);
  const createEmployee = useServerFn(createEmployeeFn);
  const updateEmployee = useServerFn(updateEmployeeFn);
  const deleteEmployee = useServerFn(deleteEmployeeFn);
  const listDepartments = useServerFn(listDepartmentsFn);
  const createDepartment = useServerFn(createDepartmentFn);
  const renameDepartment = useServerFn(renameDepartmentFn);
  const deleteDepartment = useServerFn(deleteDepartmentFn);

  const [addOpen, setAddOpen] = useState(false);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
    enabled: isAdmin,
  });
  const employees = employeesQuery.data ?? [];

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
    enabled: isAdmin,
  });
  const departments = departmentsQuery.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["employees"] });
  const invalidateDepartments = () => {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    invalidate();
  };

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      title?: string;
      role: Role;
      password: string;
      departmentId?: string;
    }) => createEmployee({ data: input }),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
    },
  });

  const roleMutation = useMutation({
    mutationFn: (input: { employeeId: string; role: Role }) => updateEmployee({ data: input }),
    onSuccess: invalidate,
  });

  const departmentMutation = useMutation({
    mutationFn: (input: { employeeId: string; departmentId: string | null }) =>
      updateEmployee({ data: input }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) => deleteEmployee({ data: { employeeId } }),
    onSuccess: invalidate,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: (name: string) => createDepartment({ data: { name } }),
    onSuccess: invalidateDepartments,
  });
  const renameDepartmentMutation = useMutation({
    mutationFn: (input: { departmentId: string; name: string }) =>
      renameDepartment({ data: input }),
    onSuccess: invalidateDepartments,
  });
  const deleteDepartmentMutation = useMutation({
    mutationFn: (departmentId: string) => deleteDepartment({ data: { departmentId } }),
    onSuccess: invalidateDepartments,
  });

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Topbar active="Settings" />

      <div className="relative px-8 pb-16 max-w-[1100px]">
        <header className="pt-8 pb-6 flex flex-wrap items-end gap-6 justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Settings
            </div>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] tracking-tight">
              Your <em className="italic text-primary">account</em>.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg">
              {isAdmin
                ? "Manage your own profile, plus who has access and what they can do."
                : "Manage your profile and password."}
            </p>
          </div>
          <UserMenu user={user} />
        </header>

        <section className="mb-10 max-w-md">
          <div className="mb-4">
            <PanelEyebrow>Your account</PanelEyebrow>
            <PanelTitle>Profile & password</PanelTitle>
          </div>
          <div className="space-y-4">
            <ProfilePanel user={user} />
            <ChangePasswordPanel />
          </div>
        </section>

        {isAdmin && (
          <section className="mb-10 max-w-md">
            <div className="mb-4">
              <PanelEyebrow>Organization</PanelEyebrow>
              <PanelTitle>Departments</PanelTitle>
            </div>
            <DepartmentsPanel
              departments={departments}
              onCreate={(name) => createDepartmentMutation.mutate(name)}
              onRename={(departmentId, name) =>
                renameDepartmentMutation.mutate({ departmentId, name })
              }
              onDelete={(departmentId) => deleteDepartmentMutation.mutate(departmentId)}
              createPending={createDepartmentMutation.isPending}
            />
          </section>
        )}

        {isAdmin && (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <PanelEyebrow>Staff</PanelEyebrow>
                <PanelTitle>{employees.length} accounts</PanelTitle>
              </div>
              <AddStaffDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                departments={departments}
                pending={createMutation.isPending}
                error={createMutation.error instanceof Error ? createMutation.error.message : null}
                onCreate={(draft) => createMutation.mutate(draft)}
              />
            </div>

            <Panel className="p-0 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-5 font-normal">Name</th>
                    <th className="py-2.5 px-5 font-normal">Email</th>
                    <th className="py-2.5 px-5 font-normal">Title</th>
                    <th className="py-2.5 px-5 font-normal">Department</th>
                    <th className="py-2.5 px-5 font-normal">Role</th>
                    <th className="py-2.5 px-5 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <td className="py-3 px-5">{e.name}</td>
                      <td className="py-3 px-5 text-muted-foreground">{e.email ?? "—"}</td>
                      <td className="py-3 px-5 text-muted-foreground">{e.title ?? "—"}</td>
                      <td className="py-3 px-5">
                        <select
                          value={e.departmentId ?? ""}
                          onChange={(ev) =>
                            departmentMutation.mutate({
                              employeeId: e.id,
                              departmentId: ev.target.value || null,
                            })
                          }
                          className="bg-surface border border-border rounded-sm px-2 h-8 text-[12px] focus:outline-none focus:border-border-strong"
                        >
                          <option value="">—</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-5">
                        <select
                          value={e.role}
                          onChange={(ev) =>
                            roleMutation.mutate({
                              employeeId: e.id,
                              role: ev.target.value as Role,
                            })
                          }
                          disabled={e.id === user.id}
                          className="bg-surface border border-border rounded-sm px-2 h-8 text-[12px] focus:outline-none focus:border-border-strong disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => {
                            if (e.id === user.id) return;
                            if (confirm(`Remove ${e.name}'s account? This can't be undone.`)) {
                              deleteMutation.mutate(e.id);
                            }
                          }}
                          disabled={e.id === user.id}
                          className="size-7 grid place-items-center rounded-sm text-muted-foreground hover:text-negative hover:border-negative/40 border border-transparent disabled:opacity-30 disabled:hover:text-muted-foreground"
                          aria-label={`Remove ${e.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        )}
      </div>
    </div>
  );
}

function DepartmentsPanel({
  departments,
  onCreate,
  onRename,
  onDelete,
  createPending,
}: {
  departments: Department[];
  onCreate: (name: string) => void;
  onRename: (departmentId: string, name: string) => void;
  onDelete: (departmentId: string) => void;
  createPending: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName("");
  };

  return (
    <Panel className="p-4">
      {departments.length === 0 ? (
        <p className="text-[12px] text-muted-foreground mb-3">
          No departments yet — add one below.
        </p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {departments.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 bg-surface border border-border rounded-sm px-3 h-9"
            >
              {editingId === d.id ? (
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={() => {
                    const trimmed = editDraft.trim();
                    if (trimmed && trimmed !== d.name) onRename(d.id, trimmed);
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 bg-transparent text-[13px] focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingId(d.id);
                    setEditDraft(d.name);
                  }}
                  className="flex-1 text-left text-[13px] hover:text-primary"
                >
                  {d.name}
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Delete "${d.name}"? Staff assigned to it will become unassigned.`)) {
                    onDelete(d.id);
                  }
                }}
                className="size-6 grid place-items-center rounded-sm text-muted-foreground hover:text-negative"
                aria-label={`Delete ${d.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name…"
          className={fieldClass}
        />
        <button
          type="submit"
          disabled={createPending}
          className="h-9 px-3 shrink-0 text-[11px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </Panel>
  );
}

function AddStaffDialog({
  open,
  onOpenChange,
  onCreate,
  departments,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (draft: {
    name: string;
    email: string;
    title?: string;
    role: Role;
    password: string;
    departmentId?: string;
  }) => void;
  departments: Department[];
  pending: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [departmentId, setDepartmentId] = useState("");
  const [password, setPassword] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setTitle("");
    setRole("member");
    setDepartmentId("");
    setPassword("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    onCreate({
      name: name.trim(),
      email: email.trim(),
      title: title.trim() || undefined,
      role,
      departmentId: departmentId || undefined,
      password,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90">
          <Plus className="size-3.5" /> Add staff
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight font-normal">
            Add a staff account
          </DialogTitle>
          <DialogDescription>
            They'll log in with this email and password, then can change it in Settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              required
              autoFocus
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title (optional)">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={fieldClass}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <Field label="Department (optional)">
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={fieldClass}
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Initial password (min 8 characters)">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              minLength={8}
              required
            />
          </Field>
          {error && <p className="text-[12px] text-negative">{error}</p>}
          <DialogFooter>
            <button
              type="submit"
              disabled={pending}
              className="h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create account"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfilePanel({ user }: { user: { name: string; title: string | null } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const updateProfile = useServerFn(updateMyProfileFn);
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title ?? "");

  const mutation = useMutation({
    mutationFn: () => updateProfile({ data: { name: name.trim(), title: title.trim() } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.invalidate();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <Panel className="p-5">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Title (optional)">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </Field>
        {mutation.isError && (
          <p className="text-[12px] text-negative">
            {mutation.error instanceof Error ? mutation.error.message : "Something went wrong."}
          </p>
        )}
        {mutation.isSuccess && <p className="text-[12px] text-positive">Profile updated.</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </Panel>
  );
}

function ChangePasswordPanel() {
  const changePassword = useServerFn(changePasswordFn);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePassword({ data: { currentPassword, newPassword } }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Panel className="p-5">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Current password">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="New password (min 8 characters)">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={fieldClass}
            minLength={8}
            required
          />
        </Field>
        {mutation.isError && (
          <p className="text-[12px] text-negative">
            {mutation.error instanceof Error ? mutation.error.message : "Something went wrong."}
          </p>
        )}
        {mutation.isSuccess && <p className="text-[12px] text-positive">Password updated.</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
        >
          <KeyRound className="size-3.5" />
          {mutation.isPending ? "Updating…" : "Update password"}
        </button>
      </form>
    </Panel>
  );
}

const fieldClass =
  "w-full bg-surface border border-border rounded-sm px-3 h-9 text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-border-strong";

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
