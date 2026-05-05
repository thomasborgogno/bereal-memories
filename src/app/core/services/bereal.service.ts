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
        // Track cursors we've already *sent* as request params to avoid re-fetching the same page
        const usedCursors = new Set<string>();
        const FIRST_PAGE_KEY = '__first__';

        do {
            if (page++ >= MAX_PAGES) {
                console.warn(`getAllMemories: reached ${MAX_PAGES} pages limit, stopping.`);
                break;
            }

            const cursorKey = cursor ?? FIRST_PAGE_KEY;
            if (usedCursors.has(cursorKey)) {
                console.warn('[memories] already fetched with cursor, stopping:', cursor);
                break;
            }
            usedCursors.add(cursorKey);

            const params: Record<string, string> = { limit: '50' };
            if (cursor) params['from'] = cursor;

            const resp = await firstValueFrom(
                this.http.get<MemoriesFeedResponse>('/bereal-api/feeds/memories', { params })
            );

            console.log(`[memories] page ${page}, data=${resp.data?.length ?? 0}, next=${resp.next}`);

            if (resp.data?.length) {
                all.push(...resp.data);
            }

            cursor = resp.next || undefined;
        } while (cursor);

        // Deduplicate by memoryDay (BeReal is one memory per day) as safety net
        const seen = new Set<string>();
        const deduped: Memory[] = [];
        for (const m of all) {
            const key = m.memoryDay ?? m.takenAt ?? m.id;
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(m);
            }
        }

        console.log(`[memories] total fetched=${all.length}, after dedup=${deduped.length}`);
        return deduped;
    }

    /** Rewrite CDN URLs to go through the dev proxy (avoids CORS). */
    private proxyImageUrl(url: string): string {
        return url
            .replace(/^https?:\/\/storage\.bere\.al/, '/bereal-storage')
            .replace(/^https?:\/\/cdn-[a-z0-9]+\.bereal\.network/, '/bereal-cdn');
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
        let added = 0;

        this.downloadProgress$.next(0);

        for (const memory of memories) {
            const date = memory.memoryDay ?? memory.takenAt?.slice(0, 10) ?? memory.id;

            try {
                const primaryBlob = await this.fetchBlob(memory.primary.url);
                zip.file(`${date}_primary.jpg`, primaryBlob);
                added++;
            } catch (e) {
                console.error(`[zip] failed primary for ${date}:`, memory.primary.url, e);
            }
            done++;
            this.downloadProgress$.next(Math.round((done / total) * 100));

            try {
                const secondaryBlob = await this.fetchBlob(memory.secondary.url);
                zip.file(`${date}_secondary.jpg`, secondaryBlob);
                added++;
            } catch (e) {
                console.error(`[zip] failed secondary for ${date}:`, memory.secondary.url, e);
            }
            done++;
            this.downloadProgress$.next(Math.round((done / total) * 100));
        }

        console.log(`[zip] files added: ${added} / ${total}`);

        if (added === 0) {
            this.downloadProgress$.next(null);
            throw new Error(`Could not download any image. Check the console for details.`);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'bereal-memories.zip');
        this.downloadProgress$.next(null);
    }
}
