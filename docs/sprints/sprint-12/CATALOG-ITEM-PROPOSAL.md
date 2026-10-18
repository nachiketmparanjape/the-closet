# Proposal: unified CatalogItem model

**Status:** proposed 2026-10-17 — awaiting founder validation.
**Origin:** founder 2026-10-17 — a wardrobe article, a shop-check analysis,
and a saved shop suggestion are all the *same kind of thing* (a catalog
item) and should share one data model, pitched at industry granularity so
we could one day match real retailer catalogs without a rewrite.

## The industry reference

Google Merchant Center's product data specification is the de facto
standard for apparel product feeds. Its attribute set (with Schema.org
`Product` equivalents) is the target vocabulary:

- **Identity:** `title`, `brand`, `gtin`, `mpn`, `sku` (via item_group_id),
  `link` (product URL), `image_link`
- **Variant-defining:** `color`, `size`, `size_system`, `size_type`,
  `pattern`, `material`, `age_group`, `gender`
- **Descriptive:** `description`

Source: https://support.google.com/merchants/answer/7052112?hl=en

## The unified model

One `CatalogItem` shape, embedded wherever an item appears — wardrobe
articles, shop-check analyses, saved shop items. All fields optional
except the identity core; the app fills what it knows and leaves the
rest null.

| Field | Our name today | Standard | Status |
|---|---|---|---|
| name | `name` | `title` | have |
| brand | `brand` / `brandKey` | `brand` | have |
| category | `category` | `product_type` | have (ours is finer) |
| subtype | `subtype` | — (ours) | have |
| colors | `colors[]` {name, hex} | `color` | have (richer: hex-anchored) |
| pattern | `pattern` | `pattern` | have |
| material | `fabric_guess` | `material` | **weak — promote** |
| formality | `formality` 0–1 | — (ours) | have |
| style_tags | `style_tags[]` | — (ours) | have |
| size | — | `size` + `size_system` | **missing** |
| gender | — (PC-25) | `gender` | **planned (PC-25)** |
| age_group | — | `age_group` | missing (low priority) |
| sku | — (PC-28 proposes) | `sku` | **proposed (PC-28)** |
| link | — (PC-28 proposes) | `link` | **proposed (PC-28)** |
| gtin/mpn | — | `gtin` / `mpn` | future (only matters for catalog matching) |
| photos | `photos[]` | `image_link` | have |

## What changes

1. **PC-28's `item` blob becomes a CatalogItem.** No separate "shop item"
   shape — the saved object embeds the same model as a wardrobe article.
2. **Additive, never a migration.** New fields (`size`, `material`,
   `gender`, `link`, `sku`) are optional; old docs keep working (the
   PC-8 lazy-migration precedent).
3. **AI prompt gains the vocabulary gradually.** `describeItem` already
   returns category/colors/pattern/brand; next: `material` (promote the
   fabric guess from best-effort to a real field) and `size` (read off
   labels/tags when visible, null otherwise — never guessed from the
   photo of the garment alone). `gender` arrives with PC-25.
4. **No backfill.** Existing articles get the new fields when re-described
   or edited, not before.

## Deliberately not now

- `gtin`/`mpn` and real catalog matching — only when there's a retailer
  integration to match against.
- `age_group` — near-zero value for a personal wardrobe.
- Required-ness: the industry spec has required fields; ours stay
  optional. We're describing owned clothes, not listing products.

## Effect on PC-28

The design's `item: { category, colors[], pattern, note }` becomes
`item: CatalogItem` (with `note` as the AI's one-line description kept
alongside). The user-facing `sku`/`link` fields in PC-28 are exactly the
standard `sku`/`link` — same names, same semantics.
