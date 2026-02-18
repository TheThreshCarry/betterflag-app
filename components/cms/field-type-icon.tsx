"use client"

import type { LucideIcon } from "lucide-react"
import {
  Type,
  FileText,
  Hash,
  ToggleLeft,
  Calendar,
  Clock,
  List,
  Mail,
  Link2,
  Lock,
  Braces,
  Image,
  GitBranch,
  Layers,
} from "lucide-react"

import type { FieldType } from "@/lib/cms/types"

const ICON_MAP: Record<FieldType, LucideIcon> = {
  text: Type,
  richtext: FileText,
  number: Hash,
  integer: Hash,
  float: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  datetime: Clock,
  enum: List,
  email: Mail,
  url: Link2,
  password: Lock,
  json: Braces,
  media: Image,
  relation: GitBranch,
  repeater: Layers,
}

export function getFieldTypeIcon(type: FieldType): LucideIcon {
  return ICON_MAP[type] ?? Type
}

interface FieldTypeIconProps {
  type: FieldType
  className?: string
}

export function FieldTypeIcon({ type, className }: FieldTypeIconProps) {
  const Icon = getFieldTypeIcon(type)
  return <Icon className={className} />
}
