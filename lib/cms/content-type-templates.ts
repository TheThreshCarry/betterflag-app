import type { SchemaField } from "./types"

export interface ContentTypeTemplate {
  id: string
  name: string
  slug: string
  description: string
  icon: "newspaper" | "file-text" | "box"
  fields: SchemaField[]
}

export const CONTENT_TYPE_TEMPLATES: ContentTypeTemplate[] = [
  {
    id: "starter",
    name: "Starter",
    slug: "starter",
    description:
      "Common fields (title, body, media, relations) you can rename or extend.",
    icon: "file-text",
    fields: [
      {
        uid: "f_title",
        name: "title",
        type: "text",
        label: "Title",
        required: true,
        placeholder: "Entry title",
        description: "Shown in lists and navigation",
      },
      {
        uid: "f_content",
        name: "content",
        type: "richtext",
        label: "Body",
        required: true,
        description: "Main content",
      },
      {
        uid: "f_excerpt",
        name: "excerpt",
        type: "text",
        label: "Summary",
        placeholder: "Short summary",
        description: "Optional preview text",
        validation: { maxLength: 300 },
      },
      {
        uid: "f_featuredImage",
        name: "featuredImage",
        type: "media",
        label: "Featured image",
        config: { mediaSource: "both", multiple: false },
      },
      {
        uid: "f_author",
        name: "author",
        type: "relation",
        label: "Author",
        config: { relationTo: "authors", multiple: false },
      },
      {
        uid: "f_category",
        name: "category",
        type: "relation",
        label: "Category",
        config: { relationTo: "categories", multiple: false },
      },
      {
        uid: "f_tags",
        name: "tags",
        type: "text",
        label: "Tags",
        placeholder: "e.g. react, nextjs, tutorial",
        description: "Comma-separated tags",
      },
      {
        uid: "f_publishedAt",
        name: "publishedAt",
        type: "datetime",
        label: "Published at",
        description: "Optional publish time",
      },
      {
        uid: "f_seoTitle",
        name: "seoTitle",
        type: "text",
        label: "SEO title",
        description: "Optional title for search engines",
      },
      {
        uid: "f_seoDescription",
        name: "seoDescription",
        type: "text",
        label: "SEO description",
        description: "Optional meta description",
        validation: { maxLength: 160 },
      },
    ],
  },
]
