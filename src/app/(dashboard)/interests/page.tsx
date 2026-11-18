"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { AdminInterest, AdminInterestCategory } from "@/lib/types";
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

// Select values must be strings; these stand in for "no category" / "all".
const NONE = "__none__";
const ALL = "__all__";

export default function InterestsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [type, setType] = useState<"hobby" | "interest">("interest");
  const [filter, setFilter] = useState<string>(ALL);
  const queryClient = useQueryClient();

  const { data: interests, isLoading } = useQuery({
    queryKey: ["interests"],
    queryFn: () => api.get<AdminInterest[]>("/admin/interests"),
  });

  const { data: categories } = useQuery({
    queryKey: ["interest-categories"],
    queryFn: () => api.get<AdminInterestCategory[]>("/admin/interest-categories"),
  });

  const categoryName = (id: string | null) =>
    id === null || id === NONE
      ? "No category"
      : (categories?.find((c) => c.id === id)?.nameEn ?? "Unknown");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["interests"] });
    // Item counts on the categories page change too.
    void queryClient.invalidateQueries({ queryKey: ["interest-categories"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/admin/interests", {
        name: name.trim(),
        type,
        categoryId: categoryId === NONE ? undefined : categoryId,
      }),
    onSuccess: () => {
      toast.success("Interest added");
      invalidate();
      setDialogOpen(false);
      setName("");
      setType("interest");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to add");
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      api.patch(`/admin/interests/${id}`, { categoryId }),
    onSuccess: () => {
      toast.success("Category changed");
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/interests/${id}`),
    onSuccess: () => {
      toast.success("Interest deleted");
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    },
  });

  function confirmDelete(interest: AdminInterest) {
    const impact =
      interest.userCount > 0
        ? ` It is currently selected by ${interest.userCount} profile${interest.userCount === 1 ? "" : "s"} — deleting it removes it from all of them.`
        : "";
    if (window.confirm(`Delete "${interest.name}"?${impact}`)) {
      deleteMutation.mutate(interest.id);
    }
  }

  function openCreate() {
    // Pre-select the category being viewed, so adding items to one is quick.
    setCategoryId(filter === ALL ? NONE : filter);
    setDialogOpen(true);
  }

  const visible = (interests ?? []).filter((interest) =>
    filter === ALL
      ? true
      : filter === NONE
        ? interest.categoryId === null
        : interest.categoryId === filter,
  );

  const categorySelectItems = (
    <>
      <SelectItem value={NONE}>No category</SelectItem>
      {categories?.map((category) => (
        <SelectItem key={category.id} value={category.id}>
          {category.nameEn}
          {!category.active && " (inactive)"}
        </SelectItem>
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Interests</h1>
          <p className="text-sm text-muted-foreground">
            The items users pick under &ldquo;What are you into&rdquo;. Manage the
            groups on Interest Categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
            <SelectTrigger size="sm" className="w-48">
              <SelectValue>
                {(v: string) => (v === ALL ? "All categories" : categoryName(v))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categorySelectItems}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate}>
            New interest
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Profiles</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No interests here yet.
                </TableCell>
              </TableRow>
            )}
            {visible.map((interest) => (
              <TableRow key={interest.id}>
                <TableCell className="font-medium">{interest.name}</TableCell>
                <TableCell className="capitalize">{interest.type}</TableCell>
                <TableCell>
                  <Select
                    value={interest.categoryId ?? NONE}
                    onValueChange={(v) =>
                      v &&
                      v !== (interest.categoryId ?? NONE) &&
                      moveMutation.mutate({
                        id: interest.id,
                        categoryId: v === NONE ? null : v,
                      })
                    }
                    disabled={moveMutation.isPending}
                  >
                    <SelectTrigger size="sm" className="w-48">
                      <SelectValue>{(v: string) => categoryName(v)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>{categorySelectItems}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{interest.userCount}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={deleteMutation.isPending}
                    onClick={() => confirmDelete(interest)}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New interest</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="interest-name">Name</Label>
              <Input
                id="interest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mizo food"
                autoFocus
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interest-category">Category</Label>
              <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                <SelectTrigger id="interest-category" className="w-full">
                  <SelectValue>{(v: string) => categoryName(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>{categorySelectItems}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interest-type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as "hobby" | "interest")}>
                <SelectTrigger id="interest-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="hobby">Hobby</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only used for matching and older app versions; users see the category.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
