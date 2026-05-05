import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
    FIREBASE_API_KEY,
    BEREAL_CLIENT_ID,
    BEREAL_CLIENT_SECRET,
    FIREBASE_HEADERS,
    BEREAL_HEADERS,
} from '../constants';
import {
    VonageRequestResponse,
    VonageVerifyResponse,
    FirebaseTokenResponse,
    BeRealTokens,
} from '../models/auth.models';

const STORAGE_KEY = 'bereal_tokens';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private tokens: BeRealTokens | null = null;
    readonly isAuthenticated = signal(false);

    constructor(private http: HttpClient) {
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

    /** Step 1 – Send OTP via Vonage */
    async requestOtp(phoneNumber: string): Promise<string> {
        const body = { phoneNumber, deviceId: crypto.randomUUID() };
        const response = await firstValueFrom(
            this.http.post<VonageRequestResponse>(
                '/bereal-auth/api/vonage/request-code',
                body,
                { headers: new HttpHeaders(BEREAL_HEADERS) }
            )
        );
        return response.vonageRequestId;
    }

    /** Step 2 – Verify OTP, exchange for BeReal tokens */
    async verifyOtp(code: string, vonageRequestId: string): Promise<void> {
        // 2a. Verify OTP with Vonage → custom Firebase token
        const verifyBody = { code, vonageRequestId };
        const vonageResp = await firstValueFrom(
            this.http.post<VonageVerifyResponse>(
                '/bereal-auth/api/vonage/check-code',
                verifyBody,
                { headers: new HttpHeaders(BEREAL_HEADERS) }
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
        const berealBody = {
            grant_type: 'firebase',
            client_id: BEREAL_CLIENT_ID,
            client_secret: BEREAL_CLIENT_SECRET,
            token: firebaseResp.idToken,
        };
        const berealTokens = await firstValueFrom(
            this.http.post<BeRealTokens>(
                '/bereal-auth/token?grant_type=firebase',
                berealBody,
                { headers: new HttpHeaders(BEREAL_HEADERS) }
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

        const body = {
            grant_type: 'refresh_token',
            client_id: BEREAL_CLIENT_ID,
            client_secret: BEREAL_CLIENT_SECRET,
            refresh_token: refreshToken,
        };

        const tokens = await firstValueFrom(
            this.http.post<BeRealTokens>(
                '/bereal-auth/token?grant_type=refresh_token',
                body,
                { headers: new HttpHeaders(BEREAL_HEADERS) }
            )
        );

        this.saveTokens(tokens);
    }
}
