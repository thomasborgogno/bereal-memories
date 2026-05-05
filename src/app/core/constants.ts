import { environment } from '../../environments/environment';

export const FIREBASE_API_KEY = environment.firebaseApiKey;
export const BEREAL_CLIENT_ID = 'ios';
export const BEREAL_CLIENT_SECRET = environment.berealClientSecret;
export const RECAPTCHA_SITE_KEY = environment.recaptchaSiteKey;
export const BEREAL_APP_VERSION = '4.24.0';
export const BEREAL_APP_VERSION_CODE = '20523';
/** HMAC-SHA256 key used to compute `bereal-signature` (hex-encoded). */
export const BEREAL_HMAC_KEY_HEX = environment.berealHmacKeyHex;
const DEVICE_ID_KEY = 'bereal_device_id';

/** Returns a persistent device UUID (created once, stored in localStorage). */
export function getOrCreateDeviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

export const FIREBASE_HEADERS = {
    'content-type': 'application/json',
    accept: '*/*',
    'x-client-version': 'iOS/FirebaseSDK/9.6.0/FirebaseCore-iOS',
    'x-ios-bundle-identifier': 'AlexisBarreyat.BeReal',
    'accept-language': 'en',
    'user-agent':
        'FirebaseAuth.iOS/9.6.0 AlexisBarreyat.BeReal/0.31.0 iPhone/14.7.1 hw/iPhone9_1',
    'x-firebase-locale': 'en',
    'x-firebase-gmpid': '1:405768487586:ios:28c4df089ca92b89',
};

/** Legacy headers kept for `refresh_token` calls (unchanged endpoint). */
export const BEREAL_HEADERS = {
    Accept: 'application/json',
    'User-Agent': 'BeReal/8586 CFNetwork/1240.0.4 Darwin/20.6.0',
    'x-ios-bundle-identifier': 'AlexisBarreyat.BeReal',
    'Content-Type': 'application/json',
};
