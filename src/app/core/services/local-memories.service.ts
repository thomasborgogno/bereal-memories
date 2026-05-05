import { Injectable, Signal, computed, signal } from '@angular/core';
import { Memory } from '../models/memory.models';

@Injectable({ providedIn: 'root' })
export class LocalMemoriesService {
    private readonly _memories = signal<Memory[]>([]);

    readonly memories: Signal<Memory[]> = this._memories.asReadonly();
    readonly isLocalMode: Signal<boolean> = computed(() => this._memories().length > 0);

    setMemories(memories: Memory[]): void {
        this._memories.set(memories);
    }

    clear(): void {
        this._memories.set([]);
    }
}
