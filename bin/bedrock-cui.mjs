#!/usr/bin/env node
import { main } from '../dist/cli/index.js'

main(process.argv.slice(2)).catch((e) => {
    console.error(e?.message ?? e)
    process.exit(1)
})
