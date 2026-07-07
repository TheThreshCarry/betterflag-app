"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { Chip } from "@/components/ui";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
  pendingApprovals = 0,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
  pendingApprovals?: number;
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.url || pathname.startsWith(`${item.url}/`);
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.title}
                  render={<Link href={item.url} />}
                >
                  <Icon />
                  <span>{item.title}</span>
                  {item.url === "/approvals" && pendingApprovals > 0 ? (
                    <Chip color="green" className="ml-auto !px-2 !py-0 text-[11px]">
                      {pendingApprovals}
                    </Chip>
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
