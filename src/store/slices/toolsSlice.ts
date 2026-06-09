import type { StateCreator } from 'zustand'
import type { FullState } from '../toolStore'

export interface WordPdfFile {
  id: string
  inputPath: string
  name: string
  status: 'pending' | 'converting' | 'done' | 'error'
  outputPath?: string
  error?: string
}

export interface ToolsSlice {
  wordPdfFiles: WordPdfFile[]
  wordPdfOutFolder: string
  setWordPdfFiles: (files: WordPdfFile[] | ((prev: WordPdfFile[]) => WordPdfFile[])) => void
  setWordPdfOutFolder: (folder: string) => void
}

export const createToolsSlice: StateCreator<FullState, [], [], ToolsSlice> = (set) => ({
  wordPdfFiles: [],
  wordPdfOutFolder: '',
  setWordPdfFiles: (files) =>
    set((s) => ({ wordPdfFiles: typeof files === 'function' ? files(s.wordPdfFiles) : files })),
  setWordPdfOutFolder: (wordPdfOutFolder) => set({ wordPdfOutFolder }),
})
