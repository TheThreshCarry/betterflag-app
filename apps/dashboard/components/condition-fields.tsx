"use client";

import { CountryFlagRounded } from "@appica/country-flags-react";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@appica/ui-react/autocomplete";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@appica/ui-react/combobox";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { Chip } from "@/components/ui";
import {
  COUNTRY_OPTIONS,
  TARGETING_ATTRIBUTES,
  countryDisplayName,
  countryOption,
  isCountryAttribute,
  isListOperator,
  isPresetAttribute,
  parseCountryCodeList,
  parseSingleCountryCode,
  serializeCountryCodes,
  type CountryOption,
  type TargetingAttribute,
} from "@/lib/targeting-attributes";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "h-8 min-w-0 w-full rounded-lg border-line bg-canvas font-mono text-[12px]";

export function AttributeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const preset = isPresetAttribute(value);
  const [editing, setEditing] = useState(!preset);
  const [open, setOpen] = useState(false);

  function collapseIfPreset() {
    if (isPresetAttribute(valueRef.current)) setEditing(false);
  }

  if (!editing && preset) {
    return (
      <FieldWrap>
        <FieldPill
          label={value.trim()}
          onEdit={() => {
            setEditing(true);
            setOpen(true);
          }}
        >
          {value.trim()}
        </FieldPill>
      </FieldWrap>
    );
  }

  return (
    <FieldWrap>
      <Autocomplete
        items={TARGETING_ATTRIBUTES}
        value={value}
        onValueChange={(next) => {
          valueRef.current = next;
          onChange(next);
        }}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) collapseIfPreset();
        }}
        itemToStringValue={(item) => (item as TargetingAttribute).key}
        filter={(item, query) => matchAttribute(item as TargetingAttribute, query)}
        autoHighlight="always"
        openOnInputClick
        size="sm"
        icon
      >
        <AutocompleteInput
          autoFocus={preset}
          placeholder="attribute"
          className={FIELD_CLASS}
          onBlur={() => {
            if (!open) collapseIfPreset();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || open) return;
            collapseIfPreset();
          }}
        />
        <AutocompleteContent className="min-w-52">
          <AutocompleteEmpty>Keep as custom attribute</AutocompleteEmpty>
          <AutocompleteList>
            {(item) => {
              const attribute = item as TargetingAttribute;
              return (
                <AutocompleteItem key={attribute.key} value={attribute}>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-[12px]">{attribute.key}</span>
                    <span className="text-[11px] text-ink-muted">{attribute.hint}</span>
                  </span>
                </AutocompleteItem>
              );
            }}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
    </FieldWrap>
  );
}

export function ConditionValueField({
  attribute,
  op,
  valueText,
  onChange,
}: {
  attribute: string;
  op: string;
  valueText: string;
  onChange: (next: string) => void;
}) {
  if (!isCountryAttribute(attribute)) {
    return (
      <FieldWrap>
        <input
          className={cn(FIELD_CLASS, "px-2.5 outline-none focus:border-line-strong")}
          placeholder='value ("pro", ["a","b"], 42)'
          value={valueText}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldWrap>
    );
  }

  if (isListOperator(op)) {
    return <CountryListCombobox valueText={valueText} onChange={onChange} />;
  }

  return <CountryCombobox valueText={valueText} onChange={onChange} />;
}

function CountryCombobox({
  valueText,
  onChange,
}: {
  valueText: string;
  onChange: (next: string) => void;
}) {
  const selectedCode = parseSingleCountryCode(valueText);
  const selected = selectedCode ? countryOption(selectedCode) : null;
  const [editing, setEditing] = useState(!selected);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function collapseIfSelected() {
    if (parseSingleCountryCode(valueText)) setEditing(false);
  }

  if (!editing && selected) {
    return (
      <FieldWrap>
        <FieldPill
          label={selected.name}
          title={`${selected.name} (${selected.code}) — click to edit`}
          onEdit={() => {
            setQuery("");
            setEditing(true);
            setOpen(true);
          }}
        >
          <CountryFlagIcon code={selected.code} size={14} />
          <span>{selected.name}</span>
          <span className="font-mono text-[11px] opacity-70">{selected.code}</span>
        </FieldPill>
      </FieldWrap>
    );
  }

  return (
    <FieldWrap>
      <Combobox
        items={COUNTRY_OPTIONS}
        value={selected}
        onValueChange={(next) => {
          const country = next as CountryOption | null;
          onChange(country ? country.code : "");
          if (country) setEditing(false);
        }}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) collapseIfSelected();
        }}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={countryLabel}
        isItemEqualToValue={sameCountry}
        filter={(item, queryValue) => matchCountry(item as CountryOption, queryValue)}
        autoHighlight
        size="sm"
      >
        <ComboboxInput
          autoFocus={Boolean(selected)}
          placeholder="Country"
          className={FIELD_CLASS}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || open) return;
            collapseIfSelected();
          }}
        />
        <CountryListPopup />
      </Combobox>
    </FieldWrap>
  );
}

function CountryListCombobox({
  valueText,
  onChange,
}: {
  valueText: string;
  onChange: (next: string) => void;
}) {
  const selected = useMemo(
    () => parseCountryCodeList(valueText).map(countryOption),
    [valueText],
  );

  return (
    <FieldWrap>
      <Combobox
        multiple
        items={COUNTRY_OPTIONS}
        value={selected}
        onValueChange={(next) => {
          const countries = next as CountryOption[];
          onChange(serializeCountryCodes(countries.map((country) => country.code), true));
        }}
        itemToStringLabel={countryLabel}
        isItemEqualToValue={sameCountry}
        filter={(item, query) => matchCountry(item as CountryOption, query)}
        autoHighlight
        size="sm"
      >
        <ComboboxChips
          placeholder="Countries"
          className={FIELD_CLASS}
          inputProps={{ autoComplete: "off" }}
        >
          {selected.map((country) => (
            <ComboboxChip key={country.code}>
              <CountryFlagIcon code={country.code} size={14} />
              <span className="font-mono">{country.code}</span>
            </ComboboxChip>
          ))}
        </ComboboxChips>
        <CountryListPopup />
      </Combobox>
    </FieldWrap>
  );
}

function CountryListPopup() {
  return (
    <ComboboxContent className="min-w-64">
      <ComboboxEmpty>No country</ComboboxEmpty>
      <ComboboxList>
        {(item) => {
          const country = item as CountryOption;
          return (
            <ComboboxItem key={country.code} value={country}>
              <span className="flex min-w-0 items-center gap-2">
                <CountryFlagIcon code={country.code} />
                <span className="truncate">{country.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">{country.code}</span>
              </span>
            </ComboboxItem>
          );
        }}
      </ComboboxList>
    </ComboboxContent>
  );
}

function FieldWrap({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1">{children}</div>;
}

function FieldPill({
  label,
  title,
  onEdit,
  children,
}: {
  label: string;
  title?: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title ?? `Edit ${label}`}
      aria-label={`Edit ${label}`}
      onClick={onEdit}
      className="flex h-8 w-full min-w-0 items-center rounded-lg border border-line bg-canvas px-1.5 text-left hover:border-line-strong"
    >
      <Chip color="blue" className="max-w-full !px-2 !py-0 font-mono text-[12px]">
        {children}
      </Chip>
    </button>
  );
}

function CountryFlagIcon({ code, size = 16 }: { code: string; size?: number }) {
  const name = countryDisplayName(code);
  if (!/^[A-Z]{2}$/i.test(code)) {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-line text-[9px] font-medium text-ink-muted"
        aria-hidden
      >
        ?
      </span>
    );
  }
  return (
    <CountryFlagRounded
      code={code.toLowerCase()}
      size={size}
      title={name}
      className="shrink-0"
    />
  );
}

function countryLabel(item: unknown): string {
  const country = item as CountryOption;
  return `${country.name} ${country.code}`;
}

function sameCountry(a: unknown, b: unknown): boolean {
  return (a as CountryOption).code === (b as CountryOption).code;
}

function matchAttribute(item: TargetingAttribute, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.key.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q);
}

function matchCountry(item: CountryOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
}
