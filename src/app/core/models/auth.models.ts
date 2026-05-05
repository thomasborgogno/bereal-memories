export interface VonageRequestResponse {
    vonageRequestId: string;
}

export interface VonageVerifyResponse {
    status: number;
    token: string;
    uid: string;
}

export interface FirebaseTokenResponse {
    idToken: string;
    refreshToken: string;
    localId: string;
    expiresIn: string;
}

export interface BeRealTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
}
