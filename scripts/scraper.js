#!/usr/bin/env node

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'sources.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'scraped_output.json');
const CANDIDATES_PATH = path.join(__dirname, '..', 'data', 'candidates.json');
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

const DISCOVERY_SELECTORS = [
  '.org-list a', '.directory-item a', '.listing-item a',
  '.org-listing a', '.charity-link', '.directory-listing a'
];

class DublinLifelineScraper {
  constructor() {
    this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    this.results = [];
    this.errors = [];
    this.discovered = [];
    this.rateLimit = this.config.rateLimit || { requestsPerMinute: 10, timeout: 15000, retryAttempts: 3, retryDelay: 2000 };
    this.queue = [];
    this.processed = 0;
    this.throttleInterval = 60000 / this.rateLimit.requestsPerMinute;
    this.lastRequestTime = 0;
  }

  async init() {
    console.log('[Scraper] Initializing Dublin Lifeline Scraper');
    console.log(`[Scraper] Loaded ${this.config.targets.length} target URLs`);
    console.log(`[Scraper] Activity taxonomy: ${ACTIVITY_TAXONOMY.length} keywords`);
    if (this.config.discovery && this.config.discovery.urls) {
      console.log(`[Scraper] Discovery sources: ${this.config.discovery.urls.length} directories`);
    }
    this.queue = [...this.config.targets];
  }

  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = this.throttleInterval - elapsed;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  findLocalArchive(id) {
    const candidates = [
      `${id}.html`, `${id}.htm`,
      `dublin_lifeline_${id}.html`, `${id}_source.html`,
      `${id}.source.html`, `source_${id}.html`,
      `${id}-source.html`, `${id}_archive.html`
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
    await this.throttle();
    const timeoutMs = this.rateLimit.timeout;
    return Promise.race([
      this._doFetch(url, redirectCount),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout fetching ${url}`)), timeoutMs))
    ]);
  }

  _doFetch(url, redirectCount) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error(`Timeout fetching ${url}`));
      }, this.rateLimit.timeout);

      const req = client.get(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0.0.0 DublinLifeline/3.0' },
        timeout: this.rateLimit.timeout
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
      });
      req.on('timeout', () => {
        controller.abort();
        reject(new Error(`Timeout fetching ${url}`));
      });
      req.on('error', reject);
      req.on('socket', (socket) => {
        socket.setTimeout(this.rateLimit.timeout);
        socket.on('timeout', () => {
          controller.abort();
          reject(new Error(`Socket timeout fetching ${url}`));
        });
      });
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

  normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-\(\)\.]/g, '').trim();
  }

  normalizeAddress(addr) {
    if (!addr) return '';
    return addr.trim().replace(/\s+/g, ' ');
  }

  normalizeHours(hours) {
    if (!hours) return {};
    if (typeof hours === 'string') {
      return { 'mon-fri': hours };
    }
    if (typeof hours === 'object') {
      return { ...hours };
    }
    return {};
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

    for (const keyword of ACTIVITY_TAXONOMY) {
      const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (regex.test(fullText)) {
        found.add(keyword);
      }
    }

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

    const dynamicActivities = Array.from(found);
    const allServices = [...new Set([...fallbackServices, ...dynamicActivities])];

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

    $('[itemprop="keywords"], .tags a, .tag').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text && tagPatterns.includes(text)) {
        found.add(text);
      }
    });

    return Array.from(found);
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

  async discoverProviders() {
    if (!this.config.discovery || !this.config.discovery.urls) {
      console.log('[Scraper] No discovery URLs configured');
      return [];
    }

    const discoveryUrls = this.config.discovery.urls;
    const discoverySelectors = this.config.discovery.selectors;
    const discovered = [];

    console.log('[Scraper] Starting provider discovery...');

    for (const dirUrl of discoveryUrls) {
      try {
        const html = await this.retry(() => this.fetch(dirUrl), 2, 1000);
        const $ = cheerio.load(html);
        const elements = $(discoverySelectors.name.join(', ')).first().closest('a, li, div, article');
        const seen = new Set();

        $(discoverySelectors.name.join(', ')).each((i, el) => {
          const name = $(el).text().trim();
          if (!name || seen.has(name)) return;
          const link = $(el).closest('a').attr('href') || $(el).find('a').attr('href') || '';
          const url = this.resolveUrl(dirUrl, link);
          if (!url || seen.has(url)) return;

          seen.add(name);
          discovered.push({
            name,
            url: url || dirUrl,
            source: dirUrl,
            discoveredAt: new Date().toISOString()
          });
        });

        console.log(`[Scraper] Discovery from ${dirUrl}: ${discovered.length} candidates so far`);
        await this.sleep(this.config.discovery.interval || 60000);
      } catch (err) {
        console.warn(`[Scraper] Discovery failed for ${dirUrl}: ${err.message}`);
      }
    }

    const maxResults = this.config.discovery.maxResults || 50;
    this.discovered = discovered.slice(0, maxResults);

    console.log(`[Scraper] Discovery complete: ${this.discovered.length} providers found`);
    return this.discovered;
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
        dataSource = 'fallback';
        this.errors.push({ id, name, url, error: err.message });
        this.results.push(this._buildFallbackResult(id, name, url, fallback, dataSource, err.message));
        return;
      }
    }

    try {
      const extracted = this.extractSelectors(html, selectors, url) || {};

      const phoneArr = (extracted.phone && extracted.phone.length > 0) ? extracted.phone : (fallback.phone ? [fallback.phone] : []);
      const addrArr = (extracted.address && extracted.address.length > 0) ? extracted.address : (fallback.address ? [fallback.address] : []);
      let hours;
      try {
        hours = (extracted.hours && extracted.hours.length > 0) ? this.normalizeHours(extracted.hours) : (fallback.hours || {});
      } catch (e) { hours = fallback.hours || {}; }

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

      let pageCategory = null;
      try { pageCategory = this.detectCategory(html, activities.services); } catch (e) {}
      const category = pageCategory || fallback.category || 'General';

      const website = (extracted.website && extracted.website.length > 0) ? extracted.website[0] : url;
      const email = (extracted.email && extracted.email.length > 0) ? extracted.email[0] : (fallback.email || '');
      const allTags = [...new Set([...tags, ...(fallback.tags || [])])];

      this.results.push({
        id,
        name,
        url,
        scrapedAt: new Date().toISOString(),
        phone: (phoneArr.length > 0 ? phoneArr[0] : (fallback.phone || '')),
        phoneAll: phoneArr,
        address: (addrArr.length > 0 ? addrArr[0] : (fallback.address || '')),
        addressAll: addrArr,
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
      this.results.push(this._buildFallbackResult(id, name, url, fallback, dataSource, err.message));
    }
  }

  _buildFallbackResult(id, name, url, fallback, dataSource, error) {
    return {
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
      error: error
    };
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
      errors: this.errors,
      discovered: this.discovered
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n[Scraper] Complete: ${output.successful}/${output.totalTargets} successful`);
    console.log(`[Scraper] Output written to ${OUTPUT_PATH}`);
    return output;
  }
}

export { DublinLifelineScraper, ACTIVITY_TAXONOMY, ACTIVITY_SELECTORS };

async function main() {
  const scraper = new DublinLifelineScraper();
  const result = await scraper.run();
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('[Scraper] Fatal error:', err);
    process.exit(1);
  });
}
