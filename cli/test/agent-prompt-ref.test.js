import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AGENT_PROMPT_REF_PREFIX,
  resolveAgentPromptValue,
  resolveAgentPromptRefs,
} from '../src/lib/agent-prompt-ref.js';

describe('agent-prompt-ref', () => {
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'sf-prompt-ref-'));
    mkdirSync(join(root, 'agent-prompts', 'contacts'), { recursive: true });
    writeFileSync(
      join(root, 'agent-prompts', 'contacts', 'spec.md'),
      '  Spec prompt text.\n',
      'utf8'
    );
    writeFileSync(join(root, 'agent-prompts', 'contacts', 'empty.md'), '   \n', 'utf8');
    writeFileSync(join(root, 'outside.md'), 'should never be reachable', 'utf8');
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('AGENT_PROMPT_REF_PREFIX', () => {
    it('is the #REF# sentinel', () => {
      assert.equal(AGENT_PROMPT_REF_PREFIX, '#REF#');
    });
  });

  describe('resolveAgentPromptValue', () => {
    it('returns literal (non-reference) strings unchanged', () => {
      assert.equal(resolveAgentPromptValue('plain literal', root), 'plain literal');
    });

    it('returns non-string values unchanged', () => {
      assert.equal(resolveAgentPromptValue(null, root), null);
      assert.equal(resolveAgentPromptValue(undefined, root), undefined);
      const obj = { a: 1 };
      assert.equal(resolveAgentPromptValue(obj, root), obj);
    });

    it('loads and trims the referenced file contents', () => {
      const out = resolveAgentPromptValue('#REF#agent-prompts/contacts/spec.md', root);
      assert.equal(out, 'Spec prompt text.');
    });

    it('tolerates whitespace between the sentinel and the path', () => {
      const out = resolveAgentPromptValue('#REF#  agent-prompts/contacts/spec.md', root);
      assert.equal(out, 'Spec prompt text.');
    });

    it('throws on an empty reference path', () => {
      assert.throws(() => resolveAgentPromptValue('#REF#', root), /empty path/);
    });

    it('throws on an absolute reference path', () => {
      assert.throws(
        () => resolveAgentPromptValue('#REF#/etc/passwd', root),
        /must be relative/
      );
    });

    it('throws when the path escapes the repo root', () => {
      assert.throws(
        () => resolveAgentPromptValue('#REF#../outside.md', root),
        /escapes the repo root/
      );
    });

    it('throws when the referenced file does not exist', () => {
      assert.throws(
        () => resolveAgentPromptValue('#REF#agent-prompts/contacts/missing.md', root),
        /Cannot read agentPrompt/
      );
    });

    it('throws when the referenced file is empty', () => {
      assert.throws(
        () => resolveAgentPromptValue('#REF#agent-prompts/contacts/empty.md', root),
        /is empty/
      );
    });
  });

  describe('resolveAgentPromptRefs', () => {
    it('resolves spec-level and field-level references in place', () => {
      const decisions = {
        window: { agentPrompt: '#REF#agent-prompts/contacts/spec.md' },
        entities: {
          bankAccount: {
            fields: {
              accountNo: { agentPrompt: '#REF#agent-prompts/contacts/spec.md' },
              iBAN: { agentPrompt: 'literal field prompt' },
              swiftCode: { visibility: 'editable' },
            },
          },
        },
      };
      const out = resolveAgentPromptRefs(decisions, root);
      assert.equal(out, decisions, 'returns the same object');
      assert.equal(decisions.window.agentPrompt, 'Spec prompt text.');
      assert.equal(
        decisions.entities.bankAccount.fields.accountNo.agentPrompt,
        'Spec prompt text.'
      );
      assert.equal(
        decisions.entities.bankAccount.fields.iBAN.agentPrompt,
        'literal field prompt'
      );
    });

    it('is a no-op when there are no agentPrompt values', () => {
      const decisions = { window: { name: 'X' }, entities: { a: { fields: { f: {} } } } };
      const clone = JSON.parse(JSON.stringify(decisions));
      resolveAgentPromptRefs(decisions, root);
      assert.deepEqual(decisions, clone);
    });

    it('tolerates missing window/entities/fields', () => {
      assert.doesNotThrow(() => resolveAgentPromptRefs({}, root));
      assert.doesNotThrow(() => resolveAgentPromptRefs(null, root));
      assert.doesNotThrow(() => resolveAgentPromptRefs({ entities: null }, root));
    });
  });
});
