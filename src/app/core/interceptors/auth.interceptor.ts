import {
    HttpInterceptorFn,
    HttpHandlerFn,
    HttpRequest,
    HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, from, switchMap, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
) => {
    const auth = inject(AuthService);

    // Only attach auth header to BeReal API calls
    if (!req.url.startsWith('/bereal-api')) {
        return next(req);
    }

    const token = auth.getAccessToken();
    const authReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                // Try to refresh token once then retry
                return from(auth.refreshToken()).pipe(
                    switchMap(() => {
                        const newToken = auth.getAccessToken();
                        const retryReq = newToken
                            ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
                            : req;
                        return next(retryReq);
                    }),
                    catchError((refreshError) => {
                        auth.logout();
                        return throwError(() => refreshError);
                    })
                );
            }
            return throwError(() => error);
        })
    );
};
