# bare-fingerprint

`npm i -D bare-fingerprint`

Fingerprint your Bare build so you know when you need to recompile.

## Usage

You can either run as a cli:

`npx bare-fingerprint`

Or use as a library:

```typescript
import fingerprint from "bare-fingerprint"

const hashString = await fingerprint(process.cwd())
```

## API

### `const hashString = await fingerprint(cwd = process.cwd())`

Recursively walks projects (`cwd`) dependency tree looking for Bare addons, compiles a list of addons, and then hashes it with SHA-1.
