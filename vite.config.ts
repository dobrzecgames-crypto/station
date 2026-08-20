import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'

function resolveBuildSha(): string {
  const suppliedSha = process.env.STATION_BUILD_SHA ?? process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  if (suppliedSha && /^[0-9a-f]{7,40}$/i.test(suppliedSha.trim())) return suppliedSha.trim().slice(0, 12)
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __STATION_BUILD_SHA__: JSON.stringify(resolveBuildSha()),
  },
})
