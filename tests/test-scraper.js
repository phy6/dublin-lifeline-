import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Scraper', () => {
  it('config file exists and has targets', () => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'sources.json'), 'utf-8'));
    assert.ok(Array.isArray(config.targets));
    assert.ok(config.targets.length >= 7);
    for (const t of config.targets) {
      assert.ok(t.id, `target missing id: ${t.name}`);
      assert.ok(t.url.startsWith('https://'), `target URL not https: ${t.id}`);
      assert.ok(t.fallback, `target missing fallback: ${t.id}`);
      assert.ok(t.fallback.phone, `fallback missing phone: ${t.id}`);
      assert.ok(t.fallback.address, `fallback missing address: ${t.id}`);
    }
  });

  it('services.json is valid and has required fields', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'services.json'), 'utf-8'));
    assert.ok(data.version);
    assert.ok(Array.isArray(data.services));
    assert.ok(data.services.length >= 7);
    for (const s of data.services) {
      assert.ok(s.id, `service missing id`);
      assert.ok(s.name, `service ${s.id} missing name`);
      assert.ok(s.phone, `service ${s.id} missing phone`);
      assert.ok(s.address, `service ${s.id} missing address`);
      assert.ok(s.category, `service ${s.id} missing category`);
    }
  });

  it('all phone numbers are in international or valid format', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'services.json'), 'utf-8'));
    for (const s of data.services) {
      assert.match(s.phone, /^(\+353|01|08)/, `phone format invalid for ${s.id}: ${s.phone}`);
    }
  });

  it('all providers have lat/lng near Dublin', () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'services.json'), 'utf-8'));
    for (const s of data.services) {
      assert.ok(typeof s.latitude === 'number', `${s.id} missing latitude`);
      assert.ok(typeof s.longitude === 'number', `${s.id} missing longitude`);
      assert.ok(s.latitude > 53.2 && s.latitude < 53.5, `${s.id} latitude out of Dublin range: ${s.latitude}`);
      assert.ok(s.longitude > -6.4 && s.longitude < -6.1, `${s.id} longitude out of Dublin range: ${s.longitude}`);
    }
  });

  it('scraped_output.json has correct structure', () => {
    const scraped = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'scraped_output.json'), 'utf-8'));
    assert.ok(scraped.version);
    assert.ok(Array.isArray(scraped.results));
    assert.ok(typeof scraped.successful === 'number');
    assert.ok(typeof scraped.failed === 'number');
    assert.equal(scraped.successful + scraped.failed, scraped.totalTargets);
  });

  it('normalizeHours handles string and object inputs', async () => {
    const { DataMerger } = await import('../scripts/mergeData.js');
    const m = Object.create(DataMerger.prototype);
    assert.deepEqual(m.normalizeHours('09:00-17:00'), { 'mon-fri': '09:00-17:00' });
    assert.deepEqual(m.normalizeHours({ 'mon-fri': '09:00-17:00' }), { 'mon-fri': '09:00-17:00' });
    assert.deepEqual(m.normalizeHours(null), {});
    assert.deepEqual(m.normalizeHours(undefined), {});
  });

  it('normalizePhone strips separators', async () => {
    const { DataMerger } = await import('../scripts/mergeData.js');
    const m = Object.create(DataMerger.prototype);
    assert.equal(m.normalizePhone('+353-1-878-0404'), '+35318780404');
    assert.equal(m.normalizePhone('01 524 0160'), '015240160');
    assert.equal(m.normalizePhone('(01) 123-4567'), '011234567');
    assert.equal(m.normalizePhone(''), '');
  });
});
