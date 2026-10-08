"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AdminRelationshipStatus,
  CreateRelationshipStatusInput,
  UpdateRelationshipStatusInput,
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

export default function RelationshipStatusesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<AdminRelationshipStatus | null>(null);
  const [editName, setEditName] = useState("");
  const queryClient = useQueryClient();

  const { data: statuses, isLoading } = useQuery({
    queryKey: ["relationship-statuses"],
    queryFn: () => api.get<AdminRelationshipStatus[]>("/admin/relationship-statuses"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRelationshipStatusInput) =>
      api.post("/admin/relationship-statuses", payload),
    onSuccess: () => {
      toast.success("Relationship status added");
      void queryClient.invalidateQueries({ queryKey: ["relationship-statuses"] });
      setCreateOpen(false);
      setName("");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to add");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRelationshipStatusInput }) =>
      api.patch(`/admin/relationship-statuses/${id}`, payload),
    onSuccess: () => {
      toast.success("Relationship status updated");
      void queryClient.invalidateQueries({ queryKey: ["relationship-statuses"] });
      setEditOpen(false);
      setEditing(null);
      setEditName("");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/relationship-statuses/${id}`),
    onSuccess: () => {
      toast.success("Relationship status deleted");
      void queryClient.invalidateQueries({ queryKey: ["relationship-statuses"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    },
  });

  function confirmDelete(status: AdminRelationshipStatus) {
    const impact =
      status.userCount > 0
        ? ` It is currently selected by ${status.userCount} profile${status.userCount === 1 ? "" : "s"} — deleting it removes it from all of them.`
        : "";
    if (window.confirm(`Delete "${status.name}"?${impact}`)) {
      deleteMutation.mutate(status.id);
    }
  }

  function openEdit(status: AdminRelationshipStatus) {
    setEditing(status);
    setEditName(status.name);
    setEditOpen(true);
  }

  function toggleActive(status: AdminRelationshipStatus, active: boolean) {
    updateMutation.mutate({
      id: status.id,
      payload: { active },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Relationship Statuses</h1>
          <p className="text-sm text-muted-foreground">Manage profile relationship-status options</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New status
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
            {!isLoading && statuses?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No relationship statuses yet.
                </TableCell>
              </TableRow>
            )}
            {statuses?.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="font-medium">{status.name}</TableCell>
                <TableCell>
                  <Switch
                    checked={status.active}
                    disabled={updateMutation.isPending}
                    onCheckedChange={(checked) => toggleActive(status, !!checked)}
                    aria-label={`Toggle ${status.name}`}
                  />
                </TableCell>
                <TableCell className="font-mono tabular-nums">{status.userCount}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={updateMutation.isPending}
                      onClick={() => openEdit(status)}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={deleteMutation.isPending}
                      onClick={() => confirmDelete(status)}
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
            <DialogTitle>New relationship status</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ name: name.trim() });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="relationship-status-name">Name</Label>
              <Input
                id="relationship-status-name"
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
            <DialogTitle>Edit relationship status</DialogTitle>
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
              <Label htmlFor="relationship-status-edit-name">Name</Label>
              <Input
                id="relationship-status-edit-name"
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
