import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { BerealService } from '../../core/services/bereal.service';
import { Memory } from '../../core/models/memory.models';
import { MemoryCardComponent } from './memory-card.component';

@Component({
    selector: 'app-memories',
    standalone: true,
    imports: [MemoryCardComponent],
    templateUrl: './memories.component.html',
    styleUrl: './memories.component.scss',
})
export class MemoriesComponent implements OnInit, OnDestroy {
    readonly memories = signal<Memory[]>([]);
    readonly loading = signal(true);
    readonly loadError = signal<string | null>(null);
    readonly progress = signal<number | null>(null);

    private progressSub?: Subscription;

    constructor(
        private bereal: BerealService,
        private auth: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.progressSub = this.bereal.downloadProgress$.subscribe((v) =>
            this.progress.set(v)
        );
        this.loadMemories();
    }

    ngOnDestroy(): void {
        this.progressSub?.unsubscribe();
    }

    async loadMemories(): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const data = await this.bereal.getAllMemories();
            this.memories.set(data);
        } catch (err: unknown) {
            this.loadError.set(
                err instanceof Error ? err.message : 'Failed to load memories.'
            );
        } finally {
            this.loading.set(false);
        }
    }

    async downloadAll(): Promise<void> {
        await this.bereal.downloadAllAsZip(this.memories());
    }

    logout(): void {
        this.auth.logout();
        this.router.navigate(['/']);
    }
}
