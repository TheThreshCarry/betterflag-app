"use client";

import { useState } from "react";
import { Slider } from "@appica/ui-react/slider";
import { Input } from "@appica/ui-react/input";
import { Textarea } from "@appica/ui-react/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@appica/ui-react/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
import {
  Button,
  Card,
  Chip,
  CopyButton,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  JsonBlock,
  RelativeTime,
  Spinner,
  Toggle,
  inputClass,
  textareaClass,
  type ChipColor,
} from "@/components/ui";

const CHIP_COLORS: ChipColor[] = ["blue", "pink", "green", "orange", "gray"];
const BUTTON_VARIANTS = ["primary", "secondary", "danger", "ghost"] as const;
const BUTTON_SIZES = ["sm", "md", "lg"] as const;

const SECTIONS = [
  { id: "tokens", label: "Tokens" },
  { id: "button", label: "Button" },
  { id: "chip", label: "Chip" },
  { id: "forms", label: "Forms" },
  { id: "toggle", label: "Toggle" },
  { id: "slider", label: "Slider" },
  { id: "feedback", label: "Feedback" },
  { id: "dialog", label: "Dialog" },
  { id: "menu", label: "Menu & Tooltip" },
  { id: "skeleton", label: "Skeleton" },
  { id: "misc", label: "Misc" },
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-5 border-b border-line pb-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-[14px] text-ink-muted">{description}</p>
        ) : null}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2.5 text-[12px] font-medium tracking-wide text-ink-muted uppercase">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function DesignSystemGallery() {
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogWideOpen, setDialogWideOpen] = useState(false);
  const [rollout, setRollout] = useState(42);
  const recentIso = new Date(Date.now() - 90_000).toISOString();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo href="/" size="sm" showText />
            <Chip color="gray">Design system</Chip>
          </div>
          <nav className="hidden max-w-xl flex-wrap justify-end gap-x-3 gap-y-1 text-[12px] text-ink-muted md:flex">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="hover:text-ink"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-6 py-10">
        <div>
          <h1 className="text-[36px] font-semibold tracking-[-0.03em]">
            ShipOS components
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Gallery of dashboard primitives — Appica under the DESIGN.md API.
            Public, no auth. For local visual QA.
          </p>
        </div>

        <Section id="tokens" title="Tokens" description="ShipOS color + surface language.">
          <Row label="Surfaces">
            {[
              ["canvas", "bg-canvas border border-line"],
              ["surface", "bg-surface border border-line"],
              ["surface-alt", "bg-surface-alt border border-line"],
              ["ink", "bg-ink"],
            ].map(([name, cls]) => (
              <div key={name} className="flex flex-col items-center gap-1.5">
                <div className={`size-14 rounded-2xl ${cls}`} />
                <span className="text-[11px] text-ink-muted">{name}</span>
              </div>
            ))}
          </Row>
          <Row label="Chips / semantic">
            {(
              [
                ["blue", "bg-chip-blue"],
                ["pink", "bg-chip-pink"],
                ["green", "bg-chip-green"],
                ["orange", "bg-chip-orange"],
                ["gray", "bg-chip-gray"],
              ] as const
            ).map(([name, cls]) => (
              <div key={name} className="flex flex-col items-center gap-1.5">
                <div className={`size-14 rounded-2xl ${cls}`} />
                <span className="text-[11px] text-ink-muted">{name}</span>
              </div>
            ))}
          </Row>
          <Row label="Lines">
            <div className="h-px w-40 bg-line" />
            <div className="h-px w-40 bg-line-strong" />
          </Row>
        </Section>

        <Section id="button" title="Button" description="Variants, sizes, loading, disabled.">
          <Row label="Variants">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
          </Row>
          <Row label="Sizes">
            {BUTTON_SIZES.map((size) => (
              <Button key={size} size={size}>
                size {size}
              </Button>
            ))}
          </Row>
          <Row label="Loading">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} loading>
                {variant}
              </Button>
            ))}
          </Row>
          <Row label="Disabled">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} disabled>
                {variant}
              </Button>
            ))}
          </Row>
          <Row label="Spinner">
            <Spinner size={14} />
            <Spinner size={16} />
            <Spinner size={24} />
          </Row>
        </Section>

        <Section id="chip" title="Chip" description="Status / kind color chips.">
          <Row label="Colors">
            {CHIP_COLORS.map((color) => (
              <Chip key={color} color={color}>
                {color}
              </Chip>
            ))}
          </Row>
          <Row label="With title tooltip">
            <Chip color="blue" title="Boolean flag">
              boolean
            </Chip>
            <Chip color="orange" title="Percentage rollout">
              42%
            </Chip>
          </Row>
        </Section>

        <Section id="forms" title="Forms" description="Field, native input classes, Appica Input/Textarea.">
          <div className="grid max-w-md gap-4">
            <Field label="Flag name" hint="Shown in the dashboard and MCP tools.">
              <input className={inputClass} defaultValue="new-checkout" />
            </Field>
            <Field label="Description">
              <textarea
                className={textareaClass}
                rows={3}
                defaultValue='{"enabled": true}'
              />
            </Field>
            <Field label="Appica Input">
              <Input placeholder="Search flags…" />
            </Field>
            <Field label="Appica Textarea">
              <Textarea rows={3} placeholder="Notes…" />
            </Field>
          </div>
        </Section>

        <Section id="toggle" title="Toggle" description="Switch for enable/disable.">
          <Row label="States">
            <div className="flex items-center gap-2">
              <Toggle checked={toggleOn} onChange={setToggleOn} label="On" />
              <span className="text-[13px] text-ink-muted">on</span>
            </div>
            <div className="flex items-center gap-2">
              <Toggle checked={toggleOff} onChange={setToggleOff} label="Off" />
              <span className="text-[13px] text-ink-muted">off</span>
            </div>
            <div className="flex items-center gap-2">
              <Toggle checked disabled onChange={() => {}} label="Disabled on" />
              <span className="text-[13px] text-ink-muted">disabled</span>
            </div>
          </Row>
        </Section>

        <Section id="slider" title="Slider" description="Rollout percentage control.">
          <div className="max-w-md space-y-2">
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-medium">Rollout</span>
              <span className="font-mono text-[13px] font-semibold">{rollout}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[rollout]}
              tooltipVisibility="never"
              thumbAriaLabel="Rollout percentage"
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                setRollout(Number(next ?? 0));
              }}
            />
          </div>
        </Section>

        <Section id="feedback" title="Feedback" description="Errors, alerts, empty states.">
          <div className="max-w-lg space-y-3">
            <ErrorNote message="Something went wrong saving the flag." />
            <ErrorNote message={null} />
            <Alert variant="error" layout="inline">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Config validation failed.</AlertDescription>
            </Alert>
            <Alert variant="success" layout="inline">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Flag published to prod.</AlertDescription>
            </Alert>
            <Alert variant="warning" layout="inline">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>Rollout is above 50%.</AlertDescription>
            </Alert>
            <Alert variant="info" layout="inline">
              <AlertTitle>Info</AlertTitle>
              <AlertDescription>Promote to staging when ready.</AlertDescription>
            </Alert>
          </div>
          <EmptyState
            title="No flags yet"
            body="Create a flag to start targeting users and agents."
            action={<Button size="sm">Create flag</Button>}
          />
        </Section>

        <Section id="dialog" title="Dialog" description="Modal facade over Appica Dialog.">
          <Row label="Open">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Default dialog
            </Button>
            <Button variant="secondary" onClick={() => setDialogWideOpen(true)}>
              Wide dialog
            </Button>
          </Row>
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create flag">
            <div className="space-y-4">
              <Field label="Name">
                <input className={inputClass} placeholder="my-flag" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Create</Button>
              </div>
            </div>
          </Dialog>
          <Dialog
            open={dialogWideOpen}
            onClose={() => setDialogWideOpen(false)}
            title="Targeting rules"
            wide
          >
            <p className="text-[14px] text-ink-muted">
              Wide dialog for denser forms and JSON editors.
            </p>
          </Dialog>
        </Section>

        <Section id="menu" title="Menu & Tooltip" description="Dropdown and tooltip chrome.">
          <Row label="Dropdown">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="secondary" size="sm" />}
              >
                Open menu
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-chip-pink">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>
          <Row label="Tooltip">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="sm" />}>
                Hover me
              </TooltipTrigger>
              <TooltipContent>Kill switch for this environment</TooltipContent>
            </Tooltip>
          </Row>
        </Section>

        <Section id="skeleton" title="Skeleton" description="Loading placeholders.">
          <div className="grid max-w-md gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        </Section>

        <Section id="misc" title="Misc" description="Card, copy, time, JSON.">
          <Card className="max-w-md p-5">
            <p className="text-[15px] font-medium">Card surface</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Rounded panel used across list and detail views.
            </p>
          </Card>
          <Row label="CopyButton">
            <CopyButton text="ship_sk_live_example" label="Copy key" />
          </Row>
          <Row label="RelativeTime">
            <RelativeTime iso={recentIso} />
            <span className="text-[13px] text-ink-muted font-mono">{recentIso}</span>
          </Row>
          <div className="max-w-md">
            <JsonBlock
              value={{
                key: "new-checkout",
                enabled: true,
                rollout: 42,
                rules: [{ attribute: "country", op: "eq", value: "US" }],
              }}
            />
          </div>
        </Section>
      </main>
    </div>
  );
}
