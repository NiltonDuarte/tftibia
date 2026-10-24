import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_PAGES_BASE ?? (repositoryName ? `/${repositoryName}/` : '/')

export default defineConfig({
  base,
  plugins: [react()],
})
