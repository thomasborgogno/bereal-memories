import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { BerealService } from '../../core/services/bereal.service';
import { LocalMemoriesService } from '../../core/services/local-memories.service';
import { Memory } from '../../core/models/memory.models';
import { MemoryCardComponent } from './memory-card.component';

@Component({
    selector: 'app-memories',
    standalone: true,
    imports: [MemoryCardComponent, FormsModule],
    templateUrl: './memories.component.html',
    styleUrl: './memories.component.scss',
})
export class MemoriesComponent implements OnInit, OnDestroy {
    readonly memories = signal<Memory[]>([]);
    readonly loading = signal(true);
    readonly loadError = signal<string | null>(null);
    readonly progress = signal<number | null>(null);

    readonly dateFrom = signal('');
    readonly dateTo = signal('');

    readonly filteredMemories = computed(() => {
        const all = this.memories();
        const from = this.dateFrom() ? new Date(this.dateFrom()) : null;
        const to = this.dateTo() ? new Date(this.dateTo() + 'T23:59:59') : null;
        if (!from && !to) return all;
        return all.filter((m) => {
            const d = new Date(m.memoryDay ?? m.takenAt ?? m.id);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    });

    private progressSub?: Subscription;

    constructor(
        private bereal: BerealService,
        private auth: AuthService,
        readonly localMemories: LocalMemoriesService,
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
            if (this.localMemories.isLocalMode()) {
                this.memories.set(this.localMemories.memories());
                return;
            }
            const data = await this.bereal.getAllMemories();
            if (data.length > 0) {
                console.log('[memories] first item keys:', Object.keys(data[0]));
                console.log('[memories] first item:', data[0]);
            }
            this.memories.set(data);
        } catch (err: unknown) {
            this.loadError.set(this.extractMessage(err));
        } finally {
            this.loading.set(false);
        }
    }

    clearFilter(): void {
        this.dateFrom.set('');
        this.dateTo.set('');
    }

    async downloadAll(): Promise<void> {
        try {
            await this.bereal.downloadAllAsZip(this.filteredMemories());
        } catch (err: unknown) {
            this.loadError.set(this.extractMessage(err));
        }
    }

    logout(): void {
        if (this.localMemories.isLocalMode()) {
            this.localMemories.clear();
        } else {
            this.auth.logout();
        }
        this.router.navigate(['/']);
    }

    private extractMessage(err: unknown): string {
        if (err instanceof HttpErrorResponse) {
            let body: string;
            try {
                body = typeof err.error === 'string' ? err.error : JSON.stringify(err.error, null, 2);
            } catch {
                body = String(err.error);
            }
            return `[${err.status} ${err.statusText}] ${err.url ?? ''}
${body}`;
        }
        if (err instanceof Error) return err.message;
        return 'Failed to load memories.';
    }
}
