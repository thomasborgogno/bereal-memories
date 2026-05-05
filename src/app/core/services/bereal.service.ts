import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import piexif from 'piexifjs';
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
                const primaryJpeg = await this.blobToJpegWithExif(primaryBlob, memory, 'primary');
                zip.file(`${date}_primary.jpg`, primaryJpeg);
                added++;
            } catch (e) {
                console.error(`[zip] failed primary for ${date}:`, memory.primary.url, e);
            }
            done++;
            this.downloadProgress$.next(Math.round((done / total) * 100));

            try {
                const secondaryBlob = await this.fetchBlob(memory.secondary.url);
                const secondaryJpeg = await this.blobToJpegWithExif(secondaryBlob, memory, 'secondary');
                zip.file(`${date}_secondary.jpg`, secondaryJpeg);
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

    /** Convert a blob to JPEG and embed EXIF metadata */
    private async blobToJpegWithExif(
        blob: Blob,
        memory: Memory,
        label: 'primary' | 'secondary',
    ): Promise<Blob> {
        const objectUrl = URL.createObjectURL(blob);
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = objectUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);

            const exifDate = this.toExifDate(memory.takenAt ?? memory.memoryDay + 'T00:00:00.000Z');
            const description = `BeReal ${label} - ${memory.memoryDay}${memory.isLate ? ' (late)' : ''}`;

            const exifObj: { [ifd: string]: { [tag: number]: unknown } } = {
                '0th': {
                    [piexif.ImageIFD.DateTime]: exifDate,
                    [piexif.ImageIFD.ImageDescription]: description,
                },
                Exif: {
                    [piexif.ExifIFD.DateTimeOriginal]: exifDate,
                    [piexif.ExifIFD.DateTimeDigitized]: exifDate,
                    [piexif.ExifIFD.PixelXDimension]: img.naturalWidth,
                    [piexif.ExifIFD.PixelYDimension]: img.naturalHeight,
                    [piexif.ExifIFD.ColorSpace]: 1, // sRGB
                },
            };

            // gps data is fake, not working
            // if (memory.location) {
            //     const { latitude, longitude } = memory.location;
            //     console.log(`[zip] embedding GPS for ${memory.memoryDay}:`, latitude, longitude);
            //     exifObj['GPS'] = {
            //         [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
            //         [piexif.GPSIFD.GPSLatitude]: this.toDms(latitude),
            //         [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
            //         [piexif.GPSIFD.GPSLongitude]: this.toDms(longitude),
            //         [piexif.GPSIFD.GPSAltitudeRef]: 0, // above sea level
            //     };
            // }

            const exifStr = piexif.dump(exifObj);
            const withExif = piexif.insert(exifStr, jpegDataUrl);

            // Convert base64 data URL → Blob
            const binary = atob(withExif.split(',')[1]);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new Blob([bytes], { type: 'image/jpeg' });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    /** Convert an ISO date string to EXIF date format "YYYY:MM:DD HH:MM:SS" */
    private toExifDate(dateStr: string): string {
        const d = new Date(dateStr);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getUTCFullYear()}:${p(d.getUTCMonth() + 1)}:${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
    }

    /** Convert decimal degrees to EXIF DMS rational format */
    private toDms(decimal: number): [[number, number], [number, number], [number, number]] {
        const abs = Math.abs(decimal);
        const d = Math.floor(abs);
        const mFull = (abs - d) * 60;
        const m = Math.floor(mFull);
        const s = Math.round((mFull - m) * 60 * 100); // hundredths of seconds
        return [[d, 1], [m, 1], [s, 100]];
    }
}
