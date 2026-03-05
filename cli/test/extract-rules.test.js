import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  analyzeJavaSource,
  translateExpression,
  isSimpleValidation,
  buildRuleFromCallout,
} from '../src/extract-rules.js';

// --- analyzeJavaSource ---

describe('analyzeJavaSource', () => {
  it('detects setValue effects from addResult pattern', () => {
    const source = `
      public void execute() {
        if (total > 0) {
          addResult("grandTotal", calculateTotal());
          addResult("netAmount", net);
        }
      }
    `;
    const result = analyzeJavaSource(source);
    assert.equal(result.effects.length, 2);
    assert.equal(result.effects[0].field, 'grandTotal');
    assert.equal(result.effects[0].action, 'setValue');
    assert.equal(result.effects[0].confidence, 'high');
    assert.equal(result.effects[1].field, 'netAmount');
    assert.equal(result.confidence, 'high');
  });

  it('detects DML usage with OBDal.getInstance()', () => {
    const source = `
      public void process() {
        OBDal.getInstance().save(order);
      }
    `;
    const result = analyzeJavaSource(source);
    assert.equal(result.hasDml, true);
  });

  it('counts branches (if, switch, ternary)', () => {
    const source = `
      public void run() {
        if (a > 0) {
          doA();
        }
        if (b > 0) {
          doB();
        }
        switch (status) {
          case "A": break;
        }
        String val = x > 0 ? "yes" : "no";
      }
    `;
    const result = analyzeJavaSource(source);
    // 2 ifs + 1 switch + 1 ternary = 4
    assert.equal(result.branches, 4);
  });

  it('handles null source gracefully with low confidence', () => {
    const result = analyzeJavaSource(null);
    assert.deepEqual(result.effects, []);
    assert.equal(result.confidence, 'low');
    assert.equal(result.warning, 'Source not found');
  });

  it('handles undefined source gracefully with low confidence', () => {
    const result = analyzeJavaSource(undefined);
    assert.deepEqual(result.effects, []);
    assert.equal(result.confidence, 'low');
    assert.equal(result.warning, 'Source not found');
  });

  it('counts LOC correctly (excludes blanks and comments)', () => {
    const source = `package com.example;

// This is a comment
import java.util.*;

/* Block comment */

public class MyClass {
  public void run() {
    doSomething();
  }
}
`;
    const result = analyzeJavaSource(source);
    // Lines: package, import, public class, public void, doSomething(), }, } = 7
    assert.equal(result.loc, 7);
  });
});

// --- translateExpression ---

describe('translateExpression', () => {
  it('translates @DocumentStatus@ to documentStatus', () => {
    const result = translateExpression("@DocumentStatus@='DR'");
    assert.equal(result.success, true);
    assert.ok(result.result.includes('documentStatus'));
  });

  it('translates @IsSalesTransaction@=\'Y\' to include true', () => {
    const result = translateExpression("@IsSalesTransaction@='Y'");
    assert.equal(result.success, true);
    assert.ok(result.result.includes('true'));
  });

  it('rejects OB.Utilities framework calls', () => {
    const result = translateExpression('OB.Utilities.checkValue()');
    assert.equal(result.success, false);
    assert.ok(result.error);
  });

  it('replaces | with || and & with &&', () => {
    const result = translateExpression("@A@='Y' | @B@='N'");
    assert.equal(result.success, true);
    assert.ok(result.result.includes('||'));
    assert.ok(result.result.includes('false'));
  });

  it('replaces single = with == but preserves !=, <=, >=', () => {
    const result = translateExpression("@Status@='DR' & @Qty@!=0 & @Amt@>=100 & @Discount@<=50");
    assert.equal(result.success, true);
    // Single = should become ==
    assert.ok(result.result.includes("=='DR'"));
    // != should be preserved
    assert.ok(result.result.includes('!='));
    // >= should be preserved
    assert.ok(result.result.includes('>='));
    // <= should be preserved
    assert.ok(result.result.includes('<='));
  });
});

// --- isSimpleValidation ---

describe('isSimpleValidation', () => {
  it('returns true for simple WHERE clause', () => {
    const sql = "SELECT Name FROM C_BPartner WHERE IsActive='Y' AND AD_Client_ID=@AD_Client_ID@";
    assert.equal(isSimpleValidation(sql), true);
  });

  it('returns false for complex query with multiple JOINs and EXISTS', () => {
    const sql = `
      SELECT p.Name FROM C_BPartner p
      JOIN C_BPartner_Location bpl ON p.C_BPartner_ID = bpl.C_BPartner_ID
      JOIN C_Location l ON bpl.C_Location_ID = l.C_Location_ID
      WHERE EXISTS (SELECT 1 FROM C_Order o WHERE o.C_BPartner_ID = p.C_BPartner_ID)
    `;
    assert.equal(isSimpleValidation(sql), false);
  });

  it('returns true for null/empty SQL', () => {
    assert.equal(isSimpleValidation(null), true);
    assert.equal(isSimpleValidation(''), true);
  });

  it('returns false for UNION queries', () => {
    const sql = "SELECT Name FROM C_BPartner UNION SELECT Name FROM C_BPartner_Location";
    assert.equal(isSimpleValidation(sql), false);
  });
});

// --- buildRuleFromCallout ---

describe('buildRuleFromCallout', () => {
  it('builds a rule with effects from source analysis', () => {
    const row = {
      ad_callout_id: '100',
      name: 'SL_Order_Amt',
      classname: 'com.example.OrderAmtCallout',
      columnname: 'QtyOrdered',
    };
    const sourceAnalysis = {
      effects: [{ field: 'grandTotal', action: 'setValue', confidence: 'high' }],
      confidence: 'high',
      branches: 3,
      loc: 45,
      hasDml: false,
    };

    const rule = buildRuleFromCallout(row, sourceAnalysis);

    assert.equal(rule.type, 'callout');
    assert.equal(rule.source, 'AD_Callout');
    assert.equal(rule.id, '100');
    assert.equal(rule.name, 'SL_Order_Amt');
    assert.equal(rule.className, 'com.example.OrderAmtCallout');
    assert.equal(rule.triggerColumn, 'QtyOrdered');
    assert.equal(rule.effects.length, 1);
    assert.equal(rule.effects[0].field, 'grandTotal');
    assert.equal(rule.complexity, 'medium');
    assert.equal(rule.confidence, 'high');
    assert.equal(rule.branches, 3);
    assert.equal(rule.loc, 45);
  });

  it('builds a rule with unknown complexity when source not found', () => {
    const row = {
      ad_callout_id: '200',
      name: 'SL_Missing',
      classname: 'com.example.Missing',
      columnname: 'Amount',
    };
    const sourceAnalysis = {
      effects: [],
      confidence: 'low',
      warning: 'Source not found',
    };

    const rule = buildRuleFromCallout(row, sourceAnalysis);

    assert.equal(rule.complexity, 'unknown');
    assert.equal(rule.warning, 'Source not found');
    assert.deepEqual(rule.effects, []);
  });

  it('marks high complexity for DML usage', () => {
    const row = {
      ad_callout_id: '300',
      name: 'SL_DML',
      classname: 'com.example.DmlCallout',
      columnname: 'Status',
    };
    const sourceAnalysis = {
      effects: [],
      confidence: 'medium',
      branches: 1,
      loc: 20,
      hasDml: true,
    };

    const rule = buildRuleFromCallout(row, sourceAnalysis);

    assert.equal(rule.complexity, 'high');
    assert.equal(rule.hasDml, true);
  });
});
