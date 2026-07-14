import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { View as FoliateView, type TocItem } from 'foliate-js/view.js'

const basename = (path: string) => path.split(/[\\/]/).pop() || path
const supported = (path: string) => /\.(epub|mobi|azw3)$/i.test(path)
const textValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return Object.values(value as Record<string, string>)[0] || ''
  return ''
}

function Toc({ items, active, onSelect, depth = 0 }: { items: TocItem[]; active?: string; onSelect: (href: string) => void; depth?: number }) {
  return <>{items.map((item, index) => <div key={`${item.href}-${index}`}>
    <button className={active === item.href ? 'current' : ''} style={{ paddingLeft: 15 + depth * 16 }} onClick={() => onSelect(item.href)}>{item.label || '未命名章节'}</button>
    {!!item.subitems?.length && <Toc items={item.subitems} active={active} onSelect={onSelect} depth={depth + 1} />}
  </div>)}</>
}

export default function EbookReader() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<FoliateView | null>(null)
  const loadToken = useRef(0)
  const [path, setPath] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [toc, setToc] = useState<TocItem[]>([])
  const [activeToc, setActiveToc] = useState<string>()
  const [currentChapter, setCurrentChapter] = useState('')
  const [tocOpen, setTocOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [readingProgress, setReadingProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const close = useCallback(() => {
    loadToken.current += 1
    viewRef.current?.close()
    viewRef.current?.remove()
    viewRef.current = null
    setPath(null); setTitle(''); setToc([]); setActiveToc(undefined); setCurrentChapter(''); setTocOpen(false)
    setLoading(false); setProgress(0); setReadingProgress(0); setError('')
  }, [])

  const open = useCallback(async (filePath: string) => {
    if (!supported(filePath)) { setError('仅支持 EPUB、MOBI 和 AZW3 文件'); return }
    close()
    const token = ++loadToken.current
    setPath(filePath); setTitle(basename(filePath)); setLoading(true); setProgress(8); setError('')
    try {
      const bytes = await window.pageBridge.readEbook(filePath)
      if (token !== loadToken.current) return
      setProgress(42)
      const copy = new Uint8Array(bytes).slice()
      const file = new File([copy.buffer], basename(filePath))
      const view = new FoliateView()
      view.className = 'foliate-reader'
      hostRef.current?.append(view)
      viewRef.current = view
      view.addEventListener('relocate', ((event: CustomEvent) => {
        const detail = event.detail || {}
        if (typeof detail.fraction === 'number') setReadingProgress(Math.round(detail.fraction * 100))
        setActiveToc(detail.tocItem?.href)
        setCurrentChapter(detail.tocItem?.label || '')
      }) as EventListener)
      setProgress(68)
      await view.open(file)
      if (token !== loadToken.current) { view.close(); view.remove(); return }
      view.renderer.setAttribute('flow', 'paginated')
      view.renderer.setAttribute('max-column-count', '2')
      // Foliate only creates a spread when the viewport is wider than
      // max-inline-size. Keep each text column book-page sized so the renderer
      // actually paginates into two columns instead of drawing one wide page.
      view.renderer.setAttribute('max-inline-size', '360px')
      view.renderer.setAttribute('gap', '6%')
      view.renderer.setAttribute('margin', '48px')
      view.renderer.setStyles?.('body{color:#29251f;background:#fffdf8} p{line-height:1.75} img{max-width:100%}')
      setTitle(textValue(view.book.metadata?.title) || basename(filePath))
      setToc(view.book.toc || [])
      setProgress(90)
      await view.init({ showTextStart: true })
      setProgress(100)
      window.setTimeout(() => { if (token === loadToken.current) setLoading(false) }, 180)
    } catch (reason) {
      if (token !== loadToken.current) return
      viewRef.current?.close(); viewRef.current?.remove(); viewRef.current = null
      setLoading(false); setError(`无法打开这本书：${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }, [close])

  useEffect(() => () => { loadToken.current += 1; viewRef.current?.close() }, [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!viewRef.current || event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft') viewRef.current.goLeft()
      if (event.key === 'ArrowRight') viewRef.current.goRight()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  const pick = async () => { const picked = await window.pageBridge.pickEbook(); if (picked) open(picked) }
  const drop = (event: DragEvent) => {
    event.preventDefault(); setDragging(false)
    const file = event.dataTransfer.files[0]
    const filePath = file && window.pageBridge.getPathForFile(file)
    if (filePath) open(filePath)
  }

  if (!path) return <section><Top title="电子书预览" sub="支持 EPUB、MOBI 和 AZW3 格式" />
    <div className={`drop ebook-drop ${dragging ? 'dragging' : ''}`} onClick={pick} onDragEnter={e => { e.preventDefault(); setDragging(true) }} onDragOver={e => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <div className="drop-icon">＋</div><h3>点击打开或拖入电子书</h3><p>书籍只在本机解析，不会上传到互联网</p>
    </div>{error && <div className="notice bad">{error}</div>}</section>

  return <section className="reader-section">
    <header className="reader-toolbar">
      <div className="reader-title"><b>{title}</b><span>{currentChapter ? `当前章节：${currentChapter} · ` : ''}{readingProgress}%</span></div>
      <div className="reader-actions"><button disabled={!toc.length || loading} onClick={() => setTocOpen(x => !x)}>☰ 目录</button><button className="reader-close" onClick={close}>× 关闭本书</button></div>
    </header>
    <div className="reader-shell">
      {tocOpen && <aside className="toc-panel"><div className="toc-head"><b>目录</b><button onClick={() => setTocOpen(false)}>×</button></div>{toc.length ? <Toc items={toc} active={activeToc} onSelect={href => { viewRef.current?.goTo(href); setTocOpen(false) }} /> : <p>这本书没有目录</p>}</aside>}
      <div className="book-stage"><div ref={hostRef} className="book-view" />{!tocOpen && <div className="book-seam" />}
        {!loading && <><button className="page-turn prev" aria-label="上一页" onClick={() => viewRef.current?.goLeft()}>‹</button><button className="page-turn next" aria-label="下一页" onClick={() => viewRef.current?.goRight()}>›</button></>}
        {loading && <div className="reader-loading"><b>正在加载电子书…</b><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>}
        {error && <div className="reader-error"><p>{error}</p><button onClick={close}>返回选择文件</button></div>}
      </div>
    </div>
  </section>
}

function Top({ title, sub }: { title: string; sub: string }) { return <header className="top"><div><h1>{title}</h1><p>{sub}</p></div></header> }
