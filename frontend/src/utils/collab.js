const PALETTE = [
  '#e06c75', '#e5c07b', '#98c379', '#56b6c2',
  '#61afef', '#c678dd', '#d19a66', '#be5046',
]

// Same username -> same color on every screen
export function colorFor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

// Cursor info comes from OTHER users' browsers, so never trust it.
// We put it into a CSS rule, so we strip everything except safe characters.
const safeName = (n) => String(n ?? '').replace(/[^\w@.+\- ]/g, '').slice(0, 24) || 'guest'
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#888888')

// y-monaco gives each remote cursor the class names `...-<clientID>`.
// We generate one small CSS rule set per remote user.
export function remoteCursorCss(states, myClientId) {
  const rules = []
  states.forEach((state, id) => {
    if (id === myClientId || !Number.isInteger(id) || !state?.user) return
    const color = safeColor(state.user.color)
    const name = safeName(state.user.name)
    rules.push(
      `.yRemoteSelection-${id}{background:${color}55}`,
      `.yRemoteSelectionHead-${id}{border-left:2px solid ${color}}`,
      `.yRemoteSelectionHead-${id}::after{content:"${name}";background:${color}}`,
    )
  })
  return rules.join('\n')
}