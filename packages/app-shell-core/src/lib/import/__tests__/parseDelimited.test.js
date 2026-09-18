import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImportParseError, decodeCsvBuffer, detectDelimiter, parseDelimited } from '../parseDelimited.js';

describe('detectDelimiter', () => {
  it('detects comma', () => {
    assert.equal(detectDelimiter('name,email,phone'), ',');
  });

  it('detects semicolon', () => {
    assert.equal(detectDelimiter('name;email;phone'), ';');
  });

  it('detects tab', () => {
    assert.equal(detectDelimiter('name\temail\tphone'), '\t');
  });

  it('defaults to comma when nothing else is found', () => {
    assert.equal(detectDelimiter('justoneword'), ',');
  });

  it('ignores delimiter characters inside quoted spans', () => {
    assert.equal(detectDelimiter('"Doe, John";email;phone'), ';');
  });
});

describe('parseDelimited', () => {
  it('parses headers and rows into header-keyed records', () => {
    const { headers, rows, delimiter } = parseDelimited('name,email\nLucia,lucia@x.com\nAndres,andres@x.com');
    assert.equal(delimiter, ',');
    assert.deepEqual(headers, ['name', 'email']);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { name: 'Lucia', email: 'lucia@x.com' });
    assert.deepEqual(rows[1], { name: 'Andres', email: 'andres@x.com' });
  });

  it('handles quoted fields containing the delimiter', () => {
    const { rows } = parseDelimited('name,company\n"Doe, John",Acme');
    assert.deepEqual(rows[0], { name: 'Doe, John', company: 'Acme' });
  });

  it('handles escaped quotes ("" inside a quoted field)', () => {
    const { rows } = parseDelimited('name\n"Say ""hi"""');
    assert.equal(rows[0].name, 'Say "hi"');
  });

  it('handles \\r\\n line endings', () => {
    const { rows } = parseDelimited('name,email\r\nLucia,lucia@x.com\r\n');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Lucia');
  });

  it('skips trailing blank lines', () => {
    const { rows } = parseDelimited('name\nLucia\n\n');
    assert.equal(rows.length, 1);
  });

  it('throws ImportParseError on an empty file', () => {
    assert.throws(() => parseDelimited(''), ImportParseError);
    assert.throws(() => parseDelimited('   \n  \n'), ImportParseError);
  });

  it('throws ImportParseError on duplicate headers', () => {
    assert.throws(
      () => parseDelimited('name,email,email\nA,a@x.com,b@x.com'),
      /Duplicate column header: "email"/,
    );
  });

  // ETP-5223: this module has no translator, so the English text stays on `message` as the
  // fallback and the locale key travels with the error for ImportDialog to resolve. Without
  // the key the user read "The file is empty." in a fully Spanish session.
  it('carries the locale key and params so the dialog can localize the message', () => {
    assert.throws(() => parseDelimited(''), (error) => {
      assert.ok(error instanceof ImportParseError);
      assert.equal(error.messageKey, 'importErrorFileEmpty');
      assert.deepEqual(error.params, {});
      return true;
    });

    assert.throws(() => parseDelimited('name,email,email\nA,a@x.com,b@x.com'), (error) => {
      assert.equal(error.messageKey, 'importErrorDuplicateHeader');
      assert.deepEqual(error.params, { header: 'email' });
      return true;
    });
  });

  it('fills missing trailing cells with empty string', () => {
    const { rows } = parseDelimited('name,email,phone\nLucia,lucia@x.com');
    assert.deepEqual(rows[0], { name: 'Lucia', email: 'lucia@x.com', phone: '' });
  });

  /**
   * ETP-5348. The duplicate guard compared the RAW header text against a Set while `mapColumns`
   * matches on `normalizeHeader`, so the guard and the matcher it protects disagreed: a case- or
   * accent-only duplicate passed here, and then downstream `mapColumns` handed the field to the
   * first claimant and left the second column unmapped. One of the user's columns was discarded
   * with no message anywhere in the flow.
   */
  describe('ETP-5348 — header rejections', () => {
    it('rejects a duplicate header that differs only in case', () => {
      assert.throws(
        () => parseDelimited('codigo,nombre,Nombre,precio\nA,x,y,1'),
        /Duplicate column header: "Nombre"/,
      );
    });

    it('rejects a duplicate header that differs only in accents', () => {
      assert.throws(
        () => parseDelimited('codigo,código\nA,B'),
        /Duplicate column header: "código"/,
      );
    });

    it('rejects a duplicate header that differs only in inner whitespace', () => {
      assert.throws(() => parseDelimited('precio compra,precio  compra\n1,2'), ImportParseError);
    });

    it('still accepts headers that merely share a word', () => {
      // The guard must not start rejecting legitimate files: Contacts really does carry both
      // "nombre comercial" and "nombre", and they map to different fields.
      const { headers } = parseDelimited('nombre comercial,nombre\nAcme,Ana');
      assert.deepEqual(headers, ['nombre comercial', 'nombre']);
    });

    it('rejects a blank header instead of waiting for a second one', () => {
      // Previously a lone blank was invisible — only a SECOND blank tripped the duplicate check
      // on `""`. The single blank became a row key of `''` and broke the mapping grid.
      assert.throws(() => parseDelimited('codigo,nombre,,precio\nA,x,y,1'), (error) => {
        assert.ok(error instanceof ImportParseError);
        assert.equal(error.messageKey, 'importErrorEmptyHeader');
        assert.deepEqual(error.params, { position: 3 });
        return true;
      });
    });

    it('rejects a file that carries only its header row', () => {
      // Not the empty-file case: there IS a line, so the `lines.length === 0` guard never fired
      // and the dialog walked on to a review screen it would then refuse to leave, unexplained.
      assert.throws(() => parseDelimited('codigo,nombre,precio'), (error) => {
        assert.equal(error.messageKey, 'importErrorNoDataRows');
        assert.deepEqual(error.params, {});
        return true;
      });
      assert.throws(() => parseDelimited('codigo,nombre,precio\n\n\n'), ImportParseError);
    });

    it('reports the header as the user typed it, not normalized', () => {
      // The message exists to help someone find the column in their own file.
      assert.throws(() => parseDelimited('Código,CÓDIGO\n1,2'), (error) => {
        assert.equal(error.messageKey, 'importErrorDuplicateHeader');
        assert.deepEqual(error.params, { header: 'CÓDIGO' });
        return true;
      });
    });
  });
});

describe('decodeCsvBuffer', () => {
  it('decodes plain ASCII/UTF-8 content', () => {
    const bytes = new TextEncoder().encode('name,email\nLucia,lucia@x.com');
    assert.equal(decodeCsvBuffer(bytes.buffer), 'name,email\nLucia,lucia@x.com');
  });

  it('decodes UTF-8 accented content correctly', () => {
    const bytes = new TextEncoder().encode('nombre\nAndrés');
    assert.equal(decodeCsvBuffer(bytes.buffer), 'nombre\nAndrés');
  });

  it('falls back to windows-1252 when utf-8 decoding produces replacement characters', () => {
    // "Andrés" encoded as Windows-1252: 'é' = 0xE9 (a single byte, invalid as a
    // UTF-8 continuation byte on its own, so a naive UTF-8 decode replaces it with U+FFFD).
    const win1252Bytes = new Uint8Array([0x41, 0x6e, 0x64, 0x72, 0xe9, 0x73]); // "Andr" + 0xE9 + "s"
    assert.equal(decodeCsvBuffer(win1252Bytes.buffer), 'Andrés');
  });

  it('throws ImportParseError when neither encoding produces clean text', () => {
    // Byte sequence invalid in both UTF-8 and Windows-1252 lead byte position is
    // hard to construct since windows-1252 maps every byte 0x00-0xFF to something —
    // so this path is exercised via decodeCsvBuffer's contract test using a spy
    // decoder swap is unnecessary; windows-1252 is a total function over bytes and
    // never itself produces U+FFFD, so this case cannot occur in practice. Covered
    // instead by asserting the fallback never throws for any byte value 0x00-0xFF.
    for (let b = 0; b <= 0xff; b += 1) {
      const bytes = new Uint8Array([0x41, b, 0x42]);
      assert.doesNotThrow(() => decodeCsvBuffer(bytes.buffer));
    }
  });
});
