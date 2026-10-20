/**
 * The business's own details, in one place.
 *
 * These appear in the header, the footer, the contact CTAs, structured data and
 * order emails. Scattering them means a phone-number change becomes a
 * find-and-replace across a dozen files, and one of them gets missed.
 *
 * Sourced from the Instagram profile (DESIGN.md §1).
 */
export const BUSINESS = {
  name: "Gadgets Garden",
  tagline: "Quality. Trust. Performance.",

  phone: "0805 694 7271",
  address: "12 Oshitelu Street, adjacent GTBank, Computer Village, Ikeja, Lagos",
  city: "Ikeja, Lagos",

  instagramHandle: "@gadgets__garden",
  instagramUrl: "https://www.instagram.com/gadgets__garden/",

  /**
   * WhatsApp is the shop's existing sales channel and stays the support route
   * even now that checkout is online — "24/7 customer support" is a promise the
   * business makes on every post.
   */
  whatsappUrl: "https://wa.me/2348056947271",

  /** The four value badges from the post templates. */
  promises: [
    "Warranty on all items",
    "Nationwide delivery",
    "24/7 customer support",
    "Paid before dispatch",
  ],

  /** Stated plainly rather than buried — it is the differentiation. */
  weDontDo: ["Swap", "Trade-ins", "Easy buys", "Pay on delivery"],
} as const;
