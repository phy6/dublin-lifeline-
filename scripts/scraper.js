#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'sources.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'scraped_output.json');
const DOCS_PATH = path.join(__dirname, '..', 'docs');

const ACTIVITY_TAXONOMY = [
  'food', 'shelter', 'medical', 'counselling', 'addiction', 'recovery',
  'mental-health', 'crisis-support', 'suicide-prevention', 'housing',
  'homelessness', 'emergency', 'accommodation', 'elderly', 'community',
  'support', 'legal', 'advice', 'debt', 'education', 'welfare',
  'clothing', 'childcare', 'employment', 'training', 'health',
  'social', 'isolation', 'domestic-violence', 'sexual-abuse',
  'pregnancy', 'parenting', 'disability', 'refugee', 'asylum',
  'gambling', 'debt-management', 'credit-union', 'budgeting',
  'transport', 'digital-inclusion', 'arts', 'culture', 'recreation',
  'sport', 'music', 'therapy', 'wellbeing', 'respite',
  'drop-in', 'hotline', 'helpline', 'outreach', 'volunteering',
  'fundraising', 'lobbying', 'policy', 'research', 'information'
];

const ACTIVITY_SELECTORS = [
  '.services li', '.service-item', '.services-list li', '.service-list li',
  '.activities li', '.activity-list li', '.our-services li',
  '[itemprop="serviceType"]', '.what-we-do li', '.programs li',
  '.program-item', '.offering li', '.support-list li',
  '.services-section li', '.content ul li', '.entry-content li',
  '.services p', '.activity p', '.programs p', '.what-we-do p'
];

class DublinLifelineScraper {
  constructor() {
    this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    this.results = [];
    this.errors = [];
    this.rateLimit = this.config.rateLimit || { requestsPerMinute: 10, timeout: 15000, retryAttempts: 3, retryDelay: 2000 };
    this.queue = [];
    this.processed = 0;
  }

  async init() {
    console.log('[Scraper] Initializing Dublin Lifeline Scraper');
    console.log(`[Scraper] Loaded ${this.config.targets.length} target URLs`);
    console.log(`[Scraper] Activity taxonomy: ${ACTIVITY_TAXONOMY.length} keywords`);
    this.queue = [...this.config.targets];
  }

  findLocalArchive(id) {
    const candidates = [
      `${id}.html`, `${id}.htm`,
      `dublin_lifeline_${id}.html`, `${id}_source.html`
    ];
    for (const file of candidates) {
      const filePath = path.join(DOCS_PATH, file);
      if (fs.existsSync(filePath)) {
        console.log(`[Scraper] Found local archive for ${id}: ${file}`);
        return fs.readFileSync(filePath, 'utf-8');
      }
    }
    return null;
  }

  async fetch(url, redirectCount = 0) {
    if (redirectCount > 10) throw new Error(`Too many redirects for ${url}`);
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error(`Timeout fetching ${url}`));
      }, this.rateLimit.timeout);

      client.get(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0.0.0' }
      }, (res) => {
        clearTimeout(timeout);
        const loc = res.headers.location;
        if ((res.statusCode === 301 || res.statusCode === 302) && loc) {
          const nextUrl = loc.startsWith('http') ? loc : new URL(loc, url).href;
          this.fetch(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 400) {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        } else {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => reject(new Error(`HTTP ${res.statusCode} for ${url}`)));
        }
      }).on('error', reject);
    });
  }

  retry(fn, attempts = 3, delay = 2000) {
    return fn().catch(async (err) => {
      if (attempts <= 1) throw err;
      await new Promise(r => setTimeout(r, delay));
      return this.retry(fn, attempts - 1, delay * 1.5);
    });
  }

  resolveUrl(baseUrl, url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        return base.origin + url;
      } catch (e) { return url; }
    }
    try { return new URL(url, baseUrl).href; } catch (e) { return url; }
  }

  extractSelectors(html, selectors, baseUrl) {
    const result = {};
    try {
      const $ = cheerio.load(html);
      for (const [key, selectorList] of Object.entries(selectors)) {
        result[key] = [];
        for (const selector of selectorList) {
          try {
            $(selector).each((i, el) => {
              const text = $(el).text().trim();
              const href = $(el).attr('href') || '';
              const attrValue = $(el).attr('content') || $(el).attr('datetime') || '';
              const htmlContent = $(el).html();
if (key === 'website') {
                if (href) {
                    const resolved = this.resolveUrl(baseUrl, href);
                    if (resolved) result[key].push(resolved);
                } else if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                    result[key].push(text);
                }
            } else {
                const val = text || href || attrValue || (htmlContent ? htmlContent.trim() : '');
                if (val) result[key].push(val);
              }
            });
          } catch (e) { /* selector error, skip */ }
        }
        result[key] = [...new Set(result[key].filter(Boolean))];
      }
    } catch (e) {
      for (const key of Object.keys(selectors)) {
        result[key] = [];
      }
    }
    return result;
  }

  extractActivities(html, baseUrl, fallbackServices) {
    const $ = cheerio.load(html);
    const found = new Set();
    const fullText = $('body').text().toLowerCase();

    // 1. Match taxonomy keywords found in the page text
    for (const keyword of ACTIVITY_TAXONOMY) {
      const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (regex.test(fullText)) {
        found.add(keyword);
      }
    }

    // 2. Extract from structured service/activity list elements
    for (const selector of ACTIVITY_SELECTORS) {
      $(selector).each((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (!text) return;
        for (const keyword of ACTIVITY_TAXONOMY) {
          const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          if (regex.test(text)) {
            found.add(keyword);
          }
        }
      });
    }

    // 3. Extract from link text and button labels
    $('a, button').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (!text) return;
      for (const keyword of ACTIVITY_TAXONOMY) {
        const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (regex.test(text)) {
          found.add(keyword);
        }
      }
    });

    // 4. Extract from headings (h2, h3, h4) that describe services
    $('h2, h3, h4').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (!text) return;
      for (const keyword of ACTIVITY_TAXONOMY) {
        const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (regex.test(text)) {
          found.add(keyword);
        }
      }
    });

    // 5. Extract from meta description and title
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const title = $('title').text().toLowerCase();
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    const allText = (metaDesc + ' ' + title + ' ' + metaKeywords).toLowerCase();
    for (const keyword of ACTIVITY_TAXONOMY) {
      const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (regex.test(allText)) {
        found.add(keyword);
      }
    }

    // 6. Extract from itemprop/serviceType structured data
    $('[itemprop="serviceType"], [itemprop="offers"], .service-type, .program-type').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (!text) return;
      for (const keyword of ACTIVITY_TAXONOMY) {
        const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (regex.test(text)) {
          found.add(keyword);
        }
      }
    });

    // Combine dynamically found with fallback services (union, deduplicated)
    const dynamicActivities = Array.from(found);
    const allServices = [...new Set([...fallbackServices, ...dynamicActivities])];

    // Prioritize: keep fallback order first, then append new discoveries
    const ordered = [];
    const seen = new Set();
    for (const svc of allServices) {
      if (!seen.has(svc)) {
        ordered.push(svc);
        seen.add(svc);
      }
    }

    console.log(`[Scraper] Activities: ${dynamicActivities.length} dynamic + ${fallbackServices.length} fallback = ${ordered.length} total`);
    if (dynamicActivities.length > 0) {
      console.log(`[Scraper] Discovered: ${dynamicActivities.join(', ')}`);
    }

    return {
      services: ordered,
      dynamicActivities,
      matchedSelectors: dynamicActivities.length > 0
    };
  }

  extractTags(html) {
    const $ = cheerio.load(html);
    const found = new Set();
    const fullText = $('body').text().toLowerCase();

    const tagPatterns = [
      'homeless', 'emergency', 'food', 'shelter', 'medical', 'counselling',
      'addiction', 'recovery', 'mental-health', 'crisis', 'housing',
      'legal', 'education', 'elderly', 'community', 'support',
      'harm-reduction', 'therapy', 'wellbeing', 'drop-in', 'outreach',
      'family', 'children', 'youth', 'women', 'men', 'vulnerable',
      'refugee', 'asylum-seeker', 'disability', 'carers', 'volunteer'
    ];

    for (const tag of tagPatterns) {
      const regex = new RegExp('\\b' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (regex.test(fullText)) {
        found.add(tag);
      }
    }

    // Also check structured data
    $('[itemprop="keywords"], .tags a, .tag').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text && tagPatterns.includes(text)) {
        found.add(text);
      }
    });

    return Array.from(found);
  }

  async scrapeTarget(target) {
    const { id, name, url, selectors, fallback } = target;
    console.log(`[Scraper] Processing: ${name} (${id})`);

    let html = null;
    let dataSource = 'scraped';

    try {
      html = await this.retry(() => this.fetch(url), this.rateLimit.retryAttempts, this.rateLimit.retryDelay);
      console.log(`[Scraper] Live fetch succeeded for ${name}`);
    } catch (err) {
      console.warn(`[Scraper] Live fetch failed for ${name}: ${err.message}`);
      html = this.findLocalArchive(id);
      if (html) {
        dataSource = 'local-archive';
        console.log(`[Scraper] Using local archive fallback for ${name}`);
      } else {
        console.error(`[Scraper] No local archive found for ${name}`);
        this.errors.push({ id, name, url, error: err.message });
        this.results.push({
          id, name, url,
          scrapedAt: new Date().toISOString(),
          phone: fallback.phone || '',
          phoneAll: [fallback.phone || ''],
          address: fallback.address || '',
          addressAll: [fallback.address || ''],
          hours: fallback.hours || {},
          email: fallback.email || '',
          website: url,
          description: '',
          latitude: fallback.latitude || null,
          longitude: fallback.longitude || null,
          tags: fallback.tags || [],
          services: fallback.services || [],
          dynamicActivities: [],
          activityMatchCount: 0,
          category: fallback.category || 'General',
          dataSource: 'fallback',
          scrapeSuccess: false,
          error: err.message
        });
        return;
      }
    }

    try {
      const extracted = this.extractSelectors(html, selectors, url) || {};

      const phone = (extracted.phone && extracted.phone.length > 0) ? extracted.phone : (fallback.phone ? [fallback.phone] : []);
      const address = (extracted.address && extracted.address.length > 0) ? extracted.address : (fallback.address ? [fallback.address] : []);
      let hours;
      try {
        hours = (extracted.hours && extracted.hours.length > 0) ? this.normalizeHours(extracted.hours) : (fallback.hours || {});
      } catch (e) {
        hours = fallback.hours || {};
      }

      // DYNAMIC ACTIVITY EXTRACTION
      let activities = { services: fallback.services || [], dynamicActivities: [], matchedSelectors: false };
      let tags = [];
      try {
        activities = this.extractActivities(html, url, fallback.services || []);
        tags = this.extractTags(html);
      } catch (e) {
        console.warn(`[Scraper] Activity extraction fallback for ${name}: ${e.message}`);
        activities = { services: fallback.services || [], dynamicActivities: [], matchedSelectors: false };
        tags = (fallback.tags || []);
      }

      // Extract description from meta and body
      let description = '';
      try {
        const $ = cheerio.load(html);
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        const aboutText = $('.about-text, .about, .mission, .mission-statement, .about-us p').text().trim();
        description = (extracted.description && extracted.description.length > 0)
          ? extracted.description[0]
          : (metaDesc || aboutText || '');
      } catch (e) {
        description = (extracted.description && extracted.description.length > 0) ? extracted.description[0] : '';
      }

      // Determine category dynamically from page content or use fallback
      let pageCategory = null;
      try { pageCategory = this.detectCategory(html, activities.services); } catch (e) {}
      const category = pageCategory || fallback.category || 'General';

      // Check for additional data points
      const website = (extracted.website && extracted.website.length > 0) ? extracted.website[0] : url;
      const email = (extracted.email && extracted.email.length > 0) ? extracted.email[0] : (fallback.email || '');
      const allTags = [...new Set([...tags, ...(fallback.tags || [])])];

      this.results.push({
        id,
        name,
        url,
        scrapedAt: new Date().toISOString(),
        phone: (phone.length > 0 ? phone[0] : (fallback.phone || '')),
        phoneAll: phone,
        address: (address.length > 0 ? address[0] : (fallback.address || '')),
        addressAll: address,
        hours,
        email,
        website,
        description,
        latitude: fallback.latitude || null,
        longitude: fallback.longitude || null,
        tags: allTags,
        services: activities.services,
        dynamicActivities: activities.dynamicActivities,
        category,
        dataSource: dataSource,
        scrapeSuccess: true,
        sourceType: dataSource === 'local-archive' ? 'local-html' : 'live',
        selectorsMatched: Object.fromEntries(
          Object.entries(selectors).map(([k, v]) => [k, (extracted[k] && extracted[k].length > 0)])
        ),
        activityMatchCount: activities.dynamicActivities.length
      });
      console.log(`[Scraper] Completed: ${name} [${dataSource}] — ${activities.services.length} services, ${allTags.length} tags, category: ${category}`);
    } catch (err) {
      console.error(`[Scraper] Parse error for ${name}: ${err.message}`);
      this.errors.push({ id, name, url, error: err.message });
      this.results.push({
        id, name, url,
        scrapedAt: new Date().toISOString(),
        phone: fallback.phone || '',
        phoneAll: [fallback.phone || ''],
        address: fallback.address || '',
        addressAll: [fallback.address || ''],
        hours: fallback.hours || {},
        email: fallback.email || '',
        website: url,
        description: '',
        latitude: fallback.latitude || null,
        longitude: fallback.longitude || null,
        tags: fallback.tags || [],
        services: fallback.services || [],
        dynamicActivities: [],
        activityMatchCount: 0,
        category: fallback.category || 'General',
        dataSource: dataSource,
        scrapeSuccess: false,
        error: err.message
      });
    }
  }

  detectCategory(html, services) {
    const $ = cheerio.load(html);
    const bodyText = $('body').text().toLowerCase();

    const categoryMap = {
      'Emergency Shelter': ['emergency', 'shelter', 'homelessness', 'accommodation', 'refugee', 'asylum'],
      'Addiction Support': ['addiction', 'recovery', 'harm-reduction', 'gambling', 'substance'],
      'Housing Support': ['housing', 'homelessness', 'rent', 'eviction', 'accommodation'],
      'Crisis Support': ['crisis', 'suicide-prevention', 'mental-health', 'helpline', 'hotline', 'crisis-support'],
      'Community Support': ['community', 'elderly', 'social', 'isolation', 'carers', 'vulnerable'],
      'Food Support': ['food', 'meal', 'nutrition', 'food-bank', 'pantry'],
      'Legal Support': ['legal', 'advice', 'debt', 'justice', 'rights'],
      'Education Support': ['education', 'training', 'employment', 'skills', 'learning'],
      'Health Support': ['medical', 'health', 'therapy', 'counselling', 'disability', 'mental-health'],
      'Family Support': ['family', 'children', 'parenting', 'childcare', 'youth', 'women']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      for (const kw of keywords) {
        if (bodyText.includes(kw)) {
          return category;
        }
      }
    }

    // Check if services array contains category-indicative keywords
    const svcText = services.join(' ').toLowerCase();
    for (const [category, keywords] of Object.entries(categoryMap)) {
      for (const kw of keywords) {
        if (svcText.includes(kw)) {
          return category;
        }
      }
    }

    return null;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    await this.init();
    console.log(`[Scraper] Starting scrape of ${this.queue.length} targets`);

    for (const target of this.queue) {
      await this.scrapeTarget(target);
      await this.sleep(200);
    }

    const output = {
      version: this.config.version,
      generatedAt: new Date().toISOString(),
      totalTargets: this.queue.length,
      successful: this.results.filter(r => r.scrapeSuccess).length,
      failed: this.errors.length,
      results: this.results,
      errors: this.errors
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n[Scraper] Complete: ${output.successful}/${output.totalTargets} successful`);
    console.log(`[Scraper] Output written to ${OUTPUT_PATH}`);
    return output;
  }
}

async function main() {
  const scraper = new DublinLifelineScraper();
  const result = await scraper.run();
  process.exit(0);
}

main().catch(err => {
  console.error('[Scraper] Fatal error:', err);
  process.exit(1);
});

module.exports = { DublinLifelineScraper, ACTIVITY_TAXONOMY, ACTIVITY_SELECTORS };