# Design reference — Gadgets Garden

Captured 2026-08-01 from the two sources named at kickoff. This file is the brief the
storefront is built against; `storefront/app/globals.css` is its implementation.

---

## 1. The business

**Gadgets Garden** (`@gadgets__garden`, verified, 1,282 posts / 1,788 followers).
Display name "GAMING LAPTOP NG". Category: Computer Store.

- **Address:** 12 Oshitelu Street, adjacent GTBank, Computer Village, Ikeja, Lagos 100011
- **Phone:** 08056947271 · WhatsApp is the current sales channel
- **Tagline:** QUALITY. TRUST. PERFORMANCE.
- **Positioning:** "We provide high quality laptops for work, school, business and
  everything in between." Premium foreign-used and new laptops — HP, Dell, Alienware,
  ASUS, Lenovo. Observed prices: HP Pavilion 15 ₦600,000; Alienware X15 R1 ₦1,900,000.

**Policy copy that must survive onto the site**, because it is the brand's whole
differentiation and it is stated on nearly every post:

- Four value badges: **NEW · FOREIGN USED · AFFORDABLE PRICES · RELIABLE QUALITY**
- **WE DON'T DO:** swap · trade-ins · easy buys · **pay on delivery**
- **Warranty is available on all items**
- **24/7 customer support** — "we are always here for you"
- Nationwide delivery

The no-pay-on-delivery rule is the commercial reason online checkout exists: money lands
before anything ships. The storefront should state it plainly rather than bury it.

---

## 2. Brand identity

**Sampled from the supplied vector logo** (`storefront/public/gadgetsgardenlogo.svg`),
which is authoritative.

An earlier pass derived a wider mint→magenta range by eye from the refracted-light streak
in the Instagram post templates. The mark itself turned out narrower and cooler — teal
through indigo — so the tokens were tightened to it. Magenta and amber survive only in
`--gg-aurora`, the hero wash, where that streak is what is being evoked.

| Token | Value | Where it comes from |
|---|---|---|
| `--gg-ink` | `#000000` | post background |
| `--gg-teal` | `#6ECED3` | the large sweep of the `G` |
| `--gg-cyan` | `#5ACBD1` | inner curl of the `G` |
| `--gg-sky` | `#71C5DF` | the counter (the enclosed dot) |
| `--gg-blue` | `#5E6FED` | outer stroke, lower left |
| `--gg-indigo` | `#626BEC` | the tail sweeping right |
| `--gg-magenta` | `#E85CC8` | refraction streak — hero wash only |
| `--gg-amber` | `#F0A050` | refraction streak — hero wash only |

**The logo mark** is a stylised `G` swirl running teal → cyan → sky → blue → indigo. The
wordmark is GADGETS GARDEN in bold geometric sans with wide tracking; the tagline sits
beneath it in the same tracking, in the logo's teal.

The mark's colours are **fixed, never themed** — it is the same object on the white
catalogue and the black hero. The wordmark uses `currentColor` so it inverts with its
surface, which is how the brand appears on its own material.

**The signature gradient** — teal → cyan → sky → blue → indigo, in the mark's own order.
Use it sparingly and with intent: the logo, one hero element, active states, the underline
on a live filter. Applied to everything it stops meaning anything.

### Contrast

Condition badges are 11–12px text and are held to **4.5:1 against white**. Every value was
measured, not eyeballed — the first pass shipped a green at 3.45:1, which was a real
accessibility bug caught only when the ratios were actually computed.

| Token | Light | Ratio | Dark | Ratio |
|---|---|---|---|---|
| `--condition-new` | `#14874E` | 4.56 | `#35D68A` | 11.14 |
| `--condition-used` | `#4A56D4` | 5.88 | `#5ACBD1` | 10.90 |
| `--condition-refurb` | `#6D3FD9` | 6.24 | `#A98BFF` | 7.82 |

`--gg-blue` itself reaches only 4.22:1 on white, so it is used for **focus rings and UI
affordances** (which need 3:1) and never for small text. `--condition-used` is a darkened
cousin: it reads as brand blue while staying legible.

---

## 3. Layout reference (Behance — Arafat Ul Shezan, May 2025)

The inspiration is **light and minimal**: white background, near-black type, thin grey
card borders, product photography on soft grey tiles. Colour comes almost entirely from
the products themselves.

Observed tokens:

| Role | Value |
|---|---|
| Surface | `#FFFFFF` |
| Text | `#111111` |
| Muted text (compare-at price, sublabels) | `#8A8A8A` |
| Card border | `#E5E5E5`, radius ~12px |
| Product image tile | `#F4F4F4`, radius ~10px |
| Countdown chip | `#EFEFEF` |
| Footer | near-black `#141414` |
| Primary button | solid black pill, white text |
| Secondary button | white pill, grey border, dark text |

**Section order:**

1. **Nav** — logo · full-round search input · Login/Register · wishlist · cart
2. **Category row** — 7 flat text links (note: "Used Device" is one of them, which maps
   directly onto our foreign-used stock)
3. **Hero** — thin-bordered rounded card, copy left / product render right, "Authorised
   Reseller" badge top-right, fine print bottom-left
4. **Trust strip** — 5 icon+label items separated by vertical rules
5. **Hot Deal 🔥** — horizontal carousel of product cards with arrow controls. Card =
   image tile, name, price + struck-through compare price, "Buy Now" (solid) and "Add to
   Cart" (outline) pills
6. **Limited Offer** — countdown (Days/Hr/Min/Sec chips) over a row of flat grey tiles
   with name and price only, no buttons
7. **Promo banner** — full-width gradient panel, big display type left, product cluster right
8. **Shop by brand** — greyscale brand logo row
9. **Second carousel** ("Sound Surround") with a "Show All →" affordance
10. **Editorial** — two centred prose blocks over white
11. **Footer** — dark, logo, About / Terms / Privacy, newsletter signup

---

## 4. The tension, and how it resolves

The reference is white and minimal. The brand's own identity is black and iridescent.
They cannot both win outright.

**Resolution: light-led with dark bookends.** Keep the Behance layout and its white
catalogue surface — product photography reads better on white, prices scan faster, and it
is what the user picked as inspiration. Give the brand its identity where identity
belongs: a dark hero and a dark footer carrying the iridescent gradient, plus the blue as
the single interactive accent throughout.

Concretely:

- **White** — catalogue, product detail, cart, checkout. Behance tokens above.
- **Black + gradient** — hero, promo banners, footer, order-confirmation moments.
- **`--gg-blue`** — links, focus rings, active filters, primary CTA on light surfaces.
- **The full gradient** — logo, hero accent, and nothing else without a reason.

Adapted from the reference, because the business differs:

- Prices in **₦** with thousands separators, tabular figures.
- A **condition badge** (New / Foreign Used / Refurbished) on every card — the reference
  has no equivalent and it is the first thing a buyer here looks for.
- Cards must carry **key specs** (CPU / RAM / storage), not just a name. Two ThinkPads at
  different prices are otherwise indistinguishable.
- The "Limited Offer" countdown is **not** adopted. Serialized one-of-a-kind stock does
  not do timed discounts, and a fake countdown undercuts a brand selling on trust.
- "Buy Now / Add to Cart" stays, but for serialized units "Add to Cart" reserves a
  specific machine — see the reservation rule in the build plan.

---

## 5. Motion

Budget concentrated in four places, not sprinkled:

1. **Hero** — staggered entrance; slow drift on the gradient; parallax on the laptop render.
2. **Scroll reveals** — one shared `<Reveal>` wrapper over `useInView`, so timing is tuned
   in one file rather than per section.
3. **Product card hover** — image scale + spec overlay, `transform`/`opacity` only.
4. **Route transitions** — shared-element morph on the product image, grid → detail.

Rules: honour `prefers-reduced-motion`; never animate a property that triggers layout;
nothing that moves after first paint above the fold.

---

## 6. Still needed from the client

- Vector logo (SVG). The mark is currently only available as a raster crop from Instagram.
- The real delivery fee table — Lagos vs other states.
- Product photography without the promo-template overlays.
