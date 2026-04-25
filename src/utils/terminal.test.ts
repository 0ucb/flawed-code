import { describe, expect, test } from 'bun:test'
import { isBinaryContent, sanitizeBinaryOutput } from './terminal.js'

describe('isBinaryContent', () => {
  test('returns false for normal text', () => {
    expect(isBinaryContent('hello world')).toBe(false)
    expect(isBinaryContent('line1\nline2\nline3')).toBe(false)
    expect(isBinaryContent('error: something went wrong')).toBe(false)
  })

  test('returns false for ANSI-colored text', () => {
    expect(isBinaryContent('\x1b[31mred text\x1b[0m')).toBe(false)
    expect(isBinaryContent('\x1b[1;32mgreen bold\x1b[0m')).toBe(false)
  })

  test('returns false for JSON output', () => {
    expect(isBinaryContent('{"key": "value", "num": 42}')).toBe(false)
    expect(isBinaryContent('[\n  {"a": 1},\n  {"b": 2}\n]')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isBinaryContent('')).toBe(false)
  })

  test('returns false for tab-separated output', () => {
    expect(isBinaryContent('col1\tcol2\tcol3')).toBe(false)
  })

  test('returns true for raw binary with high control char ratio', () => {
    const binary = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f'
    expect(isBinaryContent(binary)).toBe(true)
  })

  test('returns true for binary with NUL bytes mixed with text', () => {
    const mixed = 'hello\x00\x00\x00world\x00\x00\x00test'
    expect(isBinaryContent(mixed)).toBe(true)
  })

  test('returns true for binary with DEL bytes', () => {
    const withDel = 'text\x7f\x7f\x7f\x7fmore'
    expect(isBinaryContent(withDel)).toBe(true)
  })

  test('returns true for binary with C1 control chars', () => {
    const c1 = 'text\x80\x81\x82\x83\x84\x85\x86'
    expect(isBinaryContent(c1)).toBe(true)
  })

  test('returns false for content with few control chars', () => {
    const mostlyText = 'hello\x01world test one two three four five'
    expect(isBinaryContent(mostlyText)).toBe(false)
  })
})

describe('sanitizeBinaryOutput', () => {
  test('passes through normal text', () => {
    expect(sanitizeBinaryOutput('hello world')).toBe('hello world')
    expect(sanitizeBinaryOutput('line1\nline2')).toBe('line1\nline2')
  })

  test('replaces binary with summary', () => {
    const binary = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17'
    const result = sanitizeBinaryOutput(binary)
    expect(result).toContain('[binary output:')
    expect(result).toContain('B]')
  })

  test('shows KB for larger binary output', () => {
    const size = 5000
    const binary = '\x00'.repeat(size) + 'hello'
    const result = sanitizeBinaryOutput(binary, size)
    expect(result).toContain('[binary output:')
    expect(result).toContain('KB')
  })

  test('shows MB for very large binary output', () => {
    const size = 2_000_000
    const result = sanitizeBinaryOutput('\x00'.repeat(500), size)
    expect(result).toContain('[binary output:')
    expect(result).toContain('MB')
  })
})
