import { Injectable } from '@angular/core';
import { RECAPTCHA_SITE_KEY } from '../constants';

declare const grecaptcha: {
    ready(cb: () => void): void;
    execute(siteKey: string, options: { action: string }): Promise<string>;
};

const LOAD_TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class RecaptchaService {
    private loadPromise: Promise<void> | null = null;

    /** Lazily injects the reCAPTCHA v3 script and resolves when ready. */
    private load(): Promise<void> {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error('reCAPTCHA script load timed out')),
                LOAD_TIMEOUT_MS
            );

            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
            script.onload = () => {
                grecaptcha.ready(() => {
                    clearTimeout(timer);
                    resolve();
                });
            };
            script.onerror = () => {
                clearTimeout(timer);
                this.loadPromise = null;
                reject(new Error('Failed to load reCAPTCHA script'));
            };
            document.head.appendChild(script);
        });

        return this.loadPromise;
    }

    /** Returns a fresh reCAPTCHA v3 token for the given action. */
    async execute(action = 'login'): Promise<string> {
        await this.load();
        return grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    }
}
