"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AdminProfileField,
  AdminProfileFieldOption,
  CreateProfileFieldInput,
  ProfileFieldOptionInput,
  ProfileFieldSection,
  UpdateProfileFieldInput,
} from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const QUERY_KEY = ["profile-fields"];

// Display order matches the app's onboarding sections.
const SECTIONS: { value: ProfileFieldSection; label: string }[] = [
  { value: "appearance", label: "Physical appearance" },
  { value: "looking_for", label: "What are you looking for" },
  { value: "education", label: "Education" },
  { value: "lifestyle", label: "Lifestyle & habits" },
  { value: "into", label: "What are you into" },
  { value: "social", label: "Social activities" },
  { value: "church", label: "Church activities" },
  { value: "about", label: "What else makes you you" },
];
const sectionLabel = (value: string) =>
  SECTIONS.find((s) => s.value === value)?.label ?? value;

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,49}$/;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

// ---------------------------------------------------------------------------
// Question form
// ---------------------------------------------------------------------------

interface FieldForm {
  key: string;
  labelEn: string;
  labelMz: string;
  section: ProfileFieldSection;
  multiSelect: boolean;
  userCanHide: boolean;
  sortOrder: string;
}

const EMPTY_FIELD: FieldForm = {
  key: "",
  labelEn: "",
  labelMz: "",
  section: "lifestyle",
  multiSelect: false,
  userCanHide: false,
  sortOrder: "0",
};

function FieldDialog({
  open,
  editing,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: AdminProfileField | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (form: FieldForm) => void;
}) {
  const [form, setForm] = useState<FieldForm>(EMPTY_FIELD);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Reset the form whenever the dialog opens for a different target.
  const target = open ? (editing?.id ?? "new") : null;
  if (target !== loadedFor) {
    setLoadedFor(target);
    setForm(
      editing
        ? {
            key: editing.key,
            labelEn: editing.labelEn,
            labelMz: editing.labelMz ?? "",
            section: editing.section,
            multiSelect: editing.multiSelect,
            userCanHide: editing.userCanHide,
            sortOrder: String(editing.sortOrder),
          }
        : EMPTY_FIELD,
    );
  }

  const set = <K extends keyof FieldForm>(key: K, value: FieldForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const keyValid = !!editing || KEY_PATTERN.test(form.key);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit question" : "New question"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="field-key">Key</Label>
            <Input
              id="field-key"
              value={form.key}
              onChange={(e) => set("key", e.target.value.toLowerCase())}
              disabled={!!editing}
              placeholder="drinking"
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground">
              {editing
                ? "The key can't be changed — the apps use it."
                : "Lowercase letters, numbers and _. The apps use it, so it can't be changed later."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="field-label-en">Question (English)</Label>
              <Input
                id="field-label-en"
                value={form.labelEn}
                onChange={(e) => set("labelEn", e.target.value)}
                placeholder="How often do you drink?"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-label-mz">Question (Mizo)</Label>
              <Input
                id="field-label-mz"
                value={form.labelMz}
                onChange={(e) => set("labelMz", e.target.value)}
                placeholder="Zu i in ngai em?"
                maxLength={100}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="field-section">Section</Label>
              <Select
                value={form.section}
                onValueChange={(v) => v && set("section", v as ProfileFieldSection)}
              >
                <SelectTrigger id="field-section" className="w-full">
                  <SelectValue>{(v: string) => sectionLabel(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-order">Order</Label>
              <Input
                id="field-order"
                type="number"
                min={0}
                max={10000}
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Multiple choice</p>
              <p className="text-xs text-muted-foreground">
                Users can pick more than one option (e.g. pets)
              </p>
            </div>
            <Switch
              checked={form.multiSelect}
              onCheckedChange={(c) => set("multiSelect", !!c)}
              aria-label="Multiple choice"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">User can hide</p>
              <p className="text-xs text-muted-foreground">
                Shows a &ldquo;Show on my profile&rdquo; switch (e.g. education)
              </p>
            </div>
            <Switch
              checked={form.userCanHide}
              onCheckedChange={(c) => set("userCanHide", !!c)}
              aria-label="User can hide"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.labelEn.trim() || !keyValid || pending}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Option form
// ---------------------------------------------------------------------------

interface OptionForm {
  labelEn: string;
  labelMz: string;
  sortOrder: string;
}

function OptionDialog({
  open,
  field,
  editing,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  field: AdminProfileField | null;
  editing: AdminProfileFieldOption | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (form: OptionForm) => void;
}) {
  const [form, setForm] = useState<OptionForm>({
    labelEn: "",
    labelMz: "",
    sortOrder: "0",
  });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const target = open ? (editing?.id ?? `new:${field?.id}`) : null;
  if (target !== loadedFor) {
    setLoadedFor(target);
    setForm(
      editing
        ? {
            labelEn: editing.labelEn,
            labelMz: editing.labelMz ?? "",
            sortOrder: String(editing.sortOrder),
          }
        : {
            labelEn: "",
            labelMz: "",
            sortOrder: String(field?.options.length ?? 0),
          },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit option" : "New option"}
            {field && (
              <span className="block text-sm font-normal text-muted-foreground">
                {field.labelEn}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="option-label-en">English</Label>
              <Input
                id="option-label-en"
                value={form.labelEn}
                onChange={(e) => setForm((f) => ({ ...f, labelEn: e.target.value }))}
                placeholder="Occasionally"
                maxLength={100}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="option-label-mz">Mizo</Label>
              <Input
                id="option-label-mz"
                value={form.labelMz}
                onChange={(e) => setForm((f) => ({ ...f, labelMz: e.target.value }))}
                placeholder="In ve zeuh zeuh"
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="option-order">Order</Label>
            <Input
              id="option-order"
              type="number"
              min={0}
              max={10000}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.labelEn.trim() || pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function toOrder(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 10000) : 0;
}

export default function ProfileFieldsPage() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const [fieldDialog, setFieldDialog] = useState<{
    open: boolean;
    editing: AdminProfileField | null;
  }>({ open: false, editing: null });
  const [optionDialog, setOptionDialog] = useState<{
    open: boolean;
    field: AdminProfileField | null;
    editing: AdminProfileFieldOption | null;
  }>({ open: false, field: null, editing: null });

  const { data: fields, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<AdminProfileField[]>("/admin/profile-fields"),
  });

  const saveField = useMutation({
    mutationFn: async ({ id, form }: { id: string | null; form: FieldForm }) => {
      const common = {
        labelEn: form.labelEn.trim(),
        section: form.section,
        multiSelect: form.multiSelect,
        userCanHide: form.userCanHide,
        sortOrder: toOrder(form.sortOrder),
      };
      if (id) {
        const payload: UpdateProfileFieldInput = {
          ...common,
          labelMz: form.labelMz.trim() || null,
        };
        return api.patch(`/admin/profile-fields/${id}`, payload);
      }
      const payload: CreateProfileFieldInput = {
        ...common,
        key: form.key.trim(),
        labelMz: form.labelMz.trim() || undefined,
      };
      return api.post("/admin/profile-fields", payload);
    },
    onSuccess: (_data, { id }) => {
      toast.success(id ? "Question updated" : "Question added");
      void invalidate();
      setFieldDialog({ open: false, editing: null });
    },
    onError: (error) => toast.error(errorMessage(error, "Save failed")),
  });

  const toggleField = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProfileFieldInput }) =>
      api.patch(`/admin/profile-fields/${id}`, payload),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error(errorMessage(error, "Update failed")),
  });

  const deleteField = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/profile-fields/${id}`),
    onSuccess: () => {
      toast.success("Question deleted");
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Delete failed")),
  });

  const saveOption = useMutation({
    mutationFn: ({
      fieldId,
      optionId,
      form,
    }: {
      fieldId: string;
      optionId: string | null;
      form: OptionForm;
    }) => {
      const base = {
        labelEn: form.labelEn.trim(),
        sortOrder: toOrder(form.sortOrder),
      };
      if (optionId) {
        const payload: ProfileFieldOptionInput = {
          ...base,
          labelMz: form.labelMz.trim() || null,
        };
        return api.patch(`/admin/profile-fields/options/${optionId}`, payload);
      }
      return api.post(`/admin/profile-fields/${fieldId}/options`, {
        ...base,
        labelMz: form.labelMz.trim() || undefined,
      });
    },
    onSuccess: (_data, { optionId }) => {
      toast.success(optionId ? "Option updated" : "Option added");
      void invalidate();
      setOptionDialog({ open: false, field: null, editing: null });
    },
    onError: (error) => toast.error(errorMessage(error, "Save failed")),
  });

  const toggleOption = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/admin/profile-fields/options/${id}`, { active }),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error(errorMessage(error, "Update failed")),
  });

  const deleteOption = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/profile-fields/options/${id}`),
    onSuccess: () => {
      toast.success("Option deleted");
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Delete failed")),
  });

  function confirmDeleteField(field: AdminProfileField) {
    const answered = field.options.reduce((sum, o) => sum + o.userCount, 0);
    const impact =
      answered > 0
        ? ` ${answered} answer${answered === 1 ? "" : "s"} will be deleted with it. To keep them, turn "Active" off instead.`
        : "";
    if (window.confirm(`Delete the question "${field.labelEn}" and all its options?${impact}`)) {
      deleteField.mutate(field.id);
    }
  }

  function confirmDeleteOption(option: AdminProfileFieldOption) {
    const impact =
      option.userCount > 0
        ? ` ${option.userCount} user${option.userCount === 1 ? " has" : "s have"} picked it and will lose that answer. To keep it, turn "Active" off instead.`
        : "";
    if (window.confirm(`Delete "${option.labelEn}"?${impact}`)) {
      deleteOption.mutate(option.id);
    }
  }

  const bySection = SECTIONS.map((section) => ({
    ...section,
    fields: (fields ?? []).filter((f) => f.section === section.value),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Profile Questions</h1>
          <p className="text-sm text-muted-foreground">
            The questions and options users see in onboarding and profile edit.
            Changes show in the app right away.
          </p>
        </div>
        <Button size="sm" onClick={() => setFieldDialog({ open: true, editing: null })}>
          New question
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && fields?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No questions yet. Run the seed (npm run db:seed) on the backend, or add one.
        </p>
      )}

      {bySection
        .filter((section) => section.fields.length > 0)
        .map((section) => (
          <section key={section.value} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </h2>
            {section.fields.map((field) => (
              <div
                key={field.id}
                className="rounded-lg border border-border bg-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {field.labelEn}
                      {field.labelMz && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          · {field.labelMz}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{field.key}</code>
                      <Badge variant="secondary">
                        {field.multiSelect ? "Multiple choice" : "Single choice"}
                      </Badge>
                      {field.userCanHide && <Badge variant="outline">User can hide</Badge>}
                      {!field.active && <Badge variant="destructive">Hidden from app</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Active</span>
                    <Switch
                      checked={field.active}
                      disabled={toggleField.isPending}
                      onCheckedChange={(c) =>
                        toggleField.mutate({ id: field.id, payload: { active: !!c } })
                      }
                      aria-label={`Toggle ${field.labelEn}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => setFieldDialog({ open: true, editing: field })}
                      title="Edit question"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={deleteField.isPending}
                      onClick={() => confirmDeleteField(field)}
                      title="Delete question"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Option (English)</TableHead>
                      <TableHead>Mizo</TableHead>
                      <TableHead className="w-16">Order</TableHead>
                      <TableHead className="w-16">Active</TableHead>
                      <TableHead className="w-16">Picked</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {field.options.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          No options yet — users can&apos;t answer this question.
                        </TableCell>
                      </TableRow>
                    )}
                    {field.options.map((option) => (
                      <TableRow key={option.id}>
                        <TableCell className="font-medium">{option.labelEn}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {option.labelMz ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{option.sortOrder}</TableCell>
                        <TableCell>
                          <Switch
                            checked={option.active}
                            disabled={toggleOption.isPending}
                            onCheckedChange={(c) =>
                              toggleOption.mutate({ id: option.id, active: !!c })
                            }
                            aria-label={`Toggle ${option.labelEn}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{option.userCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              onClick={() =>
                                setOptionDialog({ open: true, field, editing: option })
                              }
                              title="Edit option"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              disabled={deleteOption.isPending}
                              onClick={() => confirmDeleteOption(option)}
                              title="Delete option"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t border-border p-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOptionDialog({ open: true, field, editing: null })}
                  >
                    <Plus className="size-3.5" />
                    Add option
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ))}

      <FieldDialog
        open={fieldDialog.open}
        editing={fieldDialog.editing}
        pending={saveField.isPending}
        onClose={() => setFieldDialog({ open: false, editing: null })}
        onSubmit={(form) => saveField.mutate({ id: fieldDialog.editing?.id ?? null, form })}
      />
      <OptionDialog
        open={optionDialog.open}
        field={optionDialog.field}
        editing={optionDialog.editing}
        pending={saveOption.isPending}
        onClose={() => setOptionDialog({ open: false, field: null, editing: null })}
        onSubmit={(form) =>
          optionDialog.field &&
          saveOption.mutate({
            fieldId: optionDialog.field.id,
            optionId: optionDialog.editing?.id ?? null,
            form,
          })
        }
      />
    </div>
  );
}
