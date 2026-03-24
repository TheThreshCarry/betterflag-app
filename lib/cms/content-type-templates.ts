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
    id: "blog-post",
    name: "Blog Post",
    slug: "blog-post",
    description:
      "Articles with rich content, featured images, authors, and SEO metadata.",
    icon: "newspaper",
    fields: [
      {
        uid: "f_content",
        name: "content",
        type: "richtext",
        label: "Content",
        required: true,
        description: "Main blog post body",
      },
      {
        uid: "f_excerpt",
        name: "excerpt",
        type: "text",
        label: "Excerpt",
        placeholder: "Brief summary of the post",
        description: "Short summary shown in listings and social shares",
        validation: { maxLength: 300 },
      },
      {
        uid: "f_featuredImage",
        name: "featuredImage",
        type: "media",
        label: "Featured Image",
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
        label: "Published At",
        description: "When this post should be published",
      },
      {
        uid: "f_seoTitle",
        name: "seoTitle",
        type: "text",
        label: "SEO Title",
        description: "Custom title for search engines",
      },
      {
        uid: "f_seoDescription",
        name: "seoDescription",
        type: "text",
        label: "SEO Description",
        description: "Meta description for search engines",
        validation: { maxLength: 160 },
      },
    ],
  },
]
