import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStatusTone,
  getStatusBadgeProps,
  getStatusDotColor,
  getStatusPillClass,
  getStatusGridPillClass,
} from '../statusBadge.js';

describe('statusBadge — ETGO_CI (Closed - Invoice Created) classification', () => {
  describe('getStatusTone', () => {
    it('classifies ETGO_CI as success', () => {
      assert.equal(getStatusTone('ETGO_CI'), 'success');
    });

    it('is case-insensitive for ETGO_CI', () => {
      assert.equal(getStatusTone('etgo_ci'), 'success');
    });
  });

  describe('getStatusBadgeProps', () => {
    it('renders ETGO_CI with the green completed style', () => {
      const props = getStatusBadgeProps('ETGO_CI');
      assert.equal(props.variant, 'default');
      assert.match(props.className, /bg-emerald-600/);
    });
  });

  describe('getStatusDotColor', () => {
    it('paints ETGO_CI dot emerald', () => {
      assert.equal(getStatusDotColor('ETGO_CI'), 'bg-emerald-500');
    });
  });

  describe('getStatusPillClass', () => {
    it('paints ETGO_CI pill emerald', () => {
      assert.equal(getStatusPillClass('ETGO_CI'), 'bg-emerald-50 text-emerald-800');
    });
  });

  describe('getStatusGridPillClass', () => {
    it('paints ETGO_CI grid pill emerald', () => {
      assert.equal(getStatusGridPillClass('ETGO_CI'), 'bg-emerald-500 text-white');
    });
  });
});

describe('statusBadge — CA (Closed - Order Created) recoloured to success', () => {
  it('getStatusTone returns success for CA (regression: was destructive)', () => {
    assert.equal(getStatusTone('CA'), 'success');
  });

  it('getStatusTone returns success for lowercase ca', () => {
    assert.equal(getStatusTone('ca'), 'success');
  });

  it('getStatusBadgeProps renders CA with the green completed style', () => {
    const props = getStatusBadgeProps('CA');
    assert.equal(props.variant, 'default');
    assert.match(props.className, /bg-emerald-600/);
    assert.notEqual(props.variant, 'destructive');
  });

  it('getStatusDotColor paints CA dot emerald (regression: was red)', () => {
    assert.equal(getStatusDotColor('CA'), 'bg-emerald-500');
  });

  it('getStatusPillClass paints CA pill emerald (regression: was red)', () => {
    assert.equal(getStatusPillClass('CA'), 'bg-emerald-50 text-emerald-800');
  });

  it('getStatusGridPillClass paints CA grid pill emerald (regression: was red)', () => {
    assert.equal(getStatusGridPillClass('CA'), 'bg-emerald-500 text-white');
  });
});

describe('statusBadge — destructive tones still apply only to truly cancelled states', () => {
  it('VO is destructive', () => {
    assert.equal(getStatusTone('VO'), 'destructive');
    assert.equal(getStatusBadgeProps('VO').variant, 'destructive');
    assert.equal(getStatusDotColor('VO'), 'bg-red-500');
  });

  it('RPVOID is destructive', () => {
    assert.equal(getStatusTone('RPVOID'), 'destructive');
  });

  it('cancelled / void synonyms are destructive', () => {
    assert.equal(getStatusTone('voided'), 'destructive');
    assert.equal(getStatusTone('cancelled'), 'destructive');
    assert.equal(getStatusTone('void'), 'destructive');
  });
});

describe('statusBadge — CJ (Closed - Rejected) is destructive', () => {
  it('getStatusTone returns destructive for CJ', () => {
    assert.equal(getStatusTone('CJ'), 'destructive');
    assert.equal(getStatusTone('cj'), 'destructive');
  });

  it('getStatusBadgeProps renders CJ with the destructive variant', () => {
    assert.equal(getStatusBadgeProps('CJ').variant, 'destructive');
  });

  it('getStatusDotColor paints CJ dot red', () => {
    assert.equal(getStatusDotColor('CJ'), 'bg-red-500');
  });

  it('getStatusPillClass paints CJ pill red', () => {
    assert.equal(getStatusPillClass('CJ'), 'bg-red-50 text-red-800');
  });

  it('getStatusGridPillClass paints CJ grid pill red', () => {
    assert.equal(getStatusGridPillClass('CJ'), 'bg-red-500 text-white');
  });
});

describe('statusBadge — non-regression on previously success/closed/draft states', () => {
  it('CO stays success', () => {
    assert.equal(getStatusTone('CO'), 'success');
  });

  it('PA stays success in tone but blue in palette', () => {
    assert.equal(getStatusTone('PA'), 'success');
    assert.match(getStatusBadgeProps('PA').className, /bg-blue-600/);
  });

  it('CL stays in the closed/blue palette', () => {
    const props = getStatusBadgeProps('CL');
    assert.match(props.className, /bg-blue-600/);
    assert.equal(getStatusDotColor('CL'), 'bg-blue-500');
  });

  it('DR stays in the draft/secondary palette', () => {
    assert.equal(getStatusBadgeProps('DR').variant, 'secondary');
    assert.equal(getStatusDotColor('DR'), 'bg-gray-400');
  });
});
