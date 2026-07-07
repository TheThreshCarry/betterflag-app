"use client";

import Link from "next/link";

import { useApp } from "@/components/app-shell";
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
import { ChevronsUpDownIcon, FolderKanbanIcon } from "lucide-react";

export function ProjectSwitcher() {
  const { isMobile } = useSidebar();
  const { projects, activeProject, setActiveProjectId } = useApp();

  if (projects.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" render={<Link href="/flags" />}>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <FolderKanbanIcon className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">No projects yet</span>
              <span className="truncate text-xs text-muted-foreground">Create your first project</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!activeProject) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
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
            <DropdownMenuLabel className="text-xs text-muted-foreground">Projects</DropdownMenuLabel>
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
            <DropdownMenuItem className="gap-2 p-2" render={<Link href="/settings" />}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <FolderKanbanIcon className="size-3.5" />
              </div>
              <span className="font-medium text-muted-foreground">Manage projects</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
