import { Component, Input } from '@angular/core';
import { Memory } from '../../core/models/memory.models';

@Component({
  selector: 'app-memory-card',
  standalone: true,
  template: `
    <div class="card"
         [class.bereal-mode]="berealMode"
         (mouseenter)="showSecondary = true"
         (mouseleave)="showSecondary = false">

      <!-- Main image (always primary in BeReal mode, toggles on hover otherwise) -->
      <img
        class="main-img"
        [src]="proxyUrl(berealMode ? memory.primary.url : (showSecondary ? memory.secondary.url : memory.primary.url))"
        [alt]="memory.memoryDay"
        loading="lazy"
      />

      <!-- PiP selfie overlay – only visible in BeReal mode -->
      @if (berealMode) {
      <div class="pip">
        <img
          [src]="proxyUrl(memory.secondary.url)"
          [alt]="memory.memoryDay + ' selfie'"
          loading="lazy"
        />
      </div>
      }

      <div class="badge">{{ memory.memoryDay }}</div>

      @if (!berealMode) {
      <div class="hover-hint">{{ showSecondary ? 'Selfie' : 'World' }}</div>
      }

      @if (memory.location) {
      <div class="location-badge" [title]="locationTitle()">📍</div>
      }
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

      .main-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: opacity 0.2s;
      }

      /* PiP selfie: top-left, 30% width, matches BeReal app layout */
      .pip {
        position: absolute;
        top: 4%;
        left: 4%;
        width: 30%;
        aspect-ratio: 3 / 4;
        border-radius: 8%;
        border: 2px solid #000;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
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

      .location-badge {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 6px;
        font-size: 0.8rem;
        padding: 2px 5px;
      }
    }
  `],
})
export class MemoryCardComponent {
  @Input({ required: true }) memory!: Memory;
  @Input() berealMode = false;
  showSecondary = false;

  locationTitle(): string {
    if (!this.memory.location) return '';
    const { latitude, longitude } = this.memory.location;
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }

  proxyUrl(url: string): string {
    return url
      .replace(/^https?:\/\/storage\.bere\.al/, '/bereal-storage')
      .replace(/^https?:\/\/cdn-[a-z0-9]+\.bereal\.network/, '/bereal-cdn');
  }
}