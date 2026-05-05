import { Injectable } from '@angular/core';
import {
    BEREAL_APP_VERSION,
    BEREAL_APP_VERSION_CODE,
    BEREAL_HMAC_KEY_HEX,
} from '../constants';

@Injectable({ providedIn: 'root' })
export class SignatureService {
    private hmacKey: CryptoKey | null = null;

    private hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
        const bytes = new Uint8Array(hex.length / 2) as Uint8Array<ArrayBuffer>;
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
        }
        return bytes;
    }

    private async getKey(): Promise<CryptoKey> {
        if (!this.hmacKey) {
            this.hmacKey = await crypto.subtle.importKey(
                'raw',
                this.hexToBytes(BEREAL_HMAC_KEY_HEX),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
        }
        return this.hmacKey;
    }

    /**
     * Computes the `bereal-signature` header value.
     * Format: base64( utf8("1:{timestamp}:") + HMAC-SHA256(base64(deviceId+timezone+timestamp)) )
     */
    async computeSignature(deviceId: string, timezone: string, timestamp: number): Promise<string> {
        const payload = `${deviceId}${timezone}${timestamp}`;
        const payloadB64 = btoa(unescape(encodeURIComponent(payload)));

        const key = await this.getKey();
        const hashBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(payloadB64)
        );

        const prefix = new TextEncoder().encode(`1:${timestamp}:`);
        const combined = new Uint8Array(prefix.length + hashBuffer.byteLength);
        combined.set(prefix, 0);
        combined.set(new Uint8Array(hashBuffer), prefix.length);

        return btoa(String.fromCharCode(...combined));
    }

    /** Builds the full set of `bereal-*` headers required by auth-l7.bereal.com. */
    async buildHeaders(deviceId: string): Promise<Record<string, string>> {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await this.computeSignature(deviceId, timezone, timestamp);

        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'bereal-platform': 'iOS',
            'bereal-os-version': '19.0',
            'bereal-app-version': BEREAL_APP_VERSION,
            'bereal-app-version-code': BEREAL_APP_VERSION_CODE,
            'bereal-device-language': 'en',
            'bereal-app-language': 'en-US',
            'bereal-timezone': timezone,
            'bereal-device-id': deviceId,
            'bereal-signature': signature,
            'user-agent': `BeReal/${BEREAL_APP_VERSION} (AlexisBarreyat.BeReal; build:${BEREAL_APP_VERSION_CODE}; iOS 19.0.0)`,
        };
    }
}
