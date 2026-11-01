# Agent Flow visual system

Agent Flow helps a person understand observed agent work, inspect evidence, and
use a separate local chat. The interface should make the next useful action
obvious without asking the person to decode a canvas.

## Information hierarchy

1. One compact session picker identifies the observed session. It supports search,
   meaningful task names, and a short identifier when names repeat.
2. Activity is the default work area. Readable rows expose action, target, reported
   state, and available outcome. Raw arguments, code, and JSON belong in details.
3. An inspector opens for a selected agent, tool, message, or file. Selection has
   a visible relationship to the row that opened it.
4. Map is an optional relationship view. Nodes represent observed main agents or
   workers; edges represent recorded relationships. It is useful for delegation
   and dependencies, rather than decoration or a task-completion display.
5. Local chat is a separate destination using the chosen installed runtime. It
   must never imply that it sends to the selected observed session.

## Layout and space

- Keep the shell to one compact header wherever the viewport allows it. Avoid
  persistent branding banners, horizontal session-tab accumulation, floating
  information cards, and duplicated navigation.
- Let the primary content use the available workspace. An inspector takes space
  when selected; agent navigation earns a pane only when it helps navigation.
- Empty sessions show one concise contextual state with an available next
  action. Do not render repeated empty categories or zero-count status cards.
- Activity, detail, and chat regions own their scrolling. Preserve focus and
  keyboard access, and keep core controls reachable in short landscape views.
- Desktop controls may be compact; coarse-pointer targets are at least 44px.

## Visual language

- Use the existing neutral charcoal foundation with off-white primary text,
  clearly quieter metadata, and visible but restrained dividers.
- Use a consistent sans-serif face at 14px for work content. Reserve monospace
  for code, identifiers, timestamps, and values whose alignment matters.
- Establish hierarchy through placement, spacing, weight, and contrast. Do not
  compensate for weak structure with larger containers or smaller text.
- Use plain rows and inline states. Selection and keyboard focus must remain
  clear without bloom, neon borders, particle motion, or animated status theater.
- Preserve distinct semantic status colors with text labels. Color alone must
  not be the explanation of a state.

## Meaning and evidence

- Distinguish watcher/session activity from an agent's reported state.
- Context means occupied prompt-window capacity; it is not task progress.
- Label cost estimates as estimates, and do not fabricate completion, billing,
  verified outcomes, file changes, or causal relationships.
- A tool event should expose a useful action and target when those are available.
  An opaque script may be labeled as a script; its effects must not be guessed.
- Keep historical tool results available after their live canvas nodes disappear.
- Controls must perform their stated action. Inspecting evidence, opening a known
  file, filtering activity, and navigating history are appropriate supported
  actions; stopping or messaging an observed external run requires a real route.

## Acceptance

Verify populated, empty, waiting, error, and multi-agent states. Check session
switching, selection, details, replay, Local chat, keyboard focus, and portrait /
short landscape layouts with actual rendered content. Use synthetic fixtures for
repeatable comparisons and report which checks are emulation rather than real
device evidence. Preserve unrelated work in the shared checkout.
