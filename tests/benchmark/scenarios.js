// Stylist benchmark scenarios (Sprint 5, E1).
//
// Fixed wardrobe + requests. run-benchmark.js sends each through the real
// prompt + model and records the output for founder judging. Re-run after
// every prompt change; a change ships only if it doesn't regress.
//
// Each scenario: { id, wardrobe, messages, styleProfile, checks }
// checks are human-judged properties (not auto-asserted — taste isn't a unit test).
const SCENARIOS = [
  {
    id: "color-harmony-business-casual",
    wardrobe: [
      { id: "a1", name: "Navy Oxford shirt", category: "Tops", colors: ["navy"], pattern: "solid", formality: "business-casual", warmth: "light", brand: "Uniqlo" },
      { id: "a2", name: "White tee", category: "Tops", colors: ["white"], pattern: "solid", formality: "casual", warmth: "light", brand: "Uniqlo" },
      { id: "a3", name: "Khaki chinos", category: "Bottoms", colors: ["tan"], pattern: "solid", formality: "business-casual", warmth: "light", brand: "H&M" },
      { id: "a4", name: "Dark jeans", category: "Bottoms", colors: ["denim"], pattern: "solid", formality: "casual", warmth: "medium", brand: "Levi's" },
      { id: "a5", name: "Brown loafers", category: "Shoes", colors: ["brown"], pattern: "solid", formality: "business-casual", warmth: "light", brand: null },
      { id: "a6", name: "White sneakers", category: "Shoes", colors: ["white"], pattern: "solid", formality: "casual", warmth: "light", brand: "Nike" }
    ],
    messages: [{ role: "user", text: "Business casual dinner tonight, 65°F. What should I wear?" }],
    styleProfile: [],
    checks: [
      "picks a top + bottom (+ shoes)",
      "formality fits business-casual dinner (not the white tee + sneakers)",
      "colors harmonize (navy/tan/brown is the classic answer)"
    ]
  },
  {
    id: "pattern-clash",
    wardrobe: [
      { id: "b1", name: "Striped Breton top", category: "Tops", colors: ["navy", "white"], pattern: "striped", formality: "casual", warmth: "light", brand: null },
      { id: "b2", name: "Plaid flannel shirt", category: "Tops", colors: ["red", "black"], pattern: "plaid", formality: "casual", warmth: "medium", brand: null },
      { id: "b3", name: "Black jeans", category: "Bottoms", colors: ["black"], pattern: "solid", formality: "casual", warmth: "medium", brand: null },
      { id: "b4", name: "Olive cargo pants", category: "Bottoms", colors: ["olive"], pattern: "solid", formality: "casual", warmth: "light", brand: null }
    ],
    messages: [{ role: "user", text: "Casual Saturday outfit?" }],
    styleProfile: [],
    checks: [
      "does NOT pair the striped top with the plaid shirt (pattern clash)",
      "reasons about pattern interaction explicitly"
    ]
  },
  {
    id: "duplicate-names",
    wardrobe: [
      { id: "c1", name: "Black tee", category: "Tops", colors: ["black"], pattern: "solid", formality: "casual", warmth: "light", brand: "Uniqlo" },
      { id: "c2", name: "Black tee", category: "Tops", colors: ["black"], pattern: "graphic", formality: "casual", warmth: "light", brand: "Nike" },
      { id: "c3", name: "Grey joggers", category: "Bottoms", colors: ["grey"], pattern: "solid", formality: "casual", warmth: "medium", brand: null }
    ],
    messages: [{ role: "user", text: "Gym then groceries. Pick something." }],
    styleProfile: [],
    checks: [
      "can distinguish the two black tees (handles, not names)",
      "outfit references real item IDs"
    ]
  },
  {
    id: "weather-mismatch",
    wardrobe: [
      { id: "d1", name: "Wool overcoat", category: "Outerwear", colors: ["charcoal"], pattern: "solid", formality: "business-casual", warmth: "heavy", brand: null },
      { id: "d2", name: "Linen shirt", category: "Tops", colors: ["cream"], pattern: "solid", formality: "casual", warmth: "light", brand: null },
      { id: "d3", name: "Denim jacket", category: "Outerwear", colors: ["denim"], pattern: "solid", formality: "casual", warmth: "medium", brand: null },
      { id: "d4", name: "Chino shorts", category: "Bottoms", colors: ["tan"], pattern: "solid", formality: "casual", warmth: "light", brand: null }
    ],
    messages: [{ role: "user", text: "It's 85°F and sunny. Going for a walk." }],
    styleProfile: [],
    checks: [
      "does NOT pick the wool overcoat (warmth mismatch)",
      "weather reasoning is explicit"
    ]
  },
  {
    id: "preference-honoring",
    wardrobe: [
      { id: "e1", name: "Burgundy sweater", category: "Tops", colors: ["burgundy"], pattern: "solid", formality: "casual", warmth: "heavy", brand: null },
      { id: "e2", name: "Forest green henley", category: "Tops", colors: ["forest green"], pattern: "solid", formality: "casual", warmth: "medium", brand: null },
      { id: "e3", name: "Navy trousers", category: "Bottoms", colors: ["navy"], pattern: "solid", formality: "business-casual", warmth: "light", brand: null }
    ],
    messages: [{ role: "user", text: "Date night, smart casual." }],
    styleProfile: ["prefers earth tones over jewel tones", "avoids green tops"],
    checks: [
      "honors the style profile (no green top despite it being a fine pick otherwise)",
      "picks burgundy + navy"
    ]
  },
  {
    id: "incomplete-warm-wardrobe",
    wardrobe: [
      { id: "f1", name: "White tee", category: "Tops", colors: ["white"], pattern: "solid", formality: "casual", warmth: "light", brand: null },
      { id: "f2", name: "Black tee", category: "Tops", colors: ["black"], pattern: "solid", formality: "casual", warmth: "light", brand: null }
    ],
    messages: [{ role: "user", text: "Job interview tomorrow. Help!" }],
    styleProfile: [],
    checks: [
      "does NOT fabricate a blazer that isn't in the wardrobe",
      "is honest about the wardrobe gap (or asks a clarifying question)"
    ]
  }
];

module.exports = { SCENARIOS };
