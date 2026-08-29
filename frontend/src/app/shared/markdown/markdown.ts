import { Component, Input, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Component({
  selector: 'app-markdown',
  standalone: true,
  templateUrl: './markdown.html',
  styleUrl: './markdown.css',
  // Content is set via [innerHTML], which bypasses Angular's template compiler — those nodes
  // never get the emulated-encapsulation attribute, so scoped styles (`.markdown-body p` etc.)
  // would silently never match them. Global styles are the only way to reach injected HTML.
  encapsulation: ViewEncapsulation.None,
})
export class Markdown {
  private sanitizer = inject(DomSanitizer);
  private raw = signal('');

  @Input() set content(value: string) {
    this.raw.set(value ?? '');
  }

  // Content is site-authored and fully trusted (unlike chat-markdown.ts, which escapes
  // untrusted model output), so the parser's full HTML output is trusted directly.
  html = computed<SafeHtml>(() => {
    const parsed = marked.parse(this.raw(), { async: false }) as string;
    const withBlankLinks = parsed.replace(/<a\s+href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
    return this.sanitizer.bypassSecurityTrustHtml(withBlankLinks);
  });
}
