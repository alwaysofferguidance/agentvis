import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractUserPromptText } from '../src/user-prompt'

describe('extractUserPromptText', () => {
  it('removes the leading AGENTS instructions and environment scaffold', () => {
    const input = '# AGENTS.md instructions\n\n<INSTRUCTIONS>workspace rules</INSTRUCTIONS><environment_context><cwd>/tmp/project</cwd></environment_context>'
    assert.equal(extractUserPromptText(input), null)
  })

  it('keeps a real prompt following the scaffold', () => {
    const input = '# AGENTS.md instructions\n\n<INSTRUCTIONS>workspace rules</INSTRUCTIONS><environment_context><cwd>/tmp/project</cwd></environment_context>\n\nFix the failing test.'
    assert.equal(extractUserPromptText(input), 'Fix the failing test.')
  })

  it('normalizes a leading BOM and whitespace around a pure scaffold', () => {
    const input = '\uFEFF \n# AGENTS.md instructions\n<INSTRUCTIONS>rules</INSTRUCTIONS>'
    assert.equal(extractUserPromptText(input), null)
  })

  it('preserves ordinary discussion that mentions AGENTS.md or instruction tags', () => {
    const input = 'Please update AGENTS.md and show the literal <INSTRUCTIONS> tag in the docs.'
    assert.equal(extractUserPromptText(input), input)
  })

  it('preserves a bare AGENTS heading with ordinary user text after it', () => {
    const input = '# AGENTS.md instructions\nPlease help me improve this heading.'
    assert.equal(extractUserPromptText(input), input)
  })

  it('filters a pure leading environment context but preserves trailing user text', () => {
    assert.equal(extractUserPromptText('<environment_context><cwd>/tmp/project</cwd></environment_context>'), null)
    assert.equal(extractUserPromptText('<environment_context><cwd>/tmp/project</cwd></environment_context>\nRun the tests.'), 'Run the tests.')
  })

  it('preserves a literal environment tag that does not contain environment fields', () => {
    const input = '<environment_context>literal tag example</environment_context> should remain in the docs.'
    assert.equal(extractUserPromptText(input), input)
  })

  it('preserves an unclosed environment tag without recognized fields', () => {
    const input = '<environment_context>literal tag example'
    assert.equal(extractUserPromptText(input), input)
  })
})
