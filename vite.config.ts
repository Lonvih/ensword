import { rmSync, cpSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-electron-plugin'
import { customStart, loadViteEnv } from 'vite-electron-plugin/plugin'
import renderer from 'vite-plugin-electron-renderer'
import commonjs from 'vite-plugin-commonjs'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })
  mkdirSync('dist-electron')
  mkdirSync('dist-electron/sample')
  cpSync('electron/sample', 'dist-electron/sample', {recursive: true})

  const sourcemap = command === 'serve' || !!process.env.VSCODE_DEBUG

  return {
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src')
      },
    },
    plugins: [
      commonjs(),
      react(),
      electron({
        include: [
          'electron'
        ],
        transformOptions: {
          sourcemap,
        },
        plugins: [
          ...(!!process.env.VSCODE_DEBUG
            ? [
              // Will start Electron via VSCode Debug
              customStart(debounce(() => console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App'))),
            ]
            : []),
          // Allow use `import.meta.env.VITE_SOME_KEY` in Electron-Main
          loadViteEnv(),
        ],
      }),
      // Use Node.js API in the Renderer-process
      renderer({
        nodeIntegration: true,
      }),
    ],
    server: !!process.env.VSCODE_DEBUG ? (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
      return {
        host: url.hostname,
        port: +url.port,
      }
    })() : undefined,
    clearScreen: false
  }
})

function debounce<Fn extends (...args: any[]) => void>(fn: Fn, delay = 299): Fn {
  let t: NodeJS.Timeout
  return ((...args: Parameters<Fn>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }) as Fn
}