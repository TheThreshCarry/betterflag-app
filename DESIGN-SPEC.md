# ShipOS — Design Specification

> This document describes every page, navigation item, form, and view in the ShipOS dashboard. Use it as the single source of truth when designing screens and components.

---

## Table of Contents

1. [Sidebar Navigation](#sidebar-navigation)
2. [Authentication](#1-authentication)
3. [Onboarding](#2-onboarding)
4. [Dashboard Home](#3-dashboard-home)
5. [CMS](#4-cms)
6. [Global Configs](#5-global-configs)
7. [Customers](#6-customers)
8. [Documentation](#7-documentation)
9. [Newsletters](#8-newsletters-coming-soon)
10. [Changelogs](#9-changelogs)
11. [Feature Flags](#10-feature-flags)
12. [Announcements](#11-announcements)
13. [Media Library](#12-media-library)
14. [Analytics](#13-analytics-coming-soon)
15. [Settings](#14-settings)
16. [Global Patterns](#global-patterns)

---

## Navigation Architecture

The app uses a **two-level navigation** system: a **top bar** for switching between modules, and a **contextual sidebar** that shows pages and sub-navigation specific to the active module.

---

### Top Bar (Horizontal — always visible)

The top bar sits at the very top of the dashboard. It contains the module switcher, global actions, and user menu.

**Layout:** `[Org logo + name]  [Module icons...]  [spacer]  [Search]  [Theme toggle]  [User avatar]`

| Item               | Icon        | Status         |
| ------------------ | ----------- | -------------- |
| CMS                | FileText    |                |
| Global Configs     | FileJson    |                |
| Customers          | Users       |                |
| Documentation      | BookOpen    |                |
| Newsletters        | Mail        | *coming soon*  |
| Changelogs         | Sparkles    |                |
| Feature Flags      | Flag        |                |
| Announcements      | Megaphone   |                |
| Media              | Image       |                |
| Analytics          | BarChart3   | *coming soon*  |

**Behavior:**
- Each item is an icon button (with tooltip label on hover)
- The active module is visually highlighted
- Clicking a module switches the sidebar context and navigates to that module's default page
- "Coming soon" modules are dimmed / disabled with a tooltip
- On smaller screens, overflow modules collapse into a "more" dropdown

**Right side of top bar:**
- Search button (opens Cmd+K palette)
- Theme toggle (light/dark)
- User avatar (opens dropdown: Account, Billing, Notifications, Upgrade to Pro, Log out)

---

### Sidebar (Vertical — contextual per module)

The sidebar appears on the left and its content changes based on the active module selected in the top bar. It is collapsible. Each module defines its own sidebar tree.

**Common sidebar elements (present in every module):**
- Module title + icon at the top
- Settings link at the bottom (navigates to `/dashboard/settings`)
- Help Center, Feedback, Public Site links at the very bottom

---

#### CMS Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| **Blogs**              | Section     |                                              |
| → All Posts            | Link        | `/dashboard/cms`                             |
| → Authors              | Sub-link    | `/dashboard/cms/authors`                     |
| → Categories           | Sub-link    | `/dashboard/cms/categories`                  |
| **Content Types**      | Section     |                                              |
| → All Content Types    | Link        | `/dashboard/cms/content-types`               |
| → *[Dynamic items]*    | Sub-link    | `/dashboard/cms/content-types/[id]/entries`  |
| **Media**              | Link        | `/dashboard/cms/media`                       |
| **Settings**           | Link        | `/dashboard/settings`                        |

**Notes:**
- The "Content Types" section dynamically lists each created content type as a sub-link, so users can jump straight to a type's entries.
- "Blogs" is the primary CMS workflow — posts, authors, and categories. Authors and Categories are nested under it.

---

#### Global Configs Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| All Configs            | Link        | `/dashboard/configs`                         |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Customers Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| All Customers          | Link        | `/dashboard/customers`                       |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Documentation Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| Pages                  | Link        | `/dashboard/docs`                            |
| Navigation             | Link        | `/dashboard/docs/navigation`                 |
| Versions               | Link        | `/dashboard/docs/versions`                   |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Newsletters Sidebar *(coming soon)*

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| Campaigns              | Link        | `/dashboard/newsletters`                     |
| Subscribers            | Link        | `/dashboard/newsletters/subscribers`         |
| Templates              | Link        | `/dashboard/newsletters/templates`           |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Changelogs Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| All Releases           | Link        | `/dashboard/changelogs`                      |
| Labels                 | Link        | `/dashboard/changelogs/labels`               |
| Subscribers            | Link        | `/dashboard/changelogs/subscribers`          |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Feature Flags Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| All Flags              | Link        | `/dashboard/flags`                           |
| Environments           | Link        | `/dashboard/flags/environments`              |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Announcements Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| Banners                | Link        | `/dashboard/announcements/banners`           |
| Modals                 | Link        | `/dashboard/announcements/modals`            |
| Toasts                 | Link        | `/dashboard/announcements/toasts`            |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Media Sidebar

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| All Files              | Link        | `/dashboard/media`                           |
| **Settings**           | Link        | `/dashboard/settings`                        |

**Notes:** Folder navigation happens within the main content area (breadcrumbs), not in the sidebar.

---

#### Analytics Sidebar *(coming soon)*

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| Overview               | Link        | `/dashboard/analytics`                       |
| Page Views             | Link        | `/dashboard/analytics/pages`                 |
| Events                 | Link        | `/dashboard/analytics/events`                |
| **Settings**           | Link        | `/dashboard/settings`                        |

---

#### Settings Sidebar

Accessible from the Settings link at the bottom of every module sidebar, or from the top bar user menu. When active, the sidebar shows:

| Item                   | Type        | URL                                          |
| ---------------------- | ----------- | -------------------------------------------- |
| General                | Link        | `/dashboard/settings`                        |
| Profile                | Link        | `/dashboard/settings/profile`                |
| Emails                 | Link        | `/dashboard/settings/emails` *(coming soon)* |
| Domains                | Link        | `/dashboard/settings/domains`                |
| Team                   | Link        | `/dashboard/settings/team`                   |
| API Keys               | Link        | `/dashboard/settings/api-keys`               |
| Billing                | Link        | `/dashboard/settings/billing`                |

---

### Secondary Links (sidebar bottom — every module)

| Item         | Icon     |
| ------------ | -------- |
| Help Center  | LifeBuoy |
| Feedback     | Send     |
| Public Site  | Globe    |

### User Menu (top bar avatar dropdown)

Account, Billing, Notifications, Upgrade to Pro, Log out.

---

## 1. Authentication

### 1.1 Login `/auth/login`

- **Form type:** Single-step
- **Fields:**
  - Email (email input, required)
  - Password (password input, required)
- **Actions:** Submit, Forgot Password link, Sign Up link
- **Social login:** Apple, Google

### 1.2 Sign Up `/auth/signup`

- **Form type:** Single-step
- **Fields:**
  - Full Name (text, required)
  - Email (email, required)
  - Password (password, required, min 8 chars)
  - Confirm Password (password, required, must match)
- **Actions:** Submit, Login link

### 1.3 Forgot Password `/auth/forgot-password`

- **Form type:** Single-step
- **Fields:**
  - Email (email, required)
- **States:** Default → Success confirmation

### 1.4 Reset Password `/auth/reset-password`

- **Form type:** Single-step
- **Fields:**
  - New Password (password, required, min 8 chars)
  - Confirm New Password (password, required, must match)

---

## 2. Onboarding

### 2.1 Onboarding Wizard `/onboarding`

- **Form type:** Multi-step wizard (4 steps with progress indicator)

**Step 1 — Create Organization**
- Logo (URL input, optional, with preview)
- Organization Name (text, required)
- Slug (text, required, auto-generated from name)
- Description (textarea, optional)

**Step 2 — Select Modules**
- Checkbox grid of all available modules (all selected by default)
- Select All / Deselect All toggle

**Step 3 — Module Setup** *(repeats for each selected module)*
- Dynamic form depending on module type:
  - **Feature Flags:** Name, Key (auto-generated), Description
  - **Changelogs:** Title, Version, Summary
  - **Global Configs:** Name, Slug (auto-generated), Description
  - **Customers:** Name, Email
  - **Media:** Folder Name
- Skip option available

**Step 4 — Completion**
- Summary / success screen

---

## 3. Dashboard Home

### `/dashboard`

- **View type:** Welcome card + overview grid
- **Content:**
  - Welcome message with organization name
  - Placeholder cards for quick stats / analytics
- **Design notes:** This is the landing page after login. Should eventually show key metrics across all modules.

---

## 4. CMS

### 4.1 CMS Overview `/dashboard/cms`

- **View type:** Card grid
- **Each card shows:** Content type name, slug, status badge, entry count, schema version
- **Actions per card:** Dropdown to create new entry, navigate to content type
- **Empty state:** CTA to create first content type

### 4.2 Content Types `/dashboard/cms/content-types`

- **View type:** Table
- **Columns:** Name, Slug, Schema (field count), Version, Status, Created At, Actions
- **Status values:** `draft` | `active` | `deprecated`
- **Inline editing:** Status can be changed via inline dropdown
- **Actions:** View schema, View entries, Edit, Delete

### 4.3 Create Content Type `/dashboard/cms/content-types/new`

- **Form type:** Multi-step wizard (4 steps)

**Step 1 — Template Selection**
- Grid of template cards (Blog Post, Product, etc.) or "Start from scratch"

**Step 2 — Name & Slug**
- Name (text, required)
- Slug (text, required, auto-generated from name)

**Step 3 — Schema Builder**
- Visual field list with drag-and-drop reordering
- Add field button → opens field editor dialog
- Each field shows: name, type badge, required indicator
- **Field Editor Dialog:**
  - Name (text, required, auto-slugged)
  - Label (text, optional)
  - Placeholder (text, optional)
  - Description (text, optional)
  - Required (boolean switch)
  - Field type (select from 16 types — see below)
  - Validation rules (type-specific)
  - Default value (type-specific)
- **Supported field types:** text, richtext, number, integer, float, boolean, date, datetime, enum, json, email, url, password, media, relation, repeater

**Step 4 — Review & Create**
- Summary of content type configuration

### 4.4 Content Type Detail `/dashboard/cms/content-types/[id]`

- **View type:** Detail page with tabs
- **Tabs:** Schema, Entries

### 4.5 Schema Editor `/dashboard/cms/content-types/[id]/schema`

- **View type:** Visual schema builder (same as wizard step 3)
- **Features:** Add, edit, remove, reorder fields via drag-and-drop

### 4.6 Entries List `/dashboard/cms/content-types/[id]/entries`

- **View type:** Table
- **Columns:** Title, Slug, Status, Created, Actions
- **Filtering:** Tab-based status filter — All, Draft, Published, Archived (each with count badge)
- **Status values:** `draft` | `published` | `archived`
- **Actions:** View, Edit, Delete

### 4.7 Entry Editor `/dashboard/cms/content-types/[id]/entries/new` and `.../[entryId]/edit`

- **Form type:** Dynamic single-step form (fields generated from content type schema)
- **Base fields:**
  - Title (text, required)
  - Slug (text, required, auto-generated from title)
- **Dynamic fields** (rendered based on schema, up to 16 types):
  - `text` → Text input
  - `richtext` → Textarea
  - `email` → Email input
  - `url` → URL input
  - `password` → Password input
  - `number` / `integer` / `float` → Number input
  - `boolean` → Switch toggle
  - `date` → Date picker
  - `datetime` → Datetime picker
  - `enum` → Select dropdown
  - `json` → Monospace textarea
  - `media` → Media picker (file upload, supports multiple)
  - `relation` → Relation picker (links to other content types, supports multiple)
  - `repeater` → Nested repeatable field group
- **Actions:** Save as Draft, Publish
- **Validation:** Zod schema built dynamically from field definitions

### 4.8 Categories `/dashboard/cms/categories`

- **Status:** Coming soon placeholder
- **Design notes:** Will be managed through entry relations. Consider a tree/hierarchy view for nested categories.

### 4.9 Authors `/dashboard/cms/authors`

- **Status:** Coming soon placeholder
- **Design notes:** Will be managed through entry relations. Consider a card grid with avatar, name, bio.

### 4.10 CMS Media `/dashboard/cms/media`

- **View type:** Card grid
- **Each card shows:** Slug, MIME type badge, file size, date
- **Design notes:** Subset of the main Media Library, scoped to CMS uploads.

---

## 5. Global Configs

### 5.1 All Configs `/dashboard/configs`

- **View type:** Table
- **Columns:** Slug, Name (with description), Environment badge, Fields count, Updated, Actions
- **Environment values:** `production` | `staging` | `development` (color-coded badges)
- **Detail view:** Dialog with two tabs — Fields view, Raw JSON view
- **Actions:** View, Edit, Delete

### 5.2 Create / Edit Config (Dialog)

- **Form type:** Single-step dialog with dual editor mode
- **Fields:**
  - Name (text, required)
  - Slug (text, required, auto-generated from name)
  - Description (textarea, optional)
  - Environment (select: production / staging / development)
  - Data — two modes:
    - **Field Editor:** Visual key-value pairs with type selector (String, Number, Boolean, JSON). Add / remove fields.
    - **JSON Editor:** Raw JSON textarea with format button and validation
- **Mode toggle:** Switch between Field Editor and JSON Editor

---

## 6. Customers

### 6.1 All Customers `/dashboard/customers`

- **View type:** Table
- **Columns:** Name (with avatar icon), Email (with mail icon), External ID (badge), Created, Actions
- **Detail view:** Dialog showing ID, Name, Email, External ID, Metadata (JSON), Created, Updated
- **Empty state:** Icon + message + CTA button

### 6.2 Create / Edit Customer (Dialog)

- **Form type:** Single-step dialog
- **Fields:**
  - Name (text, optional)
  - Email (email, optional)
  - External ID (text, optional)
- **Validation:** At least one of Name or Email is required

---

## 7. Documentation

### 7.1 Pages `/dashboard/docs`

- **Status:** Placeholder / early implementation
- **Design notes:** Will need a page editor, likely with rich text or markdown support. Consider a tree-based navigation for page hierarchy.

### 7.2 Navigation `/dashboard/docs/navigation`

- **Status:** Placeholder
- **Design notes:** Drag-and-drop tree for organizing doc pages into sections and groups.

### 7.3 Versions `/dashboard/docs/versions`

- **Status:** Placeholder
- **Design notes:** Version management for documentation sets (e.g., v1, v2). Table or card view.

---

## 8. Newsletters *(coming soon)*

### 8.1 Campaigns `/dashboard/newsletters`

- **Design notes:** List of newsletter campaigns. Table view with status (draft, sent, scheduled). Each campaign needs a rich text editor for content.

### 8.2 Subscribers `/dashboard/newsletters/subscribers`

- **Design notes:** Table of subscribers with email, name, subscription date, status. Import/export functionality.

### 8.3 Templates `/dashboard/newsletters/templates`

- **Design notes:** Reusable email templates. Card grid with preview thumbnails. Template editor with drag-and-drop blocks or rich text.

---

## 9. Changelogs

### 9.1 All Releases `/dashboard/changelogs`

- **View type:** Table
- **Columns:** Title (with summary), Version badge, Date (published or created), Status badges
- **Status values:** `draft` | `published` | `archived`
- **Special indicators:**
  - Deployed entries have green background highlight + "live" badge
- **Context menu (right-click):** Deploy as Live, Edit, Publish/Unpublish, Undeploy, Delete
- **Actions:** Create new release

### 9.2 Changelog Editor `/dashboard/changelogs/new` and `.../[id]/edit`

- **Form type:** Single-step with rich text editor
- **Fields:**
  - Title (text, required)
  - Version (text, optional, semver validation e.g. `1.2.3`)
  - Summary (text, optional)
  - Content (TipTap rich text editor — full WYSIWYG)
  - Labels (multi-select from existing labels, shown as colored badges)
- **Rich text toolbar:** Bold, Italic, Underline, Strikethrough, H1-H3, Bulleted list, Numbered list, Task list, Blockquote, Code block, Link, Image upload, Emoji, Horizontal rule
- **Actions:** Save Draft, Publish, Deploy/Undeploy

### 9.3 Labels `/dashboard/changelogs/labels`

- **View type:** Table
- **Columns:** Label (colored badge preview), Color (swatch + hex code), Created, Actions
- **Actions:** Edit, Delete

### 9.4 Create / Edit Label (Dialog)

- **Form type:** Single-step dialog
- **Fields:**
  - Name (text, required)
  - Color (color picker with preset swatches + custom hex input, live badge preview)

### 9.5 Subscribers `/dashboard/changelogs/subscribers`

- **View type:** Table
- **Columns:** Email (with mail icon), Name, Subscribed date, Status badge (Active), Actions
- **Actions:** Delete

### 9.6 Add Subscriber (Dialog)

- **Form type:** Single-step dialog
- **Fields:**
  - Email (email, required)
  - Name (text, optional)

---

## 10. Feature Flags

### 10.1 All Flags `/dashboard/flags`

- **View type:** Table
- **Columns:** Status (inline toggle switch), Key (monospace), Name (with description), Environment badge, Updated, Actions
- **Environment values:** `production` | `staging` | `development` (color-coded badges)
- **Inline editing:** Toggle switch to enable/disable directly from the table
- **Row click:** Navigates to detail page
- **Actions:** Edit, Delete

### 10.2 Create / Edit Flag (Dialog)

- **Form type:** Single-step dialog
- **Fields:**
  - Key (text, required)
  - Name (text, required)
  - Description (textarea, optional)
  - Environment (select: production / staging / development)
  - Enabled (boolean switch)

### 10.3 Flag Detail `/dashboard/flags/[id]`

- **View type:** Full detail page with analytics
- **Sections:**
  1. **Settings card:** Key, Name, Description, Environment selector, Toggle switch
  2. **Analytics summary cards:** Total Evaluations, Unique Users, Top Country, Daily Average
  3. **Area chart:** Evaluations and unique users over time (30-day window, dual series)
  4. **Geographic distribution:** Interactive map with cluster markers + Country breakdown table (Country, Evaluations, Users)

### 10.4 Environments `/dashboard/flags/environments`

- **Status:** Placeholder
- **Design notes:** Manage environment definitions (production, staging, development, custom). Table or card view.

---

## 11. Announcements

### 11.1 Banners `/dashboard/announcements/banners`

- **Status:** Placeholder
- **Design notes:** In-app announcement banners. Table of banners with status, targeting rules, date range. Form: title, message, CTA link, style/color, targeting, schedule.

### 11.2 Modals `/dashboard/announcements/modals`

- **Status:** Placeholder
- **Design notes:** Modal announcements. Similar to banners but with richer content (image, body text, CTA buttons). Preview capability.

### 11.3 Toasts `/dashboard/announcements/toasts`

- **Status:** Placeholder
- **Design notes:** Toast notifications. Lightweight messages. Form: message, type (info/success/warning), duration, targeting.

---

## 12. Media Library

### 12.1 All Files `/dashboard/media`

- **View type:** Dual view — Grid (default) and List, with toggle switcher
- **Grid view:** Card grid with thumbnails (images), file type icons (non-images), file name, file size
- **List view:** Table with Name, Type badge, Size, Date, Actions
- **Filtering:** Tab-based type filter — All, Images, Videos, Files
- **Folder navigation:**
  - Breadcrumb trail for current path
  - Folder cards in the grid alongside files
  - Create folder, delete folder
  - Nested folder support
- **Upload:** Drag-and-drop zone + file picker button
- **Context menu (right-click):** View Details, Copy URL, Download, Delete
- **Detail dialog:** File preview (image/video), metadata grid (name, type, size, dimensions, uploaded by, date), public URL with copy button
- **Storage indicator:** Used storage (bytes) and total file count
- **Empty state:** Upload CTA

---

## 13. Analytics *(coming soon)*

### 13.1 Overview `/dashboard/analytics`

- **Design notes:** Dashboard with key metrics: total page views, unique visitors, top pages, traffic sources. Date range picker. Line/area charts.

### 13.2 Page Views `/dashboard/analytics/pages`

- **Design notes:** Table of pages with view counts, unique visitors, avg. time on page. Filtering by date range. Sortable columns.

### 13.3 Events `/dashboard/analytics/events`

- **Design notes:** Custom event tracking. Table of events with name, count, unique users. Filtering by date range and event type.

---

## 14. Settings

### 14.1 General `/dashboard/settings`

- **Design notes:** Organization-level settings. Organization name, slug, logo, description. Danger zone (delete organization).

### 14.2 Profile `/dashboard/settings/profile`

- **Form type:** Single-step
- **Fields:**
  - Profile picture (image upload with preview)
  - Full Name (text)
  - Email (email, read-only or with verification flow)
  - Username (text, unique)
- **Actions:** Save changes

### 14.3 Emails `/dashboard/settings/emails` *(coming soon)*

- **Design notes:** Email notification preferences. Toggle switches for different notification types.

### 14.4 Domains `/dashboard/settings/domains`

- **Design notes:** Custom domain management. Table of domains with status (pending, verified, active). Add domain flow with DNS verification instructions.

### 14.5 Team `/dashboard/settings/team`

- **View type:** Table + Invitations section
- **Table columns:** Member (avatar, name, email, "You" badge), Role (dropdown or badge), Joined date, Actions
- **Role values:** `owner` | `admin` | `member`
- **Role display:** Owner (crown icon), Admin (shield icon), Member (outline badge)
- **Inline editing:** Role dropdown for admin/member (owners cannot be changed)
- **Invitations section:** Card listing pending invitations with email, role, expiration date, cancel button
- **Invite form:** Email (required), Role (select: admin / member)

### 14.6 API Keys `/dashboard/settings/api-keys`

- **View type:** Table
- **Columns:** Status (toggle switch), Name, Key (masked as `prefix_start••••••••`), Created, Last Used, Actions
- **Inline editing:** Toggle switch to enable/disable
- **Create dialog:**
  - Name (text, required)
- **New key display dialog:** Shows full key once with copy button, show/hide toggle, and warning "You won't be able to see it again!"

### 14.7 Billing `/dashboard/settings/billing`

- **Design notes:** Current plan display, usage metrics against plan limits, upgrade/downgrade options.
- **Plan tiers:**
  - **Free:** 1,000 API calls, 5 flags, 2 configs, 1 changelog, 100 customers, 5MB max file, 100MB storage
  - **Pro:** 50,000 API calls, unlimited flags/configs/changelogs, 10,000 customers, 100MB max file, 10GB storage
  - **Team:** 200,000 API calls, unlimited flags/configs/changelogs, 50,000 customers, 100MB max file, 50GB storage

---

## Global Patterns

### Command Palette (Cmd+K)

- Global search across all modules
- Debounced input (300ms)
- Results grouped by type with badges
- Quick actions and navigation shortcuts

### Empty States

Consistent pattern across all modules:
- Centered icon
- Heading text
- Description text
- Primary CTA button

### Dialogs

Three dialog types used throughout:
1. **Create/Edit dialogs:** Modal with form fields and Save/Cancel buttons
2. **View dialogs:** Read-only detail display
3. **Delete confirmation:** Alert dialog with destructive action

### Status Badges

| Context        | Values                                     | Styling                                              |
| -------------- | ------------------------------------------ | ---------------------------------------------------- |
| Content Types  | draft, active, deprecated                  | outline, default, secondary                          |
| Entries        | draft, published, archived                 | outline, default, secondary                          |
| Changelogs     | draft, published, archived + live          | outline, default, secondary + green highlight        |
| Environment    | production, staging, development           | default, secondary, outline                          |
| Members        | owner, admin, member                       | crown icon, shield icon, outline                     |

### Tables

- Consistent header/body/row/cell structure
- Action column with icon buttons: View (Eye), Edit (Pencil), Delete (Trash2)
- No column sorting implemented (default: creation date descending)
- No pagination (all items loaded)
- No inline search (global Cmd+K search available)

### Inline Editing

Used in specific contexts:
- Feature flags: Toggle switch in table row
- Content types: Status dropdown in table row
- Team members: Role dropdown in table row
- API keys: Toggle switch in table row

### Notifications / Toasts

- Success/error toasts for form submissions and actions
- Positioned top-right

### Responsive Behavior

- **Top bar:** On smaller screens, module icons overflow into a "more" dropdown menu
- **Sidebar:** Collapses to icon-only rail or hides behind a hamburger menu on mobile
- **Tables:** Should consider responsive alternatives (card stacks on mobile)

### Navigation State

- The top bar highlights the active module based on the current URL prefix (e.g. `/dashboard/cms/*` highlights CMS)
- The sidebar highlights the active page link based on exact URL match
- Navigating to `/dashboard/settings` from any module shows the Settings sidebar; pressing back returns to the previous module's sidebar
- The sidebar remembers scroll position per module
