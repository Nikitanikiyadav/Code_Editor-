// Runs inside a Web Worker: no access to the page, the DOM or cookies.
const send = (msg) => self.postMessage(msg)

function show(value) {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || String(value)
  try {
    return typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value)
  } catch {
    return String(value)
  }
}

// Send console.log and friends to the Output panel
for (const [method, kind] of [
  ['log', 'out'], ['info', 'out'], ['warn', 'err'], ['error', 'err'],
]) {
  console[method] = (...args) => send({ type: kind, text: args.map(show).join(' ') })
}

// Remove every way to talk to the network
self.fetch = undefined
self.XMLHttpRequest = undefined
self.WebSocket = undefined
self.importScripts = undefined

// Best effort: errors point at "<anonymous>:LINE:COL". The function wrapper adds 2 lines.
function lineOf(err) {
  const m = /<anonymous>:(\d+):\d+/.exec(String(err?.stack || ''))
  return m ? Math.max(1, Number(m[1]) - 2) : null
}

self.onmessage = async (event) => {
  send({ type: 'started' })
  try {
    // AsyncFunction lets users write top-level `await`
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    await new AsyncFunction(event.data.code)()
    send({ type: 'done' })
  } catch (err) {
    send({
      type: 'error',
      error: {
        type: err?.name || 'Error',
        message: err?.message || String(err),
        line: lineOf(err),
      },
    })
  }
}