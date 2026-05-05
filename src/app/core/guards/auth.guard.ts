import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LocalMemoriesService } from '../services/local-memories.service';

export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const localMemories = inject(LocalMemoriesService);
    const router = inject(Router);

    if (auth.isAuthenticated() || localMemories.isLocalMode()) {
        return true;
    }
    return router.createUrlTree(['/']);
};
