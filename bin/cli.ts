#! /usr/bin/env node
import fingerprint from "../src"

fingerprint()
  .then(console.log)
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
