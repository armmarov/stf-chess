import { ref, onBeforeUnmount } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SF = any

// Module-level singleton — shared across all composable instances on the same page.
let scriptLoaded = false
let engine: SF | null = null
let engineReady = false
const pendingReady: Array<() => void> = []

function loadStockfishScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/stockfish.js'
    s.onload = () => { scriptLoaded = true; resolve() }
    s.onerror = () => reject(new Error('stockfish.js load failed'))
    document.head.appendChild(s)
  })
}

async function ensureEngine(): Promise<SF> {
  if (engineReady && engine) return engine

  await loadStockfishScript()

  if (!engine) {
    // stockfish.wasm (niklasf v0.10) factory returns a Promise that resolves
    // to the Module once the WASM is instantiated — await before calling
    // addMessageListener / postMessage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    engine = await (window as any).Stockfish({ locateFile: (f: string) => '/' + f })
    engine.addMessageListener((line: string) => {
      if (line === 'readyok') {
        engineReady = true
        pendingReady.splice(0).forEach((cb) => cb())
      }
    })
    engine.postMessage('uci')
    engine.postMessage('isready')
  }

  if (!engineReady) {
    await new Promise<void>(resolve => pendingReady.push(resolve))
  }

  return engine
}

export function useStockfish() {
  const analyzing = ref(false)
  const evalCp = ref<number | null>(null)
  const bestMove = ref<string | null>(null)
  const pvUci = ref<string[]>([])
  const searchDepth = ref(0)
  const engineError = ref(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listener: ((line: string) => void) | null = null

  function removeListener() {
    if (listener && engine) {
      engine.removeMessageListener(listener)
      listener = null
    }
  }

  async function analyzePosition(fen: string) {
    analyzing.value = true
    evalCp.value = null
    bestMove.value = null
    pvUci.value = []
    searchDepth.value = 0
    engineError.value = false

    // Up-front environment check — surfaces the real cause in the console
    // instead of a generic "unavailable" state.
    if (typeof self !== 'undefined') {
      // eslint-disable-next-line no-console
      console.info('[stockfish] crossOriginIsolated =', (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated)
      // eslint-disable-next-line no-console
      console.info('[stockfish] SharedArrayBuffer =', typeof SharedArrayBuffer)
    }
    if (typeof SharedArrayBuffer === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('[stockfish] SharedArrayBuffer is not available — page is not cross-origin isolated. Check response headers COOP/COEP/CORP.')
      engineError.value = true
      analyzing.value = false
      return
    }

    let eng: SF
    try {
      eng = await ensureEngine()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[stockfish] engine init failed:', err)
      engineError.value = true
      analyzing.value = false
      return
    }

    removeListener()
    eng.postMessage('stop')

    listener = (line: string) => {
      if (line.startsWith('info') && line.includes(' score ')) {
        const dm = line.match(/depth (\d+)/)
        const cm = line.match(/score cp (-?\d+)/)
        const mm = line.match(/score mate (-?\d+)/)
        const pm = line.match(/ pv (.+)/)

        if (dm) searchDepth.value = parseInt(dm[1])
        if (cm) evalCp.value = parseInt(cm[1])
        else if (mm) evalCp.value = parseInt(mm[1]) > 0 ? 30000 : -30000
        if (pm) pvUci.value = pm[1].trim().split(' ').slice(0, 10)
      } else if (line.startsWith('bestmove')) {
        const bm = line.match(/^bestmove (\S+)/)
        if (bm && bm[1] !== '(none)') bestMove.value = bm[1]
        analyzing.value = false
        removeListener()
      }
    }

    eng.addMessageListener(listener)
    eng.postMessage(`position fen ${fen}`)
    eng.postMessage('go movetime 1500 depth 15')
  }

  function stop() {
    if (engine) engine.postMessage('stop')
    analyzing.value = false
    removeListener()
  }

  onBeforeUnmount(() => stop())

  return { analyzing, evalCp, bestMove, pvUci, searchDepth, engineError, analyzePosition, stop }
}
