import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

function offlineWorker() {
  return {
    name: 'pressure-offline',
    apply: 'build',
    async writeBundle({ dir }) {
      const worker = await readFile(new URL('./src/sw.js', import.meta.url), 'utf8')
      const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name !== 'sw.js')
        .map(entry => join(entry.parentPath, entry.name).slice(dir.length + 1).replaceAll('\\', '/'))
        .sort()
      const hash = createHash('sha256').update(worker)
      for (const file of files) hash.update(file).update(await readFile(join(dir, file)))
      await writeFile(join(dir, 'sw.js'), worker
        .replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 16))
        .replace('/* __APP_FILES__ */ []', JSON.stringify(files.map(file => '/' + file))))
    },
  }
}

export default defineConfig({
  plugins: [react(), offlineWorker()],
});
