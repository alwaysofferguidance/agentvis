import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findCliOnPath, isWindowsBatchShim, windowsShimError } from './windows-launcher'

test('Windows PATH resolution reports batch shims instead of selecting them for direct spawn', () => {
  const result = findCliOnPath('agy', {
    platform: 'win32',
    pathValue: 'C:\\tools',
    exists: candidate => candidate === 'C:\\tools\\agy.cmd',
  })

  assert.deepEqual(result, { unsupportedShim: 'C:\\tools\\agy.cmd' })
})

test('Windows batch launcher overrides are rejected with a safe alternative', () => {
  assert.equal(isWindowsBatchShim('C:\\tools\\pi.cmd', 'win32'), true)
  assert.equal(isWindowsBatchShim('C:\\tools\\pi.exe', 'win32'), false)
  assert.match(windowsShimError('Pi CLI', 'C:\\tools\\pi.cmd', 'PI_CLI_PATH').message, /supported executable launcher/)
})

test('Windows PATH resolution prefers a native executable when both forms exist', () => {
  const result = findCliOnPath('pi', {
    platform: 'win32',
    pathValue: 'C:\\tools',
    exists: candidate => candidate === 'C:\\tools\\pi.exe' || candidate === 'C:\\tools\\pi.cmd',
  })

  assert.deepEqual(result, { executable: 'C:\\tools\\pi.exe' })
})
