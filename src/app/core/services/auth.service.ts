import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
    FIREBASE_API_KEY,
    BEREAL_CLIENT_ID,
    BEREAL_CLIENT_SECRET,
    FIREBASE_HEADERS,
    BEREAL_HEADERS,
    getOrCreateDeviceId,
} from '../constants';
import {
    DataExchangeResponse,
    VonageRequestResponse,
    VonageVerifyResponse,
    FirebaseTokenResponse,
    BeRealTokens,
} from '../models/auth.models';
import { SignatureService } from './signature.service';
import { RecaptchaService } from './recaptcha.service';

const STORAGE_KEY = 'bereal_tokens';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private tokens: BeRealTokens | null = null;
    readonly isAuthenticated = signal(false);

    constructor(
        private http: HttpClient,
        private signature: SignatureService,
        private recaptcha: RecaptchaService,
    ) {
        this.loadTokens();
    }

    private loadTokens(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.tokens = JSON.parse(raw) as BeRealTokens;
                this.isAuthenticated.set(true);
            }
        } catch {
            this.tokens = null;
        }
    }

    private saveTokens(tokens: BeRealTokens): void {
        this.tokens = tokens;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
        this.isAuthenticated.set(true);
    }

    getAccessToken(): string | null {
        return this.tokens?.access_token ?? null;
    }

    getRefreshToken(): string | null {
        return this.tokens?.refresh_token ?? null;
    }

    logout(): void {
        this.tokens = null;
        localStorage.removeItem(STORAGE_KEY);
        this.isAuthenticated.set(false);
    }

    /** Step 1a – Pre-flight: obtain dataExchange blob required for the CAPTCHA. */
    private async dataExchange(phoneNumber: string): Promise<string> {
        const deviceId = getOrCreateDeviceId();
        const headers = await this.signature.buildHeaders(deviceId);
        const response = await firstValueFrom(
            this.http.post<DataExchangeResponse>(
                '/bereal-auth/api/vonage/data-exchange',
                { phoneNumber },
                { headers: new HttpHeaders(headers) }
            )
        );
        return response.dataExchange;
    }

    /** Step 1 – Send OTP via Vonage (data-exchange + reCAPTCHA + request-code). */
    async requestOtp(phoneNumber: string): Promise<string> {
        const deviceId = getOrCreateDeviceId();

        // data-exchange is a pre-flight required by BeReal; result is not used
        // for reCAPTCHA (only for Arkose Labs), so we don't block on it.
        this.dataExchange(phoneNumber).catch(() => void 0);
        let recaptchaToken = '';
        try {
            recaptchaToken = await this.recaptcha.execute('send_otp');
        } catch (e) {
            console.warn('reCAPTCHA unavailable (blocked by browser/network), proceeding without token:', e);
        }

        const headers = await this.signature.buildHeaders(deviceId);
        const body: Record<string, unknown> = {
            phoneNumber,
            deviceId,
        };
        if (recaptchaToken) {
            body['tokens'] = [{ token: recaptchaToken, identifier: 'RE' }];
        }
        const response = await firstValueFrom(
            this.http.post<VonageRequestResponse>(
                '/bereal-auth/api/vonage/request-code',
                body,
                { headers: new HttpHeaders(headers) }
            )
        );
        return response.vonageRequestId;
    }

    /** Step 2 – Verify OTP, exchange for BeReal tokens */
    async verifyOtp(code: string, vonageRequestId: string): Promise<void> {
        const deviceId = getOrCreateDeviceId();

        // 2a. Verify OTP with Vonage → custom Firebase token
        const verifyHeaders = await this.signature.buildHeaders(deviceId);
        const vonageResp = await firstValueFrom(
            this.http.post<VonageVerifyResponse>(
                '/bereal-auth/api/vonage/check-code',
                { code, vonageRequestId },
                { headers: new HttpHeaders(verifyHeaders) }
            )
        );

        // 2b. Exchange Firebase custom token for id_token
        const firebaseResp = await firstValueFrom(
            this.http.post<FirebaseTokenResponse>(
                `/identitytoolkit-api/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
                { token: vonageResp.token, returnSecureToken: true },
                { headers: new HttpHeaders(FIREBASE_HEADERS) }
            )
        );

        // 2c. Exchange Firebase id_token for BeReal access + refresh tokens
        const tokenHeaders = await this.signature.buildHeaders(deviceId);
        const berealTokens = await firstValueFrom(
            this.http.post<BeRealTokens>(
                '/bereal-auth/token?grant_type=firebase',
                {
                    grant_type: 'firebase',
                    client_id: BEREAL_CLIENT_ID,
                    client_secret: BEREAL_CLIENT_SECRET,
                    token: firebaseResp.idToken,
                },
                { headers: new HttpHeaders(tokenHeaders) }
            )
        );

        this.saveTokens(berealTokens);
    }

    /** Refresh the BeReal access token using the stored refresh token */
    async refreshToken(): Promise<void> {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            this.logout();
            throw new Error('No refresh token available');
        }

        const tokens = await firstValueFrom(
            this.http.post<BeRealTokens>(
                '/bereal-auth/token?grant_type=refresh_token',
                {
                    grant_type: 'refresh_token',
                    client_id: BEREAL_CLIENT_ID,
                    client_secret: BEREAL_CLIENT_SECRET,
                    refresh_token: refreshToken,
                },
                { headers: new HttpHeaders(BEREAL_HEADERS) }
            )
        );

        this.saveTokens(tokens);
    }
}

