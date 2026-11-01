# Garment Attribute Taxonomy

**Purpose:** When a photo is first taken and AI categorizes the garment (top of the funnel),
it must consistently record the attributes that matter for the AI render prompt and for
filtering/search. This table is the single source of truth.

**Usage:**
1. **Parse time** (`parse.js` LIST_PROMPT): AI extracts these attributes from the photo
2. **Render time** (`standardize.js` buildFluxPrompt): Attributes are passed to FLUX
3. **Filter/search**: Attributes power wardrobe filtering

**Principle:** Only attributes that change the VISUAL shape go in the FLUX prompt.
Color/pattern are judged by the model from the image (never passed as text).

---

## TOPS

### T-shirt
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| sleeve_length | short, long, sleeveless | ✅ YES | Critical — model defaults to long if unspecified |
| fit | slim, regular, relaxed, oversized | ✅ YES | Affects silhouette |
| neckline | crew, v-neck, scoop, henley | ✅ YES | Changes collar shape |
| length | cropped, regular, long | ✅ YES | Where the hem falls |
| graphic | true/false | ❌ NO | Model sees it in the image |

### Shirt (button-up)
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| sleeve_length | short, long | ✅ YES | |
| fit | slim, regular, relaxed, oversized | ✅ YES | |
| collar | button-down, spread, mandarin, camp | ✅ YES | |
| formality | casual, formal | ✅ YES | Affects fabric drape |
| pattern | (from image) | ❌ NO | Model judges visually |

### Polo
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| sleeve_length | short, long | ✅ YES | |
| fit | slim, regular, relaxed | ✅ YES | |
| collar | polo (implied) | ❌ NO | Implied by type |

### Hoodie / Sweatshirt
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| hood | true/false | ✅ YES | Hoodie vs crewneck sweatshirt |
| fit | slim, regular, relaxed, oversized | ✅ YES | |
| length | cropped, regular, long | ✅ YES | |
| pocket | kangaroo, none | ❌ NO | Minor detail, model sees it |
| zip | full, half, none (pullover) | ✅ YES | Changes front shape |

### Tank Top
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| fit | slim, regular, relaxed | ✅ YES | |
| neckline | crew, scoop, deep-v | ✅ YES | |

---

## BOTTOMS

### Jeans / Trousers / Chinos
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| fit | skinny, slim, straight, relaxed, wide, bootcut | ✅ YES | Critical for silhouette |
| length | full, cropped, ankle | ✅ YES | |
| rise | low, mid, high | ✅ YES | Affects waist shape |
| closure | button, zip | ❌ NO | Minor, model sees it |

### Shorts
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| length | short (above knee), knee, long (below knee) | ✅ YES | |
| fit | slim, regular, relaxed | ✅ YES | |
| drawstring | true/false | ❌ NO | Model sees it |

### Joggers / Sweatpants
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| fit | slim, regular, relaxed | ✅ YES | |
| cuff | elastic, open | ✅ YES | Changes ankle shape |
| length | full, cropped | ✅ YES | |

---

## OUTERWEAR

### Jacket
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| type | denim, leather, bomber, windbreaker, blazer | ✅ YES | Fundamentally different shapes |
| fit | slim, regular, relaxed, oversized | ✅ YES | |
| length | cropped, hip, thigh, knee | ✅ YES | |
| closure | zip, button, open | ✅ YES | |
| collar | stand, lapel, hood, none | ✅ YES | |

### Coat
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| length | thigh, knee, calf, ankle | ✅ YES | |
| fit | slim, regular, relaxed, oversized | ✅ YES | |
| closure | single-breasted, double-breasted, open | ✅ YES | |

---

## DRESSES & ONE-PIECES (future)

### Dress
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| sleeve_length | sleeveless, short, long | ✅ YES | |
| length | mini, knee, midi, maxi | ✅ YES | |
| fit | fitted, a-line, relaxed | ✅ YES | |
| neckline | (various) | ✅ YES | |

---

## FOOTWEAR (future)

### Shoes
| Attribute | Values | Prompt? | Notes |
|-----------|--------|---------|-------|
| type | sneaker, boot, loafer, sandal, etc. | ✅ YES | |
| (minimal attributes — model handles the rest) | | | |

---

## ACCESSORIES (future)

Minimal attributes — type is usually sufficient.

---

## Implementation Notes

### For `parse.js` LIST_PROMPT
The AI must extract these attributes when listing garments. Example:
```json
{
  "name": "Black graphic tee",
  "category": "Tops",
  "subtype": "t-shirt",
  "sleeve_length": "short",
  "fit": "regular",
  "neckline": "crew",
  "length": "regular"
}
```

### For `standardize.js` buildFluxPrompt
Only ✅ attributes go in the prompt. Format:
```
The garment is: Black graphic tee (Tops).
Sleeve: short-sleeve.
Fit: regular.
Neckline: crew neck.
```

### Attribute Priority
If the AI is uncertain about an attribute, OMIT it rather than guess.
A missing attribute lets the model judge from the image.
A wrong attribute actively misleads the model.

### Version History
- 2026-11-01: Initial version (men's tops, bottoms, outerwear)
- TODO: Women's clothing, footwear details, accessories
