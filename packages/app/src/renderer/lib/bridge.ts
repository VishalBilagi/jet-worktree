export function getJetBridge() {
  if (!window.jet) {
    throw new Error("Jet preload bridge failed to load. Restart the app and check the Electron preload configuration.")
  }

  return window.jet
}
