// Runs Python in the browser using Pyodide (CPython compiled to WebAssembly).
// The first run downloads the runtime, so it needs internet and takes a few seconds.
const send = (msg) => self.postMessage(msg)
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

// A Python traceback ends with a line like "NameError: name 'x' is not defined"
function parsePythonError(err) {
  const text = String(err?.message || err)
  const lines = text.trim().split('\n')
  const last = lines[lines.length - 1]
  const m = /^([A-Za-z_][\w.]*):\s*(.*)$/.exec(last)
  // The last frame inside the user's code is shown as File "<exec>", line N
  const frames = [...text.matchAll(/File "<exec>", line (\d+)/g)]
  return {
    type: m ? m[1] : 'Error',
    message: m ? m[2] : last,
    line: frames.length ? Number(frames[frames.length - 1][1]) : null,
  }
}

self.onmessage = async (event) => {
  let pyodide
  try {
    importScripts(PYODIDE_URL + 'pyodide.js')
    pyodide = await self.loadPyodide({ indexURL: PYODIDE_URL })
  } catch {
    send({
      type: 'error',
      error: {
        type: 'LoadError',
        message: 'Could not load the Python runtime.',
        line: null,
      },
    })
    return
  }

  pyodide.setStdout({ batched: (text) => send({ type: 'out', text }) })
  pyodide.setStderr({ batched: (text) => send({ type: 'err', text }) })
  pyodide.setStdin({ stdin: () => undefined }) // input() is not supported: it gets "end of file"

  // The runtime is loaded, so cut off the network before running user code
  self.fetch = undefined
  self.XMLHttpRequest = undefined
  self.WebSocket = undefined

  send({ type: 'started' })
  try {
    await pyodide.runPythonAsync(event.data.code)
    send({ type: 'done' })
  } catch (err) {
    send({ type: 'error', error: parsePythonError(err) })
  }
}