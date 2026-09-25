import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  USAGE_DESTINATIONS,
  USAGE_EVENTS,
  buildUsageCatalog,
  defineUsageEvent,
} from '../usage/usageEvents.js';

describe('usage event catalog', () => {
  it('starts empty (no UI event agreed yet)', () => {
    assert.deepEqual(Object.keys(USAGE_EVENTS), []);
    assert.equal(buildUsageCatalog().size, 0);
  });

  it('builds a catalog keyed by event name', () => {
    const entry = defineUsageEvent('ui.test.click', { destinations: [USAGE_DESTINATIONS.TABLE] });
    const catalog = buildUsageCatalog([entry]);
    assert.equal(catalog.get('ui.test.click'), entry);
  });
});

describe('defineUsageEvent', () => {
  it('returns a frozen entry with its destinations', () => {
    const entry = defineUsageEvent('ui.test', { destinations: ['table', 'mixpanel'] });
    assert.equal(entry.name, 'ui.test');
    assert.deepEqual(entry.destinations, ['table', 'mixpanel']);
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.destinations));
  });

  it('de-duplicates destinations', () => {
    const entry = defineUsageEvent('ui.test', { destinations: ['table', 'table', 'mixpanel'] });
    assert.deepEqual(entry.destinations, ['table', 'mixpanel']);
  });

  for (const bad of ['UI.Upper', 'x', '1starts.digit', 'has-dash', 'has space', `a${'b'.repeat(60)}`, '']) {
    it(`throws on invalid name ${JSON.stringify(bad)}`, () => {
      assert.throws(() => defineUsageEvent(bad, { destinations: ['table'] }), /Invalid usage event type/);
    });
  }

  it('accepts a 60-char name (upper bound)', () => {
    const name = `a${'b'.repeat(59)}`;
    assert.equal(defineUsageEvent(name, { destinations: ['table'] }).name, name);
  });

  it('throws on empty destinations', () => {
    assert.throws(() => defineUsageEvent('ui.test', { destinations: [] }), /needs destinations/);
    assert.throws(() => defineUsageEvent('ui.test'), /needs destinations/);
  });

  it('throws on an unknown destination', () => {
    assert.throws(() => defineUsageEvent('ui.test', { destinations: ['table', 'segment'] }), /needs destinations/);
  });
});
