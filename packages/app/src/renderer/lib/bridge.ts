export function getJetBridge() {
  if (!window.jet) {
    throw new Error("Jet preload bridge failed to load. Restart the app and check the Electron preload configuration.")
  }

  return window.jet
}

export function getJetBridgeMethod<K extends keyof NonNullable<Window["jet"]>>(method: K): NonNullable<Window["jet"]>[K] {
  const bridge = getJetBridge()
  const value = bridge[method]

  if (typeof value !== "function") {
    throw new Error(`Jet preload bridge is missing '${String(method)}'. Restart the Electron app to load the updated bridge.`)
  }

  return value
}
