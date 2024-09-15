import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

import findUp from "find-up"

const CACHE = new Set()
const PACKAGE = "package.json"

interface Package {
  name?: string
  version?: string
  addon?: boolean
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function identifier(pkg: Package): string {
  return `${pkg.name ?? ""}@${pkg.version ?? "0.0.0"}`
}

async function findPackage(directory: string): Promise<Package | null> {
  const pkgPath = await findUp(PACKAGE, { cwd: directory })
  if (pkgPath) {
    return JSON.parse(await fs.readFile(pkgPath, { encoding: "utf-8" }))
  }
  return null
}

async function walkNodeModules(entry: Package, addons: Package[]): Promise<void> {
  const dependencies = Object.assign({}, entry.dependencies, entry.optionalDependencies)

  for (let dependency in dependencies) {
    if (dependencies[dependency].startsWith("npm:")) {
      const alias = dependencies[dependency]
      dependency = alias.slice(4, alias.includes("@") ? alias.lastIndexOf("@") : alias.length)
    }

    let pkg: Package | null
    try {
      // Attempt to resolve package.json directly, will fail if it's not exported
      const cwd = path.dirname(require.resolve(`${dependency}/${PACKAGE}`, { paths: [process.cwd()] }))
      pkg = await findPackage(cwd)
    } catch (err: any) {
      if (err.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED" && err.code !== "MODULE_NOT_FOUND") {
        throw err
      }
      try {
        // As a fallback try to resolve main export
        const cwd = path.dirname(require.resolve(dependency, { paths: [process.cwd()] }))
        pkg = await findPackage(cwd)
      } catch (err: any) {
        if (err.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
          // Not sure how to correctly handle this. Module doesn't export package.json
          // And also doesn't have main export. Ignoring for now, since bare-* modules have both
          continue
        }
        if (err.code === "MODULE_NOT_FOUND") {
          // Most likely optional module that wasn't installed
          continue
        }
        throw err
      }
    }

    if (pkg == null) {
      continue
    }

    if (CACHE.has(identifier(pkg))) {
      continue
    }
    CACHE.add(identifier(pkg))

    if (pkg.addon === true) {
      addons.push(pkg)
    }

    await walkNodeModules(pkg, addons)
  }
}

function dedupeAddons(addons: Package[]): Package[] {
  return addons.filter(
    (value, index, self) => index === self.findIndex((other) => other.name === value.name && other.version === value.version),
  )
}

export default async function fingerprint(cwd = process.cwd()): Promise<string> {
  const project = await findPackage(cwd)

  if (!project) {
    return ""
  }

  const addons: Package[] = []
  await walkNodeModules(project, addons)

  const source = dedupeAddons(addons).map(identifier).sort().join(";")
  return crypto.createHash("sha1").update(source).digest("hex")
}
