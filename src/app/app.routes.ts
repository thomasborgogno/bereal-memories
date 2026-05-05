import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./features/login/login.component').then((m) => m.LoginComponent),
    },
    {
        path: 'import',
        loadComponent: () =>
            import('./features/import/zip-import.component').then((m) => m.ZipImportComponent),
    },
    {
        path: 'memories',
        loadComponent: () =>
            import('./features/memories/memories.component').then(
                (m) => m.MemoriesComponent
            ),
        canActivate: [authGuard],
    },
    { path: '**', redirectTo: '' },
];
