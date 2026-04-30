import { Injectable } from "@angular/core";
import { MessageService } from "primeng/api";

type Sev = 'success' | 'info' | 'warn' | 'error';

@Injectable({ providedIn: 'root' })
export class Toast {
    constructor(private ms: MessageService) { }

    show(severity: Sev, summary: string, detail?: string, life = 2000, styleClass?: string, icon?: string) {
    this.ms.add({ severity, summary, detail, life, styleClass, icon });
  }

  success(summary: string, detail?: string, life = 2000, styleClass?: string, icon?: string) {
    this.show('success', summary, detail, life, styleClass, icon);
  }
  info(summary: string, detail?: string, life = 2000, styleClass?: string, icon?: string) {
    this.show('info', summary, detail, life, styleClass, icon);
  }
  warn(summary: string, detail?: string, life = 2000, styleClass?: string, icon?: string) {
    this.show('warn', summary, detail, life, styleClass, icon);
  }
  error(summary: string, detail?: string, life = 2000, styleClass?: string, icon?: string) {
    this.show('error', summary, detail, life, styleClass, icon);
  }
}