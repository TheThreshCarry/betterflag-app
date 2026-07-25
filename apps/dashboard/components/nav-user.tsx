"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

function UserAvatar({
  avatarUrl,
  fallback,
  className,
}: {
  avatarUrl: string | null;
  fallback: string;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external media CDN URL
      <img
        src={avatarUrl}
        alt=""
        className={className ?? "aspect-square size-8 rounded-lg object-cover"}
      />
    );
  }
  return (
    <div
      className={
        className ??
        "flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground"
      }
    >
      {fallback}
    </div>
  );
}

export function NavUser({
  userEmail,
  orgName,
  avatarUrl,
  signingOut,
  onSignOut,
}: {
  userEmail: string | null;
  orgName: string;
  avatarUrl: string | null;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const initials = (userEmail ?? "U").slice(0, 2).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            <UserAvatar avatarUrl={avatarUrl} fallback={initials} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{userEmail ?? "Signed in"}</span>
              <span className="truncate text-xs text-muted-foreground">{orgName}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                  <UserAvatar
                    avatarUrl={avatarUrl}
                    fallback={initials}
                    className={
                      avatarUrl
                        ? "size-8 rounded-lg object-cover"
                        : "flex size-8 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-semibold"
                    }
                  />
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{userEmail ?? "Signed in"}</span>
                    <span className="truncate text-xs text-muted-foreground">{orgName}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings/account")}>
              <SettingsIcon />
              Account settings
            </DropdownMenuItem>
            <ThemeToggle />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={signingOut}
              onClick={onSignOut}
              className="text-chip-pink focus:text-chip-pink"
            >
              <LogOutIcon />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
