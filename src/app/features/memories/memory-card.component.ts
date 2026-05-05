import { Component, Input } from '@angular/core';
import { Memory } from '../../core/models/memory.models';

@Component({
  selector: 'app-memory-card',
  standalone: true,
  template: `
    <div class="card" (mouseenter)="showSecondary = true" (mouseleave)="showSecondary = false">
      <img
        [src]="proxyUrl(showSecondary ? memory.secondary.url : memory.primary.url)"
        [alt]="memory.memoryDay"
        loading="lazy"
      />
      <div class="badge">{{ memory.memoryDay }}</div>
      <div class="hover-hint">{{ showSecondary ? 'Selfie' : 'World' }}</div>
    </div>
  `,
  styles: [`
    .card {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 3 / 4;
      background: #1a1a1a;
      cursor: pointer;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: opacity 0.2s;
      }

      .badge {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 6px;
        color: #fff;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 3px 7px;
      }

      .late-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(255, 80, 80, 0.85);
        border-radius: 6px;
        color: #fff;
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .hover-hint {
        position: absolute;
        top: 8px;
        left: 8px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: #fff;
        font-size: 0.68rem;
        padding: 2px 6px;
      }
    }
  `],
})
export class MemoryCardComponent {
  @Input({ required: true }) memory!: Memory;
  showSecondary = false;

  proxyUrl(url: string): string {
    return url.replace(/^https?:\/\/storage\.bere\.al/, '/bereal-storage');
  }
}
