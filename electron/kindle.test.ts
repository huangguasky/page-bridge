import { describe, expect, it } from 'vitest'
import { validateKindleFiles } from './kindle.js'

describe('validateKindleFiles', () => {
  it('accepts Kindle document and image formats case-insensitively', () => {
    expect(validateKindleFiles(['book.EPUB', 'paper.pdf', 'note.docx', 'cover.JPG'])).toEqual([])
  })
  it('rejects unsupported and extensionless files', () => {
    expect(validateKindleFiles(['archive.zip', 'video.mp4', 'README'])).toEqual(['archive.zip', 'video.mp4', 'README'])
  })
})
