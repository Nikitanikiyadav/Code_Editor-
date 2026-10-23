// Starts a worker, collects its output, and enforces the time limits.
export const RUNNABLE = ['javascript', 'python']
export const canRun = (language) => RUNNABLE.includes(language)

export const LIMITS = {
  runMs: 10_000,    // max time the user's code may run
  loadMs: 60_000,   // max time to download the Python runtime
}

export function startRun(language, code, onOutput) {
  const worker =
    language === 'python'
      ? new Worker(new URL('../workers/pythonWorker.js', import.meta.url))
      : new Worker(new URL('../workers/jsWorker.js', import.meta.url))

  let settled = false
  let timer
  let resolveDone
  const done = new Promise((resolve) => { resolveDone = resolve })

  const finish = (result) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    worker.terminate() // kills the code immediately, even an infinite loop
    resolveDone(result)
  }

  // Before the code starts: waiting for the runtime to load
  timer = setTimeout(() => finish({ status: 'timeout', phase: 'load' }), LIMITS.loadMs)

  worker.onmessage = (event) => {
    const msg = event.data
    if (msg.type === 'started') {
      clearTimeout(timer) // now the real run timer begins
      timer = setTimeout(() => finish({ status: 'timeout', phase: 'run' }), LIMITS.runMs)
    } else if (msg.type === 'out' || msg.type === 'err') {
      onOutput(msg.text, msg.type)
    } else if (msg.type === 'done') {
      finish({ status: 'ok' })
    } else if (msg.type === 'error') {
      finish({ status: 'error', error: msg.error })
    }
  }

  worker.onerror = (event) =>
    finish({
      status: 'error',
      error: { type: 'WorkerError', message: event.message || 'The runner crashed.', line: null },
    })

  worker.postMessage({ code })
  return { done, stop: () => finish({ status: 'stopped' }) }
}