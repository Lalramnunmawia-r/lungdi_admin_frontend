"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AdminInterestCategory,
  CreateInterestCategoryInput,
  UpdateInterestCategoryInput,
} from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const QUERY_KEY = ["interest-categories"];

interface Form {
  nameEn: string;
  nameMz: string;
  sortOrder: string;
}

const EMPTY: Form = { nameEn: "", nameMz: "", sortOrder: "0" };

function toOrder(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 10000) : 0;
}

export default function InterestCategoriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminInterestCategory | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: categories, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<AdminInterestCategory[]>("/admin/interest-categories"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    // Category names show on the Interests page too.
    void queryClient.invalidateQueries({ queryKey: ["interests"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        const payload: UpdateInterestCategoryInput = {
          nameEn: form.nameEn.trim(),
          nameMz: form.nameMz.trim() || null,
          sortOrder: toOrder(form.sortOrder),
        };
        return api.patch(`/admin/interest-categories/${editing.id}`, payload);
      }
      const payload: CreateInterestCategoryInput = {
        nameEn: form.nameEn.trim(),
        nameMz: form.nameMz.trim() || undefined,
        sortOrder: toOrder(form.sortOrder),
      };
      return api.post("/admin/interest-categories", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category added");
      invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Save failed");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/admin/interest-categories/${id}`, { active }),
    onSuccess: () => invalidate(),
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/interest-categories/${id}`),
    onSuccess: () => {
      toast.success("Category deleted");
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, sortOrder: String(categories?.length ?? 0) });
    setDialogOpen(true);
  }

  function openEdit(category: AdminInterestCategory) {
    setEditing(category);
    setForm({
      nameEn: category.nameEn,
      nameMz: category.nameMz ?? "",
      sortOrder: String(category.sortOrder),
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY);
  }

  function confirmDelete(category: AdminInterestCategory) {
    const impact =
      category.interestCount > 0
        ? ` Its ${category.interestCount} item${category.interestCount === 1 ? "" : "s"} will stay, but without a category (users keep their picks).`
        : "";
    if (window.confirm(`Delete the category "${category.nameEn}"?${impact}`)) {
      deleteMutation.mutate(category.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Interest Categories</h1>
          <p className="text-sm text-muted-foreground">
            &ldquo;What are you into&rdquo; groups (Food, Gaming, Music…). Add the
            items inside each one on the Interests page.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          New category
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name (English)</TableHead>
              <TableHead>Mizo</TableHead>
              <TableHead className="w-16">Order</TableHead>
              <TableHead className="w-16">Active</TableHead>
              <TableHead className="w-16">Items</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && categories?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            )}
            {categories?.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.nameEn}</TableCell>
                <TableCell className="text-muted-foreground">
                  {category.nameMz ?? "—"}
                </TableCell>
                <TableCell className="font-mono tabular-nums">{category.sortOrder}</TableCell>
                <TableCell>
                  <Switch
                    checked={category.active}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(c) =>
                      toggleMutation.mutate({ id: category.id, active: !!c })
                    }
                    aria-label={`Toggle ${category.nameEn}`}
                  />
                </TableCell>
                <TableCell className="font-mono tabular-nums">{category.interestCount}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => openEdit(category)}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={deleteMutation.isPending}
                      onClick={() => confirmDelete(category)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category-name-en">Name (English)</Label>
                <Input
                  id="category-name-en"
                  value={form.nameEn}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  placeholder="Food"
                  autoFocus
                  required
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-name-mz">Name (Mizo)</Label>
                <Input
                  id="category-name-mz"
                  value={form.nameMz}
                  onChange={(e) => setForm((f) => ({ ...f, nameMz: e.target.value }))}
                  placeholder="Chaw"
                  maxLength={50}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-order">Order</Label>
              <Input
                id="category-order"
                type="number"
                min={0}
                max={10000}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!form.nameEn.trim() || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
