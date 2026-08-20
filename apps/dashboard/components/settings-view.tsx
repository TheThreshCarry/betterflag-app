"use client";

import { ANALYTICS_HOT_DAYS, ANALYTICS_RETENTION_DAYS, PLAN_LIMITS } from "@betterflag/db";
import {
  BarChart3Icon,
  Building2Icon,
  CheckIcon,
  CreditCardIcon,
  FolderKanbanIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AppearanceSettings } from "@/components/appearance-settings";
import { useApp } from "@/components/app-shell";
import { ImageUploadField } from "@/components/image-upload-field";
import { Stagger } from "@/components/stagger";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, Card, Chip, CopyButton, ErrorNote, type ChipColor } from "@/components/ui";
import type { ApiOrg, ApiProfile, ApiProject } from "@/lib/api-types";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { tierForPlan, usePricingTiers } from "@/lib/use-pricing";
import { toast } from "@/lib/toast";

export type SettingsSection = "organization" | "project" | "usage" | "billing" | "account";

const SETTINGS_NAV = [
  {
    key: "organization",
    label: "Organization",
    description: "Workspace and members",
    href: "/settings",
    icon: Building2Icon,
  },
  {
    key: "project",
    label: "Project",
    description: "Current project",
    href: "/settings/project",
    icon: FolderKanbanIcon,
  },
  {
    key: "usage",
    label: "Usage",
    description: "Evaluations meter",
    href: "/settings/usage",
    icon: BarChart3Icon,
  },
  {
    key: "billing",
    label: "Billing",
    description: "Plan and invoices",
    href: "/settings/billing",
    icon: CreditCardIcon,
  },
  {
    key: "account",
    label: "Account",
    description: "Personal settings",
    href: "/settings/account",
    icon: UserRoundIcon,
  },
] as const;

const ROLE_COLORS: Record<string, ChipColor> = {
  owner: "orange",
  admin: "blue",
  member: "gray",
};

export function SettingsView({ section }: { section: SettingsSection }) {
  const { org: shellOrg } = useApp();
  const [org, setOrg] = useState<ApiOrg>(shellOrg);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(section === "organization");

  useEffect(() => {
    setOrg((prev) => ({
      ...shellOrg,
      members: prev.members ?? shellOrg.members,
    }));
  }, [shellOrg]);

  const loadOrg = useCallback(
    async (includeMembers = false) => {
      try {
        const suffix = includeMembers ? "?members=1" : "";
        const { orgs } = await api<{ orgs: ApiOrg[] }>(`/api/v1/orgs${suffix}`);
        if (orgs[0]) setOrg(orgs[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        if (includeMembers) setLoadingMembers(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (section === "organization") void loadOrg(true);
  }, [loadOrg, section]);

  useEffect(() => {
    if (section !== "billing") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    setCheckoutSuccess(true);
    const timer = setTimeout(() => void loadOrg(), 4000);
    return () => clearTimeout(timer);
  }, [loadOrg, section]);

  return (
    <Stagger key={section}>
      {error ? (
        <div className="mb-5">
          <ErrorNote message={error} />
        </div>
      ) : null}
      {checkoutSuccess ? (
        <StatusBanner
          color="green"
          title="Payment received"
          body="Your plan will update here when payment processing finishes."
        />
      ) : null}
      {org.restricted ? (
        <StatusBanner
          color="orange"
          title="Workspace is read-only"
          body={`${org.billingMessage} Update payment details to make changes again.`}
        />
      ) : null}

      {section === "organization" ? (
        <OrganizationSettings org={org} loadingMembers={loadingMembers} staggerSelf />
      ) : null}
      {section === "project" ? <ProjectSettings staggerSelf /> : null}
      {section === "billing" ? <BillingSettings org={org} staggerSelf /> : null}
      {section === "account" ? <AccountSettings org={org} staggerSelf /> : null}
    </Stagger>
  );
}

export function SettingsNav({ active }: { active: SettingsSection }) {
  return (
    <nav aria-label="Settings" className="-mx-2 flex gap-1 overflow-x-auto px-2 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
      {SETTINGS_NAV.map((item) => {
        const Icon = item.icon;
        const selected = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 transition-colors lg:min-w-0",
              selected ? "bg-surface text-ink" : "text-ink-muted hover:bg-surface/70 hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>
              <span className="block text-[13px] font-medium">{item.label}</span>
              <span className="hidden text-[11px] text-ink-muted lg:block">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function OrganizationSettings({
  org,
  loadingMembers,
  staggerFrom = 0,
  staggerSelf: _staggerSelf,
}: {
  org: ApiOrg;
  loadingMembers: boolean;
  staggerFrom?: number;
  staggerSelf?: boolean;
}) {
  const { patchOrg, refreshOrgs } = useApp();
  const canEdit = org.role === "owner" || org.role === "admin";

  return (
    <SettingsPanel
      title="Organization"
      description="Details shared across every project in this workspace."
      staggerFrom={staggerFrom}
    >
      <Card className="overflow-hidden px-5 py-5">
        <ImageUploadField
          label="Logo"
          description="Shown in the sidebar and transactional emails. PNG, JPEG, WebP, or SVG · max 1MB."
          imageUrl={org.logoUrl}
          canEdit={canEdit}
          onUpload={async (file) => {
            const body = new FormData();
            body.set("file", file);
            const { org: updated } = await api<{ org: ApiOrg }>(`/api/v1/orgs/${org.id}/logo`, {
              method: "POST",
              body,
            });
            patchOrg(updated);
            await refreshOrgs();
            toast.success({ title: "Logo updated" });
          }}
          onRemove={async () => {
            const { org: updated } = await api<{ org: ApiOrg }>(`/api/v1/orgs/${org.id}/logo`, {
              method: "DELETE",
            });
            patchOrg(updated);
            await refreshOrgs();
            toast.success({ title: "Logo removed" });
          }}
        />
      </Card>

      <Card className="mt-4 overflow-hidden">
        <DefinitionRow label="Name" value={org.name} />
        <DefinitionRow
          label="Organization ID"
          value={<span className="font-mono text-[12px]">{org.id}</span>}
          action={<CopyButton text={org.id} />}
        />
        <DefinitionRow
          label="Your role"
          value={<Chip color={ROLE_COLORS[org.role] ?? "gray"}>{org.role}</Chip>}
        />
      </Card>

      <section className="mt-8">
        <div className="mb-3">
          <h3 className="text-[15px] font-semibold">Members</h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            People with access to this organization.
          </p>
        </div>
        <Card className="overflow-hidden">
          {loadingMembers
            ? Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-b-0"
                >
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))
            : (org.members ?? []).map((member) => {
                const email = member.email ?? `${member.userId.slice(0, 8)}…`;
                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-b-0"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[12px] font-semibold">
                      {email.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{email}</p>
                      <p className="text-[12px] text-ink-muted">
                        Joined {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Chip
                      color={ROLE_COLORS[member.role] ?? "gray"}
                      className="px-2.5! py-0.5! text-[12px]"
                    >
                      {member.role}
                    </Chip>
                  </div>
                );
              })}
          {!loadingMembers && (org.members ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-muted">
              Member list unavailable.
            </p>
          ) : null}
        </Card>
        <p className="mt-3 text-[12px] text-ink-muted">
          Invites and role management are not available during alpha.
        </p>
      </section>
    </SettingsPanel>
  );
}

function ProjectSettings({
  staggerFrom = 0,
  staggerSelf: _staggerSelf,
}: {
  staggerFrom?: number;
  staggerSelf?: boolean;
}) {
  const { activeProject, environments, org, patchProject } = useApp();
  const canEdit = org.role === "owner" || org.role === "admin";

  return (
    <SettingsPanel
      title="Project"
      description="Settings for the project selected in the sidebar."
      staggerFrom={staggerFrom}
    >
      {!activeProject ? (
        <Card className="px-6 py-10 text-center">
          <p className="text-[14px] font-medium">No project selected</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Create or select a project from the sidebar.
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden px-5 py-5">
            <ImageUploadField
              label="Picture"
              description="Shown in the project switcher. PNG, JPEG, WebP, or SVG · max 1MB."
              imageUrl={activeProject.pictureUrl}
              canEdit={canEdit}
              onUpload={async (file) => {
                const body = new FormData();
                body.set("file", file);
                const { project } = await api<{ project: ApiProject }>(
                  `/api/v1/projects/${activeProject.id}/picture`,
                  { method: "POST", body },
                );
                patchProject(project);
                toast.success({ title: "Project picture updated" });
              }}
              onRemove={async () => {
                const { project } = await api<{ project: ApiProject }>(
                  `/api/v1/projects/${activeProject.id}/picture`,
                  { method: "DELETE" },
                );
                patchProject(project);
                toast.success({ title: "Project picture removed" });
              }}
            />
          </Card>

          <Card className="mt-4 overflow-hidden">
            <DefinitionRow label="Name" value={activeProject.name} />
            <DefinitionRow
              label="Slug"
              value={<span className="font-mono text-[12px]">{activeProject.slug}</span>}
            />
            <DefinitionRow
              label="Project ID"
              value={<span className="font-mono text-[12px]">{activeProject.id}</span>}
              action={<CopyButton text={activeProject.id} />}
            />
            <DefinitionRow
              label="Created"
              value={new Date(activeProject.createdAt).toLocaleDateString()}
            />
          </Card>

          <section className="mt-8">
            <div className="mb-3">
              <h3 className="text-[15px] font-semibold">Environments</h3>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                Isolated configuration stages for this project.
              </p>
            </div>
            <Card className="overflow-hidden">
              {environments.map((environment) => (
                <div
                  key={environment.id}
                  className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0"
                >
                  <div>
                    <p className="text-[14px] font-medium">{environment.name}</p>
                    <p className="font-mono text-[12px] text-ink-muted">{environment.slug}</p>
                  </div>
                  <Chip color={environment.slug === "prod" ? "green" : "gray"}>
                    {environment.slug === "prod" ? "Production" : "Non-production"}
                  </Chip>
                </div>
              ))}
            </Card>
          </section>
        </>
      )}
    </SettingsPanel>
  );
}

function BillingSettings({
  org,
  staggerFrom = 0,
  staggerSelf: _staggerSelf,
}: {
  org: ApiOrg;
  staggerFrom?: number;
  staggerSelf?: boolean;
}) {
  const tiers = usePricingTiers();
  const tier = tierForPlan(tiers, org.plan);
  const limits = tier
    ? {
        projects: tier.projects,
        agentKeys: tier.agentKeys,
        includedEvalsPerMonth: tier.includedEvaluations,
      }
    : PLAN_LIMITS[org.plan];
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const hasBillingAccount = ["active", "grace", "restricted"].includes(org.billingState);

  async function openBillingPortal() {
    setCheckoutError(null);
    setOpeningPortal(true);
    try {
      const { url } = await api<{ url: string }>("/api/v1/portal", { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Could not open billing portal");
      setOpeningPortal(false);
    }
  }

  async function startCheckout(plan: string) {
    setCheckoutError(null);
    setCheckingOut(plan);
    try {
      const { url } = await api<{ url: string }>("/api/v1/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Could not start checkout");
      setCheckingOut(null);
    }
  }

  return (
    <SettingsPanel
      title="Billing"
      description="Subscription, usage limits, and data retention."
      staggerFrom={staggerFrom}
    >
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-semibold">{tier?.name ?? org.plan}</h3>
              <Chip color={org.billingState === "trialing" ? "orange" : "green"}>
                {org.billingState === "trialing" ? "Trial" : "Active"}
              </Chip>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">
              {tier ? `${tier.price}${tier.period}` : "Current subscription"}
              {org.billingState === "trialing"
                ? ` · Trial ends ${new Date(org.trialEndsAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
          {hasBillingAccount ? (
            <Button
              variant="secondary"
              size="sm"
              loading={openingPortal}
              onClick={() => void openBillingPortal()}
            >
              Manage invoices
            </Button>
          ) : null}
        </div>
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric value={limits.projects === null ? "∞" : limits.projects} label="Projects" />
          <Metric value={limits.agentKeys === null ? "∞" : limits.agentKeys} label="Agent keys" />
          <Metric
            value={`${(limits.includedEvalsPerMonth / 1_000_000).toLocaleString()}M`}
            label="Evaluations / month"
          />
        </div>
        <div className="grid border-t border-line sm:grid-cols-2 sm:divide-x sm:divide-line">
          <Metric value={`${ANALYTICS_HOT_DAYS} days`} label="Fast analytics storage" compact />
          <Metric
            value={`${ANALYTICS_RETENTION_DAYS[org.plan]} days`}
            label="Total data retention"
            compact
          />
        </div>
      </Card>

      {tiers === null || tiers.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3">
            <h3 className="text-[15px] font-semibold">Available plans</h3>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Checkout and subscription management are handled securely by Polar.
            </p>
          </div>
          {checkoutError ? <div className="mb-3"><ErrorNote message={checkoutError} /></div> : null}
          <div className="grid gap-3 md:grid-cols-3">
            {tiers === null
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="p-5">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="mt-3 h-7 w-24" />
                    <Skeleton className="mt-2 h-4 w-32" />
                    <Skeleton className="mt-6 h-8 w-full rounded-2xl" />
                  </Card>
                ))
              : tiers.map((option) => {
                  const isCurrent = option.key === org.plan;
                  return (
                    <Card
                      key={option.key}
                      className={cn(
                        "flex flex-col p-5",
                        option.popular && "border-chip-orange",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[15px] font-semibold">{option.name}</h4>
                        {option.popular ? (
                          <Chip color="orange" className="px-2! py-0.5! text-[11px]">
                            Popular
                          </Chip>
                        ) : null}
                      </div>
                      <p className="mt-2 font-mono text-[20px] font-semibold">
                        {option.price}
                        <span className="text-[12px] font-normal text-ink-muted">
                          {option.period}
                        </span>
                      </p>
                      <p className="mt-1 text-[12px] text-ink-muted">
                        {(option.includedEvaluations / 1_000_000).toLocaleString()}M evaluations
                        monthly
                      </p>
                      <Button
                        variant={isCurrent ? "secondary" : "primary"}
                        size="sm"
                        className="mt-5 w-full"
                        loading={checkingOut === option.key}
                        disabled={isCurrent || checkingOut !== null}
                        onClick={() => void startCheckout(option.key)}
                      >
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CheckIcon className="size-3.5" /> Current plan
                          </span>
                        ) : (
                          `Choose ${option.name}`
                        )}
                      </Button>
                    </Card>
                  );
                })}
          </div>
        </section>
      ) : null}
    </SettingsPanel>
  );
}

function AccountSettings({
  org,
  staggerFrom = 0,
  staggerSelf: _staggerSelf,
}: {
  org: ApiOrg;
  staggerFrom?: number;
  staggerSelf?: boolean;
}) {
  const { userEmail, avatarUrl, patchProfile } = useApp();

  return (
    <SettingsPanel
      title="Account"
      description="Personal details and appearance preferences."
      staggerFrom={staggerFrom}
    >
      <Card className="overflow-hidden px-5 py-5">
        <ImageUploadField
          label="Profile picture"
          description="Shown in the sidebar. PNG, JPEG, WebP, or SVG · max 1MB."
          imageUrl={avatarUrl}
          canEdit
          onUpload={async (file) => {
            const body = new FormData();
            body.set("file", file);
            const { profile } = await api<{ profile: ApiProfile }>("/api/v1/me/avatar", {
              method: "POST",
              body,
            });
            patchProfile(profile);
            toast.success({ title: "Profile picture updated" });
          }}
          onRemove={async () => {
            const { profile } = await api<{ profile: ApiProfile }>("/api/v1/me/avatar", {
              method: "DELETE",
            });
            patchProfile(profile);
            toast.success({ title: "Profile picture removed" });
          }}
        />
      </Card>

      <Card className="mt-4 overflow-hidden">
        <DefinitionRow label="Email" value={userEmail ?? "Unavailable"} />
        <DefinitionRow
          label="Organization access"
          value={`${org.name} · ${org.role}`}
        />
      </Card>
      <div className="mt-8">
        <div className="mb-3">
          <h3 className="text-[15px] font-semibold">Preferences</h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Stored in this browser only.
          </p>
        </div>
        <AppearanceSettings />
      </div>
      <p className="mt-3 text-[12px] text-ink-muted">
        Email and authentication settings are managed by your sign-in provider.
      </p>
    </SettingsPanel>
  );
}

function SettingsPanel({
  title,
  description,
  children,
  staggerFrom = 0,
}: {
  title: string;
  description: string;
  children: ReactNode;
  staggerFrom?: number;
}) {
  return (
    <Stagger from={staggerFrom}>
      <div className="mb-5">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
      </div>
      {children}
    </Stagger>
  );
}

function DefinitionRow({
  label,
  value,
  action,
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <div className="min-w-0 text-[14px] font-medium">{value}</div>
      {action ? <div className="mt-2 sm:mt-0">{action}</div> : null}
    </div>
  );
}

function Metric({
  value,
  label,
  compact = false,
}: {
  value: ReactNode;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "px-5 py-4" : "px-5 py-5"}>
      <p className={compact ? "font-mono text-[16px] font-semibold" : "font-mono text-[21px] font-semibold"}>
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-ink-muted">{label}</p>
    </div>
  );
}

function StatusBanner({
  color,
  title,
  body,
}: {
  color: "green" | "orange";
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 rounded-2xl border px-5 py-4",
        color === "green"
          ? "border-chip-green/40 bg-chip-green/5"
          : "border-chip-orange/40 bg-chip-orange/5",
      )}
    >
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mt-0.5 text-[13px] text-ink-muted">{body}</p>
    </div>
  );
}
