"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AdminDesignation,
  CreateDesignationInput,
  UpdateDesignationInput,
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

export default function DesignationsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<AdminDesignation | null>(null);
  const [editName, setEditName] = useState("");
  const queryClient = useQueryClient();

  const { data: designations, isLoading } = useQuery({
    queryKey: ["designations"],
    queryFn: () => api.get<AdminDesignation[]>("/admin/designations"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateDesignationInput) =>
      api.post("/admin/designations", payload),
    onSuccess: () => {
      toast.success("Designation added");
      void queryClient.invalidateQueries({ queryKey: ["designations"] });
      setCreateOpen(false);
      setName("");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to add");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDesignationInput }) =>
      api.patch(`/admin/designations/${id}`, payload),
    onSuccess: () => {
      toast.success("Designation updated");
      void queryClient.invalidateQueries({ queryKey: ["designations"] });
      setEditOpen(false);
      setEditing(null);
      setEditName("");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/designations/${id}`),
    onSuccess: () => {
      toast.success("Designation deleted");
      void queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    },
  });

  function confirmDelete(designation: AdminDesignation) {
    const impact =
      designation.userCount > 0
        ? ` It is currently selected by ${designation.userCount} profile${designation.userCount === 1 ? "" : "s"} — deleting it removes it from all of them.`
        : "";
    if (window.confirm(`Delete "${designation.name}"?${impact}`)) {
      deleteMutation.mutate(designation.id);
    }
  }

  function openEdit(designation: AdminDesignation) {
    setEditing(designation);
    setEditName(designation.name);
    setEditOpen(true);
  }

  function toggleActive(designation: AdminDesignation, active: boolean) {
    updateMutation.mutate({
      id: designation.id,
      payload: { active },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Designations</h1>
          <p className="text-sm text-muted-foreground">Manage occupation options for user profiles</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New designation
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Profiles</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && designations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No designations yet.
                </TableCell>
              </TableRow>
            )}
            {designations?.map((designation) => (
              <TableRow key={designation.id}>
                <TableCell className="font-medium">{designation.name}</TableCell>
                <TableCell>
                  <Switch
                    checked={designation.active}
                    disabled={updateMutation.isPending}
                    onCheckedChange={(checked) => toggleActive(designation, !!checked)}
                    aria-label={`Toggle ${designation.name}`}
                  />
                </TableCell>
                <TableCell className="font-mono tabular-nums">{designation.userCount}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={updateMutation.isPending}
                      onClick={() => openEdit(designation)}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={deleteMutation.isPending}
                      onClick={() => confirmDelete(designation)}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New designation</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ name: name.trim() });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="designation-name">Name</Label>
              <Input
                id="designation-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                maxLength={50}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
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

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditing(null);
            setEditName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit designation</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing) return;
              updateMutation.mutate({
                id: editing.id,
                payload: { name: editName.trim() },
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="designation-edit-name">Name</Label>
              <Input
                id="designation-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                required
                maxLength={50}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!editName.trim() || updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
