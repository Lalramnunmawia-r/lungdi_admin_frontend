"use client";

import { useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Pencil,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
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

/** True when a drag started on a control (button, switch, input) — not the row itself. */
function isInteractive(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("button, input, [role=switch], a") !== null
  );
}

/** `ids` with `fromId` moved to where `toId` is. */
function moveId(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

/** Sort `items` to follow `ids`. */
function orderBy<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const position = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
  );
}

// ---------------------------------------------------------------------------
// Drag-and-drop (native HTML5, within one list)
// ---------------------------------------------------------------------------

/**
 * Tracks one drag inside one list (a section's questions, or one question's
 * options). `group` keeps a drag from dropping into a different list.
 */
function useDragReorder(onReorder: (group: string, fromId: string, toId: string) => void) {
  const [dragging, setDragging] = useState<{ group: string; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const itemProps = (group: string, id: string) => ({
    onDragStart: (e: DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      // Firefox needs data set to start a drag.
      e.dataTransfer.setData("text/plain", id);
      setDragging({ group, id });
    },
    onDragOver: (e: DragEvent) => {
      if (!dragging || dragging.group !== group) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (over !== id) setOver(id);
    },
    onDrop: (e: DragEvent) => {
      if (!dragging || dragging.group !== group) return;
      e.preventDefault();
      e.stopPropagation();
      if (dragging.id !== id) onReorder(group, dragging.id, id);
      setDragging(null);
      setOver(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });

  return {
    itemProps,
    isDragging: (id: string) => dragging?.id === id,
    isOver: (id: string) => over === id && dragging?.id !== id,
  };
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
  required: boolean;
}

const EMPTY_FIELD: FieldForm = {
  key: "",
  labelEn: "",
  labelMz: "",
  section: "lifestyle",
  multiSelect: false,
  userCanHide: false,
  required: false,
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
            required: editing.required,
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
            {!editing && (
              <p className="text-xs text-muted-foreground">
                New questions go at the end of the section — drag to move them.
              </p>
            )}
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
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Required</p>
                <p className="text-xs text-muted-foreground">
                  Users must answer it to finish onboarding, and can&apos;t clear it later
                </p>
              </div>
              <Switch
                checked={form.required}
                onCheckedChange={(c) => set("required", !!c)}
                aria-label="Required"
              />
            </div>
            {form.required && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                Older app versions that don&apos;t show this question will not be able to
                finish onboarding. Only make it required once the app version that shows
                it is out and users have updated.
              </p>
            )}
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
  allowsText: boolean;
  textLabelEn: string;
  textLabelMz: string;
}

const EMPTY_OPTION: OptionForm = {
  labelEn: "",
  labelMz: "",
  allowsText: false,
  textLabelEn: "",
  textLabelMz: "",
};

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
  const [form, setForm] = useState<OptionForm>(EMPTY_OPTION);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const target = open ? (editing?.id ?? `new:${field?.id}`) : null;
  if (target !== loadedFor) {
    setLoadedFor(target);
    setForm(
      editing
        ? {
            labelEn: editing.labelEn,
            labelMz: editing.labelMz ?? "",
            allowsText: editing.allowsText,
            textLabelEn: editing.textLabelEn ?? "",
            textLabelMz: editing.textLabelMz ?? "",
          }
        : EMPTY_OPTION,
    );
  }
  const set = <K extends keyof OptionForm>(key: K, value: OptionForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Allow text input</p>
                <p className="text-xs text-muted-foreground">
                  Picking this option shows a text box (optional to fill), e.g. PhD →
                  Speciality
                </p>
              </div>
              <Switch
                checked={form.allowsText}
                onCheckedChange={(c) => set("allowsText", !!c)}
                aria-label="Allow text input"
              />
            </div>
            {form.allowsText && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="option-text-label-en">Text box label (English)</Label>
                  <Input
                    id="option-text-label-en"
                    value={form.textLabelEn}
                    onChange={(e) => set("textLabelEn", e.target.value)}
                    placeholder="Speciality"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option-text-label-mz">Text box label (Mizo)</Label>
                  <Input
                    id="option-text-label-mz"
                    value={form.textLabelMz}
                    onChange={(e) => set("textLabelMz", e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
            )}
            {editing?.allowsText && !form.allowsText && (
              <p className="text-xs text-muted-foreground">
                Text users already typed is kept; new text won&apos;t be accepted.
              </p>
            )}
          </div>
          {!editing && (
            <p className="text-xs text-muted-foreground">
              New options go at the end — drag to move them.
            </p>
          )}
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

  // --- Reordering: update the screen at once, then save; roll back on error.
  const reorderFields = useMutation({
    mutationFn: (payload: { section: ProfileFieldSection; ids: string[] }) =>
      api.put("/admin/profile-fields/reorder", payload),
    onError: (error) => {
      toast.error(errorMessage(error, "Couldn't save the order"));
      void invalidate();
    },
  });

  const reorderOptions = useMutation({
    mutationFn: ({ fieldId, ids }: { fieldId: string; ids: string[] }) =>
      api.put(`/admin/profile-fields/${fieldId}/options/reorder`, { ids }),
    onError: (error) => {
      toast.error(errorMessage(error, "Couldn't save the order"));
      void invalidate();
    },
  });

  function moveField(section: string, fromId: string, toId: string) {
    const current = queryClient.getQueryData<AdminProfileField[]>(QUERY_KEY) ?? [];
    const ids = moveId(
      current.filter((f) => f.section === section).map((f) => f.id),
      fromId,
      toId,
    );
    queryClient.setQueryData<AdminProfileField[]>(QUERY_KEY, (old) => {
      if (!old) return old;
      const position = new Map(ids.map((id, index) => [id, index]));
      return old.map((f) =>
        position.has(f.id) ? { ...f, sortOrder: position.get(f.id)! } : f,
      );
    });
    reorderFields.mutate({ section: section as ProfileFieldSection, ids });
  }

  function moveOption(fieldId: string, fromId: string, toId: string) {
    const current = queryClient.getQueryData<AdminProfileField[]>(QUERY_KEY) ?? [];
    const field = current.find((f) => f.id === fieldId);
    if (!field) return;
    const ids = moveId(
      field.options.map((o) => o.id),
      fromId,
      toId,
    );
    queryClient.setQueryData<AdminProfileField[]>(QUERY_KEY, (old) =>
      old?.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              options: orderBy(f.options, ids).map((o, index) => ({
                ...o,
                sortOrder: index,
              })),
            }
          : f,
      ),
    );
    reorderOptions.mutate({ fieldId, ids });
  }

  const fieldDrag = useDragReorder(moveField);
  const optionDrag = useDragReorder(moveOption);

  // --- Create / edit / delete -------------------------------------------------
  const saveField = useMutation({
    mutationFn: async ({ id, form }: { id: string | null; form: FieldForm }) => {
      const common = {
        labelEn: form.labelEn.trim(),
        section: form.section,
        multiSelect: form.multiSelect,
        userCanHide: form.userCanHide,
        required: form.required,
      };
      if (id) {
        const payload: UpdateProfileFieldInput = {
          ...common,
          labelMz: form.labelMz.trim() || null,
        };
        return api.patch(`/admin/profile-fields/${id}`, payload);
      }
      // No sortOrder: the server puts a new question last in its section.
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
      if (optionId) {
        const payload: ProfileFieldOptionInput = {
          labelEn: form.labelEn.trim(),
          labelMz: form.labelMz.trim() || null,
          allowsText: form.allowsText,
          textLabelEn: form.textLabelEn.trim() || null,
          textLabelMz: form.textLabelMz.trim() || null,
        };
        return api.patch(`/admin/profile-fields/options/${optionId}`, payload);
      }
      // No sortOrder: the server puts a new option last.
      return api.post(`/admin/profile-fields/${fieldId}/options`, {
        labelEn: form.labelEn.trim(),
        labelMz: form.labelMz.trim() || undefined,
        allowsText: form.allowsText,
        textLabelEn: form.textLabelEn.trim() || undefined,
        textLabelMz: form.textLabelMz.trim() || undefined,
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
    fields: (fields ?? [])
      .filter((f) => f.section === section.value)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.labelEn.localeCompare(b.labelEn)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Profile Questions</h1>
          <p className="text-sm text-muted-foreground">
            The questions and options users see in onboarding and profile edit.
            Change the order by dragging a question or option
            (<GripVertical className="inline size-3.5 align-text-bottom" />) or with the
            ↑ ↓ arrows — it saves automatically and shows in the app right away.
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
            {section.fields.map((field, fieldIndex) => {
              const drag = fieldDrag.itemProps(section.value, field.id);
              const prevField = section.fields[fieldIndex - 1];
              const nextField = section.fields[fieldIndex + 1];
              return (
              <div
                key={field.id}
                // The whole card is the drop target; the header row is what
                // you grab (so option rows inside keep their own drag).
                onDragOver={drag.onDragOver}
                onDrop={drag.onDrop}
                className={cn(
                  "rounded-lg border border-border bg-card transition-opacity",
                  fieldDrag.isDragging(field.id) && "opacity-40",
                  fieldDrag.isOver(field.id) && "ring-2 ring-primary",
                )}
              >
                <div
                  draggable
                  onDragStart={(e) => {
                    // Don't hijack clicks/drags on the switch and buttons.
                    if (isInteractive(e.target)) {
                      e.preventDefault();
                      return;
                    }
                    drag.onDragStart(e);
                  }}
                  onDragEnd={drag.onDragEnd}
                  className="flex cursor-grab flex-wrap items-start justify-between gap-3 border-b border-border p-4 active:cursor-grabbing"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 text-muted-foreground"
                      title="Drag to reorder"
                      aria-hidden
                    >
                      <GripVertical className="size-4" />
                    </span>
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
                        {field.required && <Badge>Required</Badge>}
                        {field.userCanHide && <Badge variant="outline">User can hide</Badge>}
                        {!field.active && <Badge variant="destructive">Hidden from app</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={!prevField || reorderFields.isPending}
                      onClick={() =>
                        prevField && moveField(section.value, field.id, prevField.id)
                      }
                      title="Move up"
                      aria-label={`Move ${field.labelEn} up`}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={!nextField || reorderFields.isPending}
                      onClick={() =>
                        nextField && moveField(section.value, field.id, nextField.id)
                      }
                      title="Move down"
                      aria-label={`Move ${field.labelEn} down`}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
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
                      <TableHead className="w-8" />
                      <TableHead>Option (English)</TableHead>
                      <TableHead>Mizo</TableHead>
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
                    {[...field.options]
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((option, optionIndex, sortedOptions) => {
                        const prevOption = sortedOptions[optionIndex - 1];
                        const nextOption = sortedOptions[optionIndex + 1];
                        return (
                        <TableRow
                          key={option.id}
                          draggable
                          {...optionDrag.itemProps(field.id, option.id)}
                          className={cn(
                            optionDrag.isDragging(option.id) && "opacity-40",
                            optionDrag.isOver(option.id) && "bg-primary/10",
                          )}
                        >
                          <TableCell className="cursor-grab text-muted-foreground active:cursor-grabbing">
                            <GripVertical className="size-4" aria-label="Drag to reorder" />
                          </TableCell>
                          <TableCell className="font-medium">
                            {option.labelEn}
                            {option.allowsText && (
                              <Badge variant="outline" className="ml-2">
                                <PencilLine /> {option.textLabelEn ?? "Text"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {option.labelMz ?? "—"}
                          </TableCell>
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
                                disabled={!prevOption || reorderOptions.isPending}
                                onClick={() =>
                                  prevOption && moveOption(field.id, option.id, prevOption.id)
                                }
                                title="Move up"
                                aria-label={`Move ${option.labelEn} up`}
                              >
                                <ChevronUp className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                disabled={!nextOption || reorderOptions.isPending}
                                onClick={() =>
                                  nextOption && moveOption(field.id, option.id, nextOption.id)
                                }
                                title="Move down"
                                aria-label={`Move ${option.labelEn} down`}
                              >
                                <ChevronDown className="size-3.5" />
                              </Button>
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
                        );
                      })}
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
              );
            })}
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
