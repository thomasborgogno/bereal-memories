import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <footer class="donate-footer">
      <span class="donate-label">Support this project</span>
      <div class="donate-links">
        <a href="https://ko-fi.com/thomasborgogno" target="_blank" rel="noopener noreferrer" class="donate-btn kofi">
          ☕ Ko-fi
        </a>
        <a href="https://paypal.me/thomasborgogno" target="_blank" rel="noopener noreferrer" class="donate-btn paypal">
          💙 PayPal
        </a>
      </div>
    </footer>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .donate-footer {
      background: #111;
      border-top: 1px solid #222;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .donate-label {
      color: #666;
      font-size: 0.8rem;
    }
    .donate-links {
      display: flex;
      gap: 0.5rem;
    }
    .donate-btn {
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.4rem 0.9rem;
      text-decoration: none;
      transition: opacity 0.2s;
      &:hover {
        opacity: 0.85;
      }
    }
    .kofi {
      background: #FFDD00;
      color: #111;
    }
    .paypal {
      background: #009cde;
      color: #fff;
    }
  `]
})
export class App { }
