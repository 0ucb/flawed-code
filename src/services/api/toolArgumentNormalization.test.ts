import { describe, expect, test } from 'bun:test'
import { normalizeToolArguments } from './toolArgumentNormalization'

describe('normalizeToolArguments', () => {
  describe('Bash tool', () => {
    test('wraps plain string into { command }', () => {
      expect(normalizeToolArguments('Bash', 'pwd')).toEqual({ command: 'pwd' })
    })

    test('wraps multi-word command', () => {
      expect(normalizeToolArguments('Bash', 'ls -la /tmp')).toEqual({
        command: 'ls -la /tmp',
      })
    })

    test('passes through structured JSON object', () => {
      expect(
        normalizeToolArguments('Bash', '{"command":"echo hi"}'),
      ).toEqual({ command: 'echo hi' })
    })

    test('returns { raw } for blank string', () => {
      expect(normalizeToolArguments('Bash', '')).toEqual({ raw: '' })
      expect(normalizeToolArguments('Bash', '   ')).toEqual({ raw: '   ' })
    })

    test('returns { raw } for JSON-encoded blank string', () => {
      expect(normalizeToolArguments('Bash', '""')).toEqual({ raw: '' })
      expect(normalizeToolArguments('Bash', '"  "')).toEqual({ raw: '  ' })
    })

    test('returns { raw } for likely structured object literal that fails parse', () => {
      expect(normalizeToolArguments('Bash', '{ "command": "pwd"')).toEqual({
        raw: '{ "command": "pwd"',
      })
    })

    test.each([
      ['{command:"pwd"}'],
      ["{'command':'pwd'}"],
      ['{command: pwd}'],
    ])(
      'returns { raw } for malformed object-shaped string %s (does not wrap into command)',
      (input) => {
        expect(normalizeToolArguments('Bash', input)).toEqual({ raw: input })
      },
    )

    test.each([
      ['false', false],
      ['null', null],
      ['[]', [] as unknown[]],
      ['0', 0],
      ['true', true],
      ['123', 123],
    ])(
      'preserves JSON literal %s as-is (does not wrap into command)',
      (input, expected) => {
        expect(normalizeToolArguments('Bash', input)).toEqual(expected)
      },
    )

    test('wraps JSON-encoded string into { command }', () => {
      expect(normalizeToolArguments('Bash', '"pwd"')).toEqual({
        command: 'pwd',
      })
    })
  })

  describe('undefined arguments', () => {
    test('returns empty object for undefined', () => {
      expect(normalizeToolArguments('Bash', undefined)).toEqual({})
      expect(normalizeToolArguments('UnknownTool', undefined)).toEqual({})
    })
  })

  describe('Read tool', () => {
    test('wraps plain string into { file_path }', () => {
      expect(normalizeToolArguments('Read', '/home/user/file.txt')).toEqual({
        file_path: '/home/user/file.txt',
      })
    })

    test('wraps JSON-encoded string into { file_path }', () => {
      expect(normalizeToolArguments('Read', '"/home/user/file.txt"')).toEqual({
        file_path: '/home/user/file.txt',
      })
    })

    test('passes through structured JSON object', () => {
      expect(
        normalizeToolArguments('Read', '{"file_path":"/tmp/f.txt","limit":10}'),
      ).toEqual({ file_path: '/tmp/f.txt', limit: 10 })
    })
  })

  describe('Write tool', () => {
    test('wraps plain string into { file_path }', () => {
      expect(normalizeToolArguments('Write', '/tmp/out.txt')).toEqual({
        file_path: '/tmp/out.txt',
      })
    })

    test('passes through structured JSON object', () => {
      expect(
        normalizeToolArguments(
          'Write',
          '{"file_path":"/tmp/out.txt","content":"hello"}',
        ),
      ).toEqual({ file_path: '/tmp/out.txt', content: 'hello' })
    })
  })

  describe('Edit tool', () => {
    test('wraps plain string into { file_path }', () => {
      expect(normalizeToolArguments('Edit', '/tmp/edit.ts')).toEqual({
        file_path: '/tmp/edit.ts',
      })
    })

    test('passes through structured JSON object', () => {
      expect(
        normalizeToolArguments(
          'Edit',
          '{"file_path":"/tmp/f.ts","old_string":"a","new_string":"b"}',
        ),
      ).toEqual({ file_path: '/tmp/f.ts', old_string: 'a', new_string: 'b' })
    })
  })

  describe('Glob tool', () => {
    test('wraps plain string into { pattern }', () => {
      expect(normalizeToolArguments('Glob', '**/*.ts')).toEqual({
        pattern: '**/*.ts',
      })
    })

    test('passes through structured JSON object', () => {
      expect(
        normalizeToolArguments('Glob', '{"pattern":"*.js","path":"/src"}'),
      ).toEqual({ pattern: '*.js', path: '/src' })
    })
  })

  describe('Grep tool', () => {
    test('wraps plain string into { pattern }', () => {
      expect(normalizeToolArguments('Grep', 'TODO')).toEqual({
        pattern: 'TODO',
      })
    })

    test('passes through structured JSON object', () => {
      expect(
        normalizeToolArguments('Grep', '{"pattern":"fixme","path":"/src"}'),
      ).toEqual({ pattern: 'fixme', path: '/src' })
    })
  })

  describe('unknown tools', () => {
    test('returns { raw } for plain string', () => {
      expect(normalizeToolArguments('UnknownTool', 'some value')).toEqual({
        raw: 'some value',
      })
    })

    test('passes through structured JSON object', () => {
      expect(
        normalizeToolArguments('UnknownTool', '{"key":"val"}'),
      ).toEqual({ key: 'val' })
    })

    test('preserves JSON literals as-is', () => {
      expect(normalizeToolArguments('UnknownTool', 'false')).toEqual(false)
      expect(normalizeToolArguments('UnknownTool', 'null')).toEqual(null)
      expect(normalizeToolArguments('UnknownTool', '[]')).toEqual([])
    })

    test('returns JSON-encoded string as parsed string for unknown tools', () => {
      expect(normalizeToolArguments('UnknownTool', '"hello"')).toEqual(
        'hello',
      )
    })
  })
})
