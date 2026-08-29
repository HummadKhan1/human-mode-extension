# Eval Site List

This file tracks the sites used to build and evaluate the AI-feature classifier.
Known sites are used to build/tune the baseline and agent. Held-out sites are
never touched during development — they're used only for the final comparison.

**Note:** AI features on live sites change frequently and are often A/B tested,
geo-gated, or only appear on search results rather than homepages. Verify each
site still has the described feature before using it in the eval, and update
the "Verified" column with the date you checked.

## Known Sites (5) — used to build & tune

| # | Site | URL | Category | AI element to target | Human-first element to keep/surface | Verified |
|---|------|-----|----------|----------------------|--------------------------------------|----------|
| 1 | Amazon | https://www.amazon.com | Shopping | "Rufus" AI shopping assistant | Search, category filters, product specs, reviews | [ ] |
| 2 | Google Search | https://www.google.com/search?q=... (must search a query, not homepage) | Search | AI Overview panel | Traditional 10 blue links | [x] 2026-08-29 |
| 3 | Bing (search a query) | https://www.bing.com/search?q=... | News/Search | AI/Copilot summary card | Traditional search results | [ ] |
| 4 | Zendesk.com | https://www.zendesk.com | Support | AI chatbot widget (Zendesk sells this as their core product, guaranteed placement) | "Talk to a human" / contact support link | [ ] |

**Note:** eBay was dropped from known sites — its AI shopping agent is only rolled out to a
small percentage of accounts, making it unreliable to test against consistently.
Shopping category is still covered via 3 held-out sites below (Best Buy, Walmart, Etsy).

## Held-Out Sites (8–10) — evaluation only, never used to tune

### Shopping
| # | Site | URL | AI element to target | Human-first element to keep/surface | Verified |
|---|------|-----|----------------------|--------------------------------------|----------|
| 6 | Best Buy | https://www.bestbuy.com | | | [ ] |
| 7 | Walmart | https://www.walmart.com | | | [ ] |
| 8 | Etsy | https://www.etsy.com | | | [ ] |

### News / Search
| # | Site | URL | AI element to target | Human-first element to keep/surface | Verified |
|---|------|-----|----------------------|--------------------------------------|----------|
| 9 | Google News (search a query) | https://news.google.com | AI-generated "Top stories" summary | Full article, byline, sources | [ ] |
| 10 | Yahoo News | https://news.yahoo.com | AI summary box on articles (if live) | Full article, byline, sources, comments | [ ] |
| 11 | [Local/regional news site TBD] | | | *Designated hard case candidate — check if less standardized* | [ ] |

### Support
| # | Site | URL | AI element to target | Human-first element to keep/surface | Verified |
|---|------|-----|----------------------|--------------------------------------|----------|
| 12 | Shopify Help Center | https://help.shopify.com | AI chatbot widget | "Contact support" / human option | [ ] |
| 13 | Spotify Support | https://support.spotify.com | AI chatbot-first support flow | Human contact option, help search | [ ] |
| 14 | Stripe Support | https://support.stripe.com | AI-assisted help widget | Human contact option | [ ] |

## Legend
- **TBD** = to be confirmed by visiting the site and checking the current AI feature is live
- **Designated hard case** = the site called out in the submission video/README as the challenging case, per the hackathon brief's requirement to "include one challenging case and explain what it revealed"
- **[ ]** = check off once you've personally visited and confirmed the feature is present, with today's date