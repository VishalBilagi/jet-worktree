export function printJson(data: unknown) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

export function outputResult<T>(json: boolean, data: T, formatter: (value: T) => string) {
  if (json) {
    printJson(data)
    return
  }

  process.stdout.write(`${formatter(data)}\n`)
}
