# Eval Site List

This file tracks the sites used to build and evaluate the AI-feature classifier.
Known sites are used to build/tune the baseline and agent. Held-out sites are
never touched during development — they're used only for the final comparison.

**Note:** AI features on live sites change frequently. Verify each site still
has the described feature before using it in the eval, and update the notes
if something has changed.

## Known Sites (5) — used to build & tune

| # | Site | URL | Category | AI element to target | Human-first element to keep/surface | Verified date |
|---|------|-----|----------|----------------------|--------------------------------------|----------------|
| 1 | Amazon | https://www.amazon.com | Shopping | "Rufus" AI shopping assistant | Search, category filters, product specs, reviews | |
| 2 | Google Search | https://www.google.com | Search | AI Overview panel | Traditional 10 blue links | |
| 3 | eBay | https://www.ebay.com | Shopping | AI shopping assistant / AI-generated item features | Search, categories, item specifics, seller reviews | |
| 4 | Yahoo News | https://www.yahoo.com | News | AI-generated summary box | Full article, byline, sources, comments | |
| 5 | Intercom | https://www.intercom.com | Support | AI chatbot widget | "Contact us" / human support link, help search | |

## Held-Out Sites (8–10) — evaluation only, never used to tune

### Shopping
| # | Site | URL | AI element to target | Human-first element to keep/surface | Verified date |
|---|------|-----|----------------------|--------------------------------------|----------------|
| 6 | Best Buy | https://www.bestbuy.com | | | |
| 7 | Walmart | https://www.walmart.com | | | |
| 8 | Etsy | https://www.etsy.com | | | |

### News
| # | Site | URL | AI element to target | Human-first element to keep/surface | Verified date |
|---|------|-----|----------------------|--------------------------------------|----------------|
| 9 | [Major news outlet #2 TBD] | | | | |
| 10 | [News aggregator TBD] | | | | |
| 11 | [Local/regional news site TBD] | | | | |

### Support / Search
| # | Site | URL | AI element to target | Human-first element to keep/surface | Verified date |
|---|------|-----|----------------------|--------------------------------------|----------------|
| 12 | Bing | https://www.bing.com | | | |
| 13 | DuckDuckGo | https://www.duckduckgo.com | | | |
| 14 | [Different SaaS support page TBD] | | | | |
| 15 | [Stretch: bank or airline site TBD] | | | *Designated hard case* | |

## Legend
- **TBD** = to be confirmed by visiting the site and checking the current AI feature is live
- **Designated hard case** = the site called out in the submission video/README as the challenging case, per the hackathon brief's requirement to "include one challenging case and explain what it revealed"