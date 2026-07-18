"use client";

import { useEffect, useState } from "react";

import { useApp } from "@/components/app-shell";
import { Button, Dialog, ErrorNote, Field, inputClass } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ApiProject } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { ChevronsUpDownIcon, FolderKanbanIcon, PlusIcon } from "lucide-react";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Derive a URL-safe slug from a free-text name. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function ProjectSwitcher() {
  const { isMobile } = useSidebar();
  const { projects, activeProject, setActiveProjectId } = useApp();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          {projects.length === 0 || !activeProject ? (
            <SidebarMenuButton size="lg" onClick={() => setCreateOpen(true)}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <FolderKanbanIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">No projects yet</span>
                <span className="truncate text-xs text-muted-foreground">
                  Create your first project
                </span>
              </div>
            </SidebarMenuButton>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FolderKanbanIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{activeProject.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{activeProject.slug}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Projects
                </DropdownMenuLabel>
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => setActiveProjectId(project.id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <FolderKanbanIcon className="size-3.5 shrink-0" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">{project.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{project.slug}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={() => setCreateOpen(true)}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <PlusIcon className="size-3.5" />
                  </div>
                  <span className="font-medium">Create project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refreshProjects, setActiveProjectId } = useApp();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setSlugEdited(false);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  function onNameChange(value: string) {
    setName(value);
    // Keep the slug in sync with the name until the user edits it directly.
    if (!slugEdited) setSlug(slugify(value));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { project } = await api<{ project: ApiProject }>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), slug }),
      });
      await refreshProjects();
      setActiveProjectId(project.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length > 0 && SLUG_RE.test(slug) && !busy;

  return (
    <Dialog open={open} onClose={onClose} title="New project">
      <div className="space-y-4">
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Web app"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) void submit();
            }}
          />
        </Field>

        <Field label="Slug" hint="Lowercase letters, digits and dashes. Used in URLs and SDK config.">
          <input
            className={inputClass}
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            placeholder="web-app"
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) void submit();
            }}
          />
        </Field>

        <p className="text-[12px] text-ink-muted">
          Starts with <span className="font-medium">dev</span>,{" "}
          <span className="font-medium">staging</span> and{" "}
          <span className="font-medium">prod</span> environments.
        </p>

        <ErrorNote message={error} />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!canSubmit} onClick={() => void submit()}>
            {busy ? "Creating…" : "Create project"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
