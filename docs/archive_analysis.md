# Dublin Lifeline Directory - Archive Analysis

## Source
- Archive: `/home/martin/Downloads/Lifeline -20260911T175736Z-1-001.zip`
- Extracted to: `/tmp/opencode/lifeline-extract/Lifeline`
- Date: 2026-09-11

## Summary
- 56 archive entries → 51 extracted HTML files (0 JS, 0 CSS)
- All content is self-contained inline HTML
- ~25 duplicate pairs found
- 2 zero-byte placeholder files (dublin_lifeline_v3.html, dublin_lifeline_v3(1).html)

## Version Evolution
| Version Range | Project Name | File Count | Size Range |
|---|---|---|---|
| v3 | Dublin Community Lifeline Directory | 2 | 0-18 KB |
| v4 | Dublin Lifeline - Find Help Fast | 2 | 9.6 KB |
| v6 | Dublin Street Essentials & Support | 2 | 11.6 KB |
| v7-v8 | Dublin Street Essentials & Emergency Support | 4 | 18.4 KB |
| v9-v12 | Dublin Survival Guide | 8 | 16-27.5 KB |
| v13 | Dublin Essential Support & Pathways Guide | 2 | 30.3 KB |
| v14-v21Deep | Dublin Essential Support, Pathways & Community Guide | 22 | 34-113.6 KB |
| surv_guide-1-3 | Dublin Survival Guide (standalone) | 7 | 27.5-52.1 KB |

## Most Complete Versions
- **Dublin Community Lifeline Directory**: `dublin_lifeline.html` (18 KB, 39-entry servicesData array, map markers, GPS, day/category filtering)
- **Dublin Essential Support, Pathways & Community Guide**: `dublin_lifeline_v20Deep.html` (113.6 KB, most data entries) and `dublin_lifeline_v21Deep.html` (110.5 KB, most feature-rich with i18n, chatbotTree, language support)
- **Dublin Survival Guide**: `dublin_survival_guide-3.html` (52.1 KB, most complete standalone survival guide)

## Key Observations
1. Data scale grew dramatically: from 39 entries in v3 to 19+6 service entries with full i18n in v20Deep/v21Deep
2. v20Deep has the most total data entries (25 across 2 sub-arrays)
3. v21Deep is the most feature-rich (i18n, chatbotTree, language support, dashboard, filter, grid, localStorage, report, theme, map)
4. No separate .js or .css files - all code is inline within HTML
5. The "Lifeline " directory name has a trailing space in the extracted path

## Additional Downloads
Additional HTML files found in `/home/martin/Downloads/`:
- dublin_lifeline_v6.html, dublin_lifeline_v14.html, dublin_lifeline_v18.html
- dublin_lifeline_v20Deep.html, dublin_lifeline_v21Deep.html, dublin_lifeline_services.html, dublin_survival_guide.html

## Scraping Status
- 8 target services configured in sources.json
- Only 1 successful scrape (Samaritans Dublin)
- 7 failed (DNS resolution or HTTP 404 errors)
- All services have fallback data populated
- 1 merge completed with 0 differences detected
