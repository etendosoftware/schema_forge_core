import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  analyzeJavaSource,
  translateExpression,
  isSimpleValidation,
  buildRuleFromCallout,
} from '../src/extract-rules.js';

// ---------------------------------------------------------------------------
// analyzeJavaSource — additional cases
// ---------------------------------------------------------------------------

describe('analyzeJavaSource — additional cases', () => {
  it('detects setFieldValue effects', () => {
    const source = `
      public void execute() {
        setFieldValue("lineNetAmt", amount * qty);
      }
    `;
    const result = analyzeJavaSource(source);
    assert.equal(result.effects.length, 1);
    assert.equal(result.effects[0].field, 'lineNetAmt');
    assert.equal(result.effects[0].action, 'setValue');
  });

  it('returns medium confidence when no effects found', () => {
    const source = `
      public void execute() {
        log.info("no side effects");
      }
    `;
    const result = analyzeJavaSource(source);
    assert.equal(result.confidence, 'medium');
    assert.deepEqual(result.effects, []);
  });

  it('correctly counts LOC with multi-line block comments', () => {
    const source = `package com.example;
/*
 * This is
 * a multi-line
 * comment
 */
public class Foo {
  public void bar() {}
}`;
    const result = analyzeJavaSource(source);
    // package, public class, public void bar, } closing class = 4
    assert.equal(result.loc, 4);
  });

  it('does not count blank lines as LOC', () => {
    const source = `line1

line3

line5
`;
    const result = analyzeJavaSource(source);
    assert.equal(result.loc, 3);
  });

  it('detects PreparedStatement as DML', () => {
    const source = `
      PreparedStatement ps = conn.prepareStatement(sql);
      ps.executeUpdate();
    `;
    const result = analyzeJavaSource(source);
    assert.equal(result.hasDml, true);
  });

  it('does not flag DML when none present', () => {
    const source = `
      public String getName() {
        return "test";
      }
    `;
    const result = analyzeJavaSource(source);
    assert.equal(result.hasDml, false);
  });

  it('skips comment lines when counting branches', () => {
    const source = `
      // if (this is a comment)
      /* if (block comment) */
      public void run() {
        if (x > 0) doX();
      }
    `;
    const result = analyzeJavaSource(source);
    // Only 1 real if, the comment ones should be skipped
    assert.equal(result.branches, 1);
  });
});

// ---------------------------------------------------------------------------
// translateExpression — additional cases
// ---------------------------------------------------------------------------

describe('translateExpression — additional cases', () => {
  it('returns error for null input', () => {
    const result = translateExpression(null);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Empty expression');
  });

  it('returns error for empty string', () => {
    const result = translateExpression('');
    assert.equal(result.success, false);
  });

  it('returns error for whitespace-only string', () => {
    const result = translateExpression('   ');
    assert.equal(result.success, false);
  });

  it('translates @#Client_ID@ system variable', () => {
    const result = translateExpression("@#Client_ID@='100'");
    assert.equal(result.success, true);
    assert.ok(result.result.includes('client_ID'));
  });

  it('translates @$AcctSchema_ID@ accounting dimension', () => {
    const result = translateExpression("@$AcctSchema_ID@='200'");
    assert.equal(result.success, true);
    assert.ok(result.result.includes('acctSchema_ID'));
  });

  it('fixes !\' shorthand to !=\'', () => {
    const result = translateExpression("@DocStatus@!'CO'");
    assert.equal(result.success, true);
    assert.ok(result.result.includes("!='CO'"));
  });

  it('fixes !@ shorthand to !=@', () => {
    const result = translateExpression("@Posted@!@ShowAcct@");
    assert.equal(result.success, true);
    assert.ok(result.result.includes('!='));
  });

  it('handles compound expression with & and |', () => {
    const result = translateExpression("@A@='Y' & @B@='N' | @C@='Y'");
    assert.equal(result.success, true);
    assert.ok(result.result.includes('&&'));
    assert.ok(result.result.includes('||'));
  });

  it('preserves existing || and && operators', () => {
    const result = translateExpression("@A@='Y' || @B@='N' && @C@='Y'");
    assert.equal(result.success, true);
    // Should NOT produce |||| or &&&&
    assert.ok(!result.result.includes('||||'));
    assert.ok(!result.result.includes('&&&&'));
  });

  it('rejects expression containing function keyword', () => {
    const result = translateExpression('function () { return true; }');
    assert.equal(result.success, false);
  });

  it('rejects expression with checkRule call', () => {
    const result = translateExpression("checkRule('MyRule')");
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// isSimpleValidation — additional cases
// ---------------------------------------------------------------------------

describe('isSimpleValidation — additional cases', () => {
  it('returns true for whitespace-only SQL', () => {
    assert.equal(isSimpleValidation('   '), true);
  });

  it('returns false for EXISTS subquery', () => {
    const sql = "SELECT 1 WHERE EXISTS (SELECT 1 FROM C_Order WHERE IsActive='Y')";
    assert.equal(isSimpleValidation(sql), false);
  });

  it('returns true for single JOIN query', () => {
    const sql = "SELECT p.Name FROM C_BPartner p JOIN C_BPartner_Location bpl ON p.C_BPartner_ID = bpl.C_BPartner_ID";
    assert.equal(isSimpleValidation(sql), true);
  });

  it('returns false for query with UNION', () => {
    const sql = "SELECT Name FROM TableA UNION ALL SELECT Name FROM TableB";
    assert.equal(isSimpleValidation(sql), false);
  });
});

// ---------------------------------------------------------------------------
// buildRuleFromCallout — additional cases
// ---------------------------------------------------------------------------

describe('buildRuleFromCallout — additional cases', () => {
  it('sets high complexity when branches > 5', () => {
    const row = {
      ad_callout_id: '400',
      name: 'SL_Complex',
      classname: 'com.example.ComplexCallout',
      columnname: 'Amount',
    };
    const analysis = {
      effects: [{ field: 'total', action: 'setValue', confidence: 'high' }],
      confidence: 'high',
      branches: 8,
      loc: 100,
      hasDml: false,
    };
    const rule = buildRuleFromCallout(row, analysis);
    assert.equal(rule.complexity, 'high');
    assert.equal(rule.branches, 8);
  });

  it('sets low complexity when few branches and no DML', () => {
    const row = {
      ad_callout_id: '500',
      name: 'SL_Simple',
      classname: 'com.example.SimpleCallout',
      columnname: 'Name',
    };
    const analysis = {
      effects: [],
      confidence: 'medium',
      branches: 1,
      loc: 10,
      hasDml: false,
    };
    const rule = buildRuleFromCallout(row, analysis);
    assert.equal(rule.complexity, 'low');
  });

  it('does not include hasDml key when false', () => {
    const row = {
      ad_callout_id: '600',
      name: 'SL_NoDml',
      classname: 'com.example.NoDml',
      columnname: 'Qty',
    };
    const analysis = {
      effects: [],
      confidence: 'medium',
      branches: 0,
      loc: 5,
      hasDml: false,
    };
    const rule = buildRuleFromCallout(row, analysis);
    assert.equal(rule.hasDml, undefined);
  });

  it('includes hasDml key when true', () => {
    const row = {
      ad_callout_id: '700',
      name: 'SL_Dml',
      classname: 'com.example.DmlCallout',
      columnname: 'Status',
    };
    const analysis = {
      effects: [],
      confidence: 'medium',
      branches: 0,
      loc: 5,
      hasDml: true,
    };
    const rule = buildRuleFromCallout(row, analysis);
    assert.equal(rule.hasDml, true);
  });

  it('handles null sourceAnalysis', () => {
    const row = {
      ad_callout_id: '800',
      name: 'SL_Null',
      classname: 'com.example.NullAnalysis',
      columnname: 'Field',
    };
    const rule = buildRuleFromCallout(row, null);
    assert.equal(rule.complexity, 'unknown');
    assert.deepEqual(rule.effects, []);
    assert.equal(rule.confidence, 'low');
  });
});
