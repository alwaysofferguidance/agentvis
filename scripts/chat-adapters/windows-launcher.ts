import { delimiter, join, win32 } from 'node:path'
import { existsSync } from 'node:fs'

interface FindCliOptions {
  platform?: NodeJS.Platform
  pathValue?: string
  exists?: (candidate: string) => boolean
}

export function isWindowsBatchShim(executable: string, platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)
}

export function windowsShimError(cliName: string, path: string, envName: string): Error {
  return new Error(`${cliName} was found at ${path}, but Windows .cmd/.bat launchers cannot be started safely. Set ${envName} to the CLI's native .exe or JavaScript launcher.`)
}

/** Find directly executable PATH entries, reporting Windows batch shims separately. */
export function findCliOnPath(name: string, options: FindCliOptions = {}): { executable?: string; unsupportedShim?: string } {
  const platform = options.platform ?? process.platform
  const pathValue = options.pathValue ?? process.env.PATH ?? ''
  const exists = options.exists ?? existsSync
  const pathDelimiter = platform === 'win32' ? ';' : delimiter
  const joinPath = platform === 'win32' ? win32.join : join
  const directories = pathValue.split(pathDelimiter)
  const extensions = platform === 'win32' ? ['.exe'] : ['']

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = joinPath(directory, `${name}${extension}`)
      if (exists(candidate)) return { executable: candidate }
    }
  }

  if (platform === 'win32') {
    for (const directory of directories) {
      for (const extension of ['.cmd', '.bat']) {
        const candidate = joinPath(directory, `${name}${extension}`)
        if (exists(candidate)) return { unsupportedShim: candidate }
      }
    }
  }

  return {}
}
