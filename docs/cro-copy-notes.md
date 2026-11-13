# CRO and copywriting research notes

This is a source-based editorial and UX decision record, not a claim that conversion uplift has been measured. The site is a personal job-search tool rather than a consumer store. Its useful outcome is finding a relevant opportunity and opening an accurate primary source, not creating pressure to click.

## Source research

### Accelerated Agency: first identify the bottleneck

Accelerated's published process starts with qualitative and quantitative research: customer reviews, user recordings, surveys, page drop-offs, support questions and competitor positioning. It then prioritizes high-impact changes, matches the message to the visitor's awareness stage and tests changes against business outcomes. Their FAQ emphasizes profit per session rather than conversion rate alone, and warns that success cannot be guaranteed. Sources:

- [Accelerated Agency, process and approach](https://acceleratedagency.com/)
- [Accelerated Agency, full-funnel growth process](https://www.acceleratedagency.com/process)
- [Accelerated Agency, conversion optimization FAQ](https://acceleratedagency.com/faq)
- [Publicly available related paper on narrative-based acquisition funnels](https://www.studocu.com/sv/document/malardalens-universitet/foretagsekonomi-grundkurs/multiple-8-figure-scaling-process-with-narrative-based-acquisition-funnels-carl-weische-accelerated/80985280)

A link to Carl Weische's document, [Master Thesis: Scaling from $10M to greater than $25M profitable](https://docs.google.com/document/d/1g0Qu_YTrXbAu8fe7vGBelXi6IYIBApIGIpUebAmXn3E/edit), was supplied for this project. Its title is publicly visible, but the full Google Docs text is not accessible through the available public reader. We have **not** represented its full contents as reviewed. This revision relies on primary Accelerated pages and independently published UX research. A full document-specific review would require the thesis text itself.

### Plain-language UX and scanning behavior

- [Nielsen Norman Group: How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/) supports scannable copy, meaningful headings, short paragraphs and putting the conclusion first.
- [Nielsen Norman Group: Applying Writing Guidelines to Web Pages](https://www.nngroup.com/articles/applying-writing-guidelines-web-pages/) supports concise, objective wording instead of generic marketing claims.
- [Nielsen Norman Group: UX Writing Study Guide](https://www.nngroup.com/articles/ux-writing-study-guide/) supports plain language that is understood at first reading.
- [Baymard: Product List and Filtering UX](https://baymard.com/research/ecommerce-product-lists) supports useful filters and sorting for comparison tasks.
- [Baymard: Product List UX Best Practices](https://baymard.com/research-articles/current-state-product-list-and-filtering) supports visible applied filters, well-labeled sorting and relevant criteria.
- [Baymard: UX Audit Checklist](https://baymard.com/blog/ux-audit-checklist-template) suggests showing enough information on each card to choose the next action without opening every detail page.

A job list is not a store catalog, but both interfaces support rapid comparison. Transfer the decision clarity, not sales pressure or promotional tactics.

## CRO concepts translated to job discovery

Accelerated's public process starts with finding the biggest drop-off, prioritizing hypotheses, matching the message to the reader and testing material outcomes. Its FAQ says results are judged by profit per session rather than raw conversion rate, and that case studies are selected outcomes, not typical guarantees. This is valuable as a **decision framework**, not as an instruction to market jobs like products. [Accelerated process](https://acceleratedagency.com/) | [Accelerated FAQ](https://acceleratedagency.com/faq)

MECLABS distinguishes visitor motivation, clarity of value, incentives, friction and anxiety. We translate this into concrete questions: Is the job worth examining? What is the pay? What is required? Is it nearby? Is the date reliable? Can the visitor reach the source without guesswork? These are usability hypotheses, not measured improvements. [MECLABS conversion heuristic](https://images.meclabs.com/slide-decks/MECLABS-ConversionHeuristic.pdf)

The Nielsen Norman Group advises specific link labels rather than generic labels repeated throughout a page. We keep concise, consistent visible actions while adding job-specific accessible names so screen reader users can distinguish destinations. [UX writing FAQs](https://www.nngroup.com/articles/ux-writing-faqs/) | [Information scent](https://www.nngroup.com/articles/information-scent/)

Baymard's research on comparison interfaces supports displaying decisive attributes on cards and making applied filters visible. In this job-search context those attributes are compensation, qualifications, city, schedule, posting age and application dates. A salary or date not provided by the source is labeled as such. [Listing information](https://baymard.com/research-articles/product-listing-information) | [Applied filters](https://baymard.com/research-articles/how-to-design-applied-filters)

We intentionally do **not** borrow false urgency, discounting, promotional claims, vanity click-through targets or aggressive lead capture from commerce funnels. The meaningful task is reviewing a relevant job with correct information, not increasing clicks to expired listings.

## Changes made

1. **User-first message.** Replaced abstract references to work beyond a screen with a specific headline about finding work that fits, and a supporting sentence stating the actual benefits: pay, qualifications, distance and deadlines.
2. **Match motivation to content.** Direct field filters for movement, heritage and books, coins and auctions, and Shopify/technical work. Keep the SGV city as the geographic center rather than suggesting an LA-wide search.
3. **Put proof before persuasion.** Show reported pay, qualifications, dates, employer and city in each job card; keep source-status explanations accessible. Do not claim a link is still accepting applicants.
4. **Clear next step.** Job actions now say "Check job details", "Review source listing" or "Review archived listing" as appropriate, instead of implying a confirmed application is available.
5. **Reduce decision friction.** Preserve two navigation sections. Use a concise search panel, visible result counts, clear sorting and removable filter chips. Keep broader role ideas separate from curated leads.
6. **Keep the benefits concrete.** Rewrote curated job summaries around real tasks and qualifications; removed empty adjectives and speculative career promises.
7. **Explain uncertainty.** Posting age refers only to source-published dates; never substitute the date first researched. Source checks are not job-status checks. Commute times are never invented.
8. **Accessibility first.** Legible Arial body text, Garamond headings, visible focus states, 44-pixel primary controls, reduced-motion behavior and a keyboard-operable interface.
9. **Consistent Gruvbox palette.** The core color system is `#1d2021`, `#282828`, `#32302f`, `#3c3836`, with green, aqua, blue, yellow, orange, red and purple used consistently to categorize roles and convey status.
10. **Fewer moving parts.** A plain JavaScript module, a small set of pure helpers and JSON files generate one self-contained HTML document. The build updates the inline CSP script hash; no bundle packages or remote fonts are needed.

## Further tests worth running

Do not claim success from a redesign alone. The following are *hypotheses*, not measured wins.

| Hypothesis | Low-cost validation | Desired signal |
| --- | --- | --- |
| Pay and qualification details lower friction | Ask five real job seekers to choose two postings in a moderated task | Faster decisions, fewer unanswered questions |
| Clearer city/radius language prevents location confusion | Ask participants to estimate which cities appear with a 15-mile filter | Correct mental model without hints |
| Topic shortcuts help career changers | Observe users searching for museum, park, coin and Shopify work | Fewer unnecessary filter changes |
| Source and date explanations improve trust | Ask users what "link checked" and "posted" mean | Correct answers without assuming job availability |
| A compact two-section navigation is easier | Run mobile and desktop tasks with a keyboard and screen reader | Clear focus order and straightforward task completion |

If the site gains sufficient traffic, consider privacy-respecting, opt-in aggregate measurement of relevant source-link clicks and completed research tasks. Keep personal notes private and never add artificial scarcity, fabricated ratings, or false proof.

## Voice rules

Use straightforward sentence case, short paragraphs and verbs that describe the actual action. Explain jargon only when it helps. Avoid oversized claims, forced urgency, filler, decorative italics and excessive capitalization. Do not use em dashes in any public output, code, data or documentation.
