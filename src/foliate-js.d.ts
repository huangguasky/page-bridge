declare module 'foliate-js/view.js' {
  export interface TocItem { label: string; href: string; subitems?: TocItem[] }
  export interface FoliateBook {
    toc?: TocItem[]
    dir?: string
    metadata?: { title?: string | Record<string, string>; author?: unknown }
  }
  export class View extends HTMLElement {
    book: FoliateBook
    renderer: HTMLElement & { setStyles?(css: string): void }
    lastLocation?: { fraction?: number; tocItem?: TocItem }
    open(file: File): Promise<void>
    init(options: { showTextStart?: boolean }): Promise<void>
    goTo(target: string | number): Promise<unknown>
    goLeft(): Promise<void>
    goRight(): Promise<void>
    close(): void
  }
}
