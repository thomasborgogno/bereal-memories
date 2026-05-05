import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Memory, MemoriesFeedResponse } from '../models/memory.models';

@Injectable({ providedIn: 'root' })
export class BerealService {
    readonly downloadProgress$ = new BehaviorSubject<number | null>(null);

    constructor(private http: HttpClient) { }

    /** Fetch all memories pages until there is no next cursor */
    async getAllMemories(): Promise<Memory[]> {
        const all: Memory[] = [];
        let cursor: string | undefined;
        let page = 0;
        const MAX_PAGES = 200;

        do {
            if (page++ >= MAX_PAGES) {
                console.warn(`getAllMemories: reached ${MAX_PAGES} pages limit, stopping.`);
                break;
            }

            const params: Record<string, string> = { limit: '50' };
            if (cursor) params['next'] = cursor;

            const resp = await firstValueFrom(
                this.http.get<MemoriesFeedResponse>('/bereal-api/feeds/memories', { params })
            );

            if (resp.data?.length) {
                all.push(...resp.data);
            }
            cursor = resp.next || undefined;
        } while (cursor);

        return all;
    }

    /** Rewrite a storage.bere.al URL to go through the dev proxy */
    private proxyImageUrl(url: string): string {
        return url.replace(/^https?:\/\/storage\.bere\.al/, '/bereal-storage');
    }

    private async fetchBlob(url: string): Promise<Blob> {
        return firstValueFrom(
            this.http.get(this.proxyImageUrl(url), { responseType: 'blob' })
        );
    }

    /** Download all memories (primary + secondary) as a single ZIP file */
    async downloadAllAsZip(memories: Memory[]): Promise<void> {
        const zip = new JSZip();
        const total = memories.length * 2; // primary + secondary per memory
        let done = 0;

        this.downloadProgress$.next(0);

        for (const memory of memories) {
            const date = memory.memoryDay ?? memory.takenAt?.slice(0, 10) ?? memory.id;

            try {
                const primaryBlob = await this.fetchBlob(memory.primary.url);
                zip.file(`${date}_primary.jpg`, primaryBlob);
            } catch {
                // skip failed images silently
            }
            done++;
            this.downloadProgress$.next(Math.round((done / total) * 100));

            try {
                const secondaryBlob = await this.fetchBlob(memory.secondary.url);
                zip.file(`${date}_secondary.jpg`, secondaryBlob);
            } catch {
                // skip failed images silently
            }
            done++;
            this.downloadProgress$.next(Math.round((done / total) * 100));
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'bereal-memories.zip');
        this.downloadProgress$.next(null);
    }
}
