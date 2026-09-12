#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(__dirname, '..', 'data', 'services.json');
const SCRAPED_PATH = path.join(__dirname, '..', 'data', 'scraped_output.json');
const REPORT_PATH = path.join(__dirname, '..', 'data', 'merge_report.json');

class DataMerger {
  constructor() {
    this.baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
    this.scraped = JSON.parse(fs.readFileSync(SCRAPED_PATH, 'utf-8'));
    this.differences = [];
    this.additions = [];
    this.updates = [];
    this.deletions = [];
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

  normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-\(\)\.]/g, '').trim();
  }

  normalizeAddress(addr) {
    if (!addr) return '';
    return addr.trim().replace(/\s+/g, ' ');
  }

  compareServices(baselineService, scrapedService) {
    const diffs = [];

    const baselinePhone = this.normalizePhone(baselineService.phone);
    const scrapedPhone = this.normalizePhone(scrapedService.phone);
    if (baselinePhone !== scrapedPhone && scrapedPhone && scrapedPhone !== '') {
      diffs.push({ field: 'phone', baseline: baselineService.phone, scraped: scrapedService.phone });
    }

    const baselineAddr = this.normalizeAddress(baselineService.address);
    const scrapedAddr = this.normalizeAddress(scrapedService.address);
    if (baselineAddr !== scrapedAddr && scrapedAddr && scrapedAddr !== '') {
      diffs.push({ field: 'address', baseline: baselineService.address, scraped: scrapedService.address });
    }

    const baselineHours = this.normalizeHours(baselineService.hours);
    const scrapedHours = this.normalizeHours(scrapedService.hours);
    const allDayKeys = new Set([...Object.keys(baselineHours), ...Object.keys(scrapedHours)]);
    for (const day of allDayKeys) {
      const bHours = baselineHours[day] || 'N/A';
      const sHours = scrapedHours[day] || 'N/A';
      if (bHours !== sHours && sHours !== 'N/A') {
        diffs.push({ field: `hours_${day}`, baseline: bHours, scraped: sHours });
      }
    }

    const bTags = JSON.stringify(baselineService.tags || []);
    const sTags = JSON.stringify(scrapedService.tags || []);
    if (bTags !== sTags) {
      diffs.push({ field: 'tags', baseline: baselineService.tags, scraped: scrapedService.tags });
    }

    const bServices = JSON.stringify(baselineService.services || []);
    const sServices = JSON.stringify(scrapedService.services || []);
    if (bServices !== sServices) {
      diffs.push({ field: 'services', baseline: baselineService.services, scraped: scrapedService.services });
    }

    const bCategory = baselineService.category || '';
    const sCategory = scrapedService.category || '';
    if (bCategory !== sCategory && sCategory) {
      diffs.push({ field: 'category', baseline: bCategory, scraped: sCategory });
    }

    const bLat = baselineService.latitude;
    const sLat = scrapedService.latitude;
    if (bLat !== sLat && sLat !== null && sLat !== undefined) {
      diffs.push({ field: 'latitude', baseline: bLat, scraped: sLat });
    }

    const bLng = baselineService.longitude;
    const sLng = scrapedService.longitude;
    if (bLng !== sLng && sLng !== null && sLng !== undefined) {
      diffs.push({ field: 'longitude', baseline: bLng, scraped: sLng });
    }

    const bActivities = JSON.stringify(baselineService.dynamicActivities || []);
    const sActivities = JSON.stringify(scrapedService.dynamicActivities || []);
    if (bActivities !== sActivities) {
      diffs.push({ field: 'dynamicActivities', baseline: baselineService.dynamicActivities || [], scraped: scrapedService.dynamicActivities || [] });
    }

    const bActivityCount = baselineService.activityMatchCount || 0;
    const sActivityCount = scrapedService.activityMatchCount || 0;
    if (sActivityCount > bActivityCount) {
      diffs.push({ field: 'activityMatchCount', baseline: bActivityCount, scraped: sActivityCount });
    }

    return diffs;
  }

  diff() {
    const baselineMap = new Map(this.baseline.services.map(s => [s.id, s]));
    const scrapedMap = new Map(this.scraped.results.map(s => [s.id, s]));

    const baselineIds = new Set(baselineMap.keys());
    const scrapedIds = new Set(scrapedMap.keys());

    for (const id of baselineIds) {
      if (!scrapedIds.has(id)) {
        this.deletions.push(id);
        this.differences.push({ type: 'deleted', id, service: baselineMap.get(id) });
      }
    }

    for (const id of scrapedIds) {
      const scraped = scrapedMap.get(id);
      if (!baselineIds.has(id)) {
        this.additions.push(id);
        this.differences.push({ type: 'added', id, service: scraped });
      } else {
        const baseline = baselineMap.get(id);
        const diffs = this.compareServices(baseline, scraped);
        if (diffs.length > 0) {
          this.updates.push({ id, diffs });
          this.differences.push({ type: 'updated', id, service: scraped, changes: diffs });
        }
      }
    }

    return {
      additions: this.additions.length,
      updates: this.updates.length,
      deletions: this.deletions.length,
      differences: this.differences.length
    };
  }

  merge() {
    const baselineMap = new Map(this.baseline.services.map(s => [s.id, s]));
    const scrapedMap = new Map(this.scraped.results.map(s => [s.id, s]));

    for (const [id, scraped] of scrapedMap) {
      if (!baselineMap.has(id)) {
        baselineMap.set(id, this.toServiceEntry(scraped));
      } else {
        const existing = baselineMap.get(id);
        const updated = this.toServiceEntry(scraped);
        const merged = { ...existing };
        merged.id = id;
        merged.name = existing.name || updated.name;
        merged.address = existing.address || updated.address;
        merged.phone = existing.phone || updated.phone;
        merged.email = existing.email || updated.email;
        merged.website = existing.website || updated.website;
        merged.hours = { ...existing.hours, ...updated.hours };
        merged.tags = [...new Set([...(existing.tags || []), ...(updated.tags || [])])];
        merged.services = [...new Set([...(existing.services || []), ...(updated.services || [])])];
        merged.category = existing.category || updated.category;
        merged.latitude = existing.latitude !== null && existing.latitude !== undefined ? existing.latitude : (updated.latitude || null);
        merged.longitude = existing.longitude !== null && existing.longitude !== undefined ? existing.longitude : (updated.longitude || null);
        merged.dynamicActivities = updated.dynamicActivities || [];
        merged.activityMatchCount = updated.activityMatchCount || 0;
        merged.dataSource = 'scraped';
        merged.lastScraped = scraped.scrapedAt;
        merged.description = existing.description || updated.description;
        merged.lastVerified = existing.lastVerified || new Date().toISOString().split('T')[0];
        baselineMap.set(id, merged);
      }
    }

    for (const id of this.deletions) {
      baselineMap.delete(id);
    }

    return Array.from(baselineMap.values());
  }

  toServiceEntry(scraped) {
    return {
      id: scraped.id,
      name: scraped.name,
      address: scraped.address,
      phone: scraped.phone,
      email: scraped.email || '',
      website: scraped.website,
      hours: scraped.hours || {},
      tags: scraped.tags || [],
      services: scraped.services || [],
      dynamicActivities: scraped.dynamicActivities || [],
      activityMatchCount: scraped.activityMatchCount || 0,
      category: scraped.category || 'General',
      latitude: scraped.latitude || null,
      longitude: scraped.longitude || null,
      dataSource: scraped.dataSource || 'scraped',
      scrapeSuccess: scraped.scrapeSuccess !== false,
      lastScraped: scraped.scrapedAt
    };
  }

  generateReport(mergeStats) {
    const report = {
      generatedAt: new Date().toISOString(),
      pipeline: 'Dublin Lifeline Data Merge',
      baselineVersion: this.baseline.version,
      scrapedVersion: this.scraped.version,
      mergeStats,
      differences: mergeStats.differences,
      summary: {
        totalBaseline: this.baseline.services.length,
        totalScraped: this.scraped.results.length,
        additions: mergeStats.additions,
        updates: mergeStats.updates,
        deletions: mergeStats.deletions,
        unchanged: this.baseline.services.length - mergeStats.updates - mergeStats.deletions
      },
      changes: {
        additions: this.additions.map(id => ({ id, service: this.scraped.results.find(r => r.id === id)?.name })),
        updates: this.updates.map(u => ({ id: u.id, changes: u.diffs })),
        deletions: this.deletions
      },
      finalServices: this.merge(),
      notes: []
    };

    if (mergeStats.deletions > 0) {
      report.notes.push(`WARNING: ${mergeStats.deletions} service(s) removed from baseline`);
    }
    if (mergeStats.updates > 0) {
      report.notes.push(`INFO: ${mergeStats.updates} service(s) updated with new data`);
    }
    if (mergeStats.additions > 0) {
      report.notes.push(`INFO: ${mergeStats.additions} new service(s) added to baseline`);
    }
    if (mergeStats.differences === 0) {
      report.notes.push('No changes detected. Baseline data is current.');
    }

    return report;
  }

  saveReport(report) {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[Merge] Merge report saved to ${REPORT_PATH}`);
  }

  saveFinal(report) {
    const finalData = {
      version: '3.0.0',
      lastUpdated: new Date().toISOString(),
      generatedBy: 'Dublin Lifeline Pipeline',
      services: report.finalServices,
      metadata: {
        source: 'Dublin Lifeline Pipeline (merged)',
        totalServices: report.finalServices.length,
        categories: [...new Set(report.finalServices.map(s => s.category).filter(Boolean))],
        coverage: 'Dublin City Centre',
        nextSync: this.baseline.metadata?.nextSync || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        pipelineRun: new Date().toISOString(),
        differencesDetected: report.mergeStats.differences,
        additions: report.mergeStats.additions,
        updates: report.mergeStats.updates,
        deletions: report.mergeStats.deletions
      }
    };

    fs.writeFileSync(BASELINE_PATH, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`[Merge] Final dataset saved to ${BASELINE_PATH}`);
    return finalData;
  }

  async run() {
    console.log('[Merge] Starting Dublin Lifeline Data Merge');
    console.log(`[Merge] Baseline: ${this.baseline.services.length} services`);
    console.log(`[Merge] Scraped: ${this.scraped.results.length} results`);

    const mergeStats = this.diff();
    console.log(`\n[Merge] Differences: ${mergeStats.additions} added, ${mergeStats.updates} updated, ${mergeStats.deletions} deleted`);

    const report = this.generateReport(mergeStats);
    this.saveReport(report);
    console.log(`[Merge] Merge report saved to ${REPORT_PATH}`);

    const finalData = this.saveFinal(report);
    console.log(`[Merge] Pipeline complete. ${finalData.metadata.totalServices} services in final dataset.`);

    if (report.differences > 0) {
      console.log('\n[Merge] Changes detected:');
      report.changes.additions.forEach(a => console.log(`  + ADDED: ${a.id} (${a.service})`));
      report.changes.updates.forEach(u => console.log(`  ~ UPDATED: ${u.id} (${u.changes.length} changes)`));
      report.changes.deletions.forEach(d => console.log(`  - DELETED: ${d}`));
    }

    return report;
  }
}

async function main() {
  if (!fs.existsSync(SCRAPED_PATH)) {
    console.error('[Merge] Scraped output not found at', SCRAPED_PATH);
    console.error('[Merge] Run scraper.js first to generate scraped_output.json');
    process.exit(1);
  }

  const merger = new DataMerger();
  await merger.run();
  process.exit(0);
}

main().catch(err => {
  console.error('[Merge] Fatal error:', err);
  process.exit(1);
});

export { DataMerger };
