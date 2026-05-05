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

    /** Download all memories as a single ZIP file.
     *  mode 'separate' → BeReal_{date}_primary.jpg + BeReal_{date}_secondary.jpg per memory
     *  mode 'bereal'   → BeReal_{date}.jpg composite (selfie overlaid top-left)
     */
    async downloadAllAsZip(memories: Memory[], mode: 'separate' | 'bereal' = 'separate'): Promise<void> {
        const zip = new JSZip();
        const total = mode === 'bereal' ? memories.length : memories.length * 2;
        let done = 0;
        let added = 0;

        this.downloadProgress$.next(0);

        for (const memory of memories) {
            const date = memory.memoryDay ?? memory.takenAt?.slice(0, 10) ?? memory.id;

            if (mode === 'bereal') {
                try {
                    const [primaryBlob, secondaryBlob] = await Promise.all([
                        this.fetchBlob(memory.primary.url),
                        this.fetchBlob(memory.secondary.url),
                    ]);
                    const composite = await this.compositeBerealPiP(primaryBlob, secondaryBlob, memory);
                    zip.file(`BeReal_${date}.jpg`, composite);
                    added++;
                } catch (e) {
                    console.error(`[zip] failed composite for ${date}:`, e);
                }
                done++;
                this.downloadProgress$.next(Math.round((done / total) * 100));
            } else {
                try {
                    const primaryBlob = await this.fetchBlob(memory.primary.url);
                    const primaryJpeg = await this.blobToJpegWithExif(primaryBlob, memory, 'primary');
                    zip.file(`BeReal_${date}_primary.jpg`, primaryJpeg);
                    added++;
                } catch (e) {
                    console.error(`[zip] failed primary for ${date}:`, memory.primary.url, e);
                }
                done++;
                this.downloadProgress$.next(Math.round((done / total) * 100));

                try {
                    const secondaryBlob = await this.fetchBlob(memory.secondary.url);
                    const secondaryJpeg = await this.blobToJpegWithExif(secondaryBlob, memory, 'secondary');
                    zip.file(`BeReal_${date}_secondary.jpg`, secondaryJpeg);
                    added++;
                } catch (e) {
                    console.error(`[zip] failed secondary for ${date}:`, memory.secondary.url, e);
                }
                done++;
                this.downloadProgress$.next(Math.round((done / total) * 100));
            }
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

    /** Composite primary + secondary into a BeReal-style picture-in-picture JPEG.
     *  Selfie is overlaid top-left at ~30% width with rounded corners + black border. */
    private async compositeBerealPiP(primaryBlob: Blob, secondaryBlob: Blob, memory: Memory): Promise<Blob> {
        const [primaryImg, secondaryImg] = await Promise.all([
            this.loadImageFromBlob(primaryBlob),
            this.loadImageFromBlob(secondaryBlob),
        ]);

        const canvas = document.createElement('canvas');
        canvas.width = primaryImg.naturalWidth;
        canvas.height = primaryImg.naturalHeight;
        const ctx = canvas.getContext('2d')!;

        // Draw main (world) photo full-size
        ctx.drawImage(primaryImg, 0, 0);

        // PiP dimensions: selfie at 30% of main width, maintaining selfie's aspect ratio
        const pipW = Math.round(canvas.width * 0.30);
        const pipH = Math.round(pipW * (secondaryImg.naturalHeight / secondaryImg.naturalWidth));
        const margin = Math.round(canvas.width * 0.025);
        const radius = Math.round(pipW * 0.08);
        const borderW = Math.max(3, Math.round(pipW * 0.012));
        const x = margin;
        const y = margin;

        // Clip-draw selfie with rounded corners
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, pipW, pipH, radius);
        ctx.clip();
        ctx.drawImage(secondaryImg, x, y, pipW, pipH);
        ctx.restore();

        // Black border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = borderW;
        ctx.beginPath();
        ctx.roundRect(x + borderW / 2, y + borderW / 2, pipW - borderW, pipH - borderW, radius);
        ctx.stroke();

        // Embed EXIF on the composite
        const exifDate = this.toExifDate(memory.takenAt ?? memory.memoryDay + 'T00:00:00.000Z');
        const description = `BeReal - ${memory.memoryDay}${memory.isLate ? ' (late)' : ''}`;
        const exifObj: { [ifd: string]: { [tag: number]: unknown } } = {
            '0th': {
                [piexif.ImageIFD.DateTime]: exifDate,
                [piexif.ImageIFD.ImageDescription]: description,
            },
            Exif: {
                [piexif.ExifIFD.DateTimeOriginal]: exifDate,
                [piexif.ExifIFD.DateTimeDigitized]: exifDate,
                [piexif.ExifIFD.PixelXDimension]: canvas.width,
                [piexif.ExifIFD.PixelYDimension]: canvas.height,
                [piexif.ExifIFD.ColorSpace]: 1,
            },
            ...this.buildGpsExif(memory),
        };
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const withExif = piexif.insert(piexif.dump(exifObj), jpegDataUrl);
        const binary = atob(withExif.split(',')[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: 'image/jpeg' });
    }

    private loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
        const url = URL.createObjectURL(blob);
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
            img.src = url;
        });
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
                ...this.buildGpsExif(memory),
            };

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

    /** Build the GPS IFD object if the memory has location data, otherwise return {}. */
    private buildGpsExif(memory: Memory): { GPS?: { [tag: number]: unknown } } {
        if (!memory.location) return {};
        const { latitude, longitude } = memory.location;

        // Encode decimal degrees as a single rational [deg × 1e7, 1e7] with minutes=0, seconds=0.
        // This is valid EXIF and avoids any DMS conversion arithmetic.
        // const toRational = (deg: number): [[number, number], [number, number], [number, number]] =>
        //     [[Math.round(Math.abs(deg) * 1e7), 1e7], [0, 1], [0, 1]];
        const toRational = (decimal: number): [[number, number], [number, number], [number, number]] => {
            const absolute = Math.abs(decimal);
            const degrees = Math.floor(absolute);
            const minutesDecimal = (absolute - degrees) * 60;
            const minutes = Math.floor(minutesDecimal);
            const seconds = Math.round((minutesDecimal - minutes) * 60 * 100); // Precisione al centesimo di secondo

            return [
                [degrees, 1],
                [minutes, 1],
                [seconds, 100]
            ];
        };
        return {
            GPS: {
                [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
                [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
                [piexif.GPSIFD.GPSLatitude]: toRational(latitude),
                [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
                [piexif.GPSIFD.GPSLongitude]: toRational(longitude),
            },
        };
    }
}
