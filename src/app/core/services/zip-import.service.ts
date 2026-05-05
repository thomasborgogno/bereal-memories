import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { Memory } from '../models/memory.models';
import { LocalMemoriesService } from './local-memories.service';

interface PostsJsonPhotoRef {
    path?: string;
    width?: number;
    height?: number;
    mimeType?: string;
}

interface PostsJsonEntry {
    id?: string;
    takenAt?: string;
    isLate?: boolean;
    primary?: PostsJsonPhotoRef;
    secondary?: PostsJsonPhotoRef;
    location?: { latitude?: number; longitude?: number };
}

@Injectable({ providedIn: 'root' })
export class ZipImportService {
    /** Blob URLs created during the last import. Revoked on the next import. */
    private blobUrls: string[] = [];

    constructor(private localMemories: LocalMemoriesService) { }

    async parseExportZip(
        file: File,
        onProgress?: (pct: number) => void
    ): Promise<void> {
        this.revokePreviousBlobUrls();

        const zip = await JSZip.loadAsync(file);

        const postsFile =
            zip.file('posts.json') ??
            zip.file(/^posts\.json$/i)[0];

        if (!postsFile) {
            throw new Error(
                'posts.json not found in ZIP.\n' +
                'Make sure you are uploading "BeReal Profile Activity&Data.zip", not "BeReal Data Export.json.gz".'
            );
        }

        const postsText = await postsFile.async('string');
        let rawParsed: unknown;
        try {
            rawParsed = JSON.parse(postsText);
        } catch {
            throw new Error('posts.json is not valid JSON.');
        }

        // Support both array format (real export) and { posts: [] } format
        const posts: PostsJsonEntry[] = Array.isArray(rawParsed)
            ? (rawParsed as PostsJsonEntry[])
            : ((rawParsed as { posts?: PostsJsonEntry[] }).posts ?? []);

        if (posts.length === 0) {
            throw new Error('posts.json contains no posts. The file may be from a different BeReal export format.');
        }

        // Build a path → JSZipObject map for O(1) lookup
        // Keys are ZIP-relative paths with no leading slash, e.g. "Photos/uid/bereal/file.jpg"
        const fileMap = new Map<string, JSZip.JSZipObject>();
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                fileMap.set(relativePath, zipEntry);
            }
        });

        const memories: Memory[] = [];
        const total = posts.length;

        for (let i = 0; i < total; i++) {
            const post = posts[i];
            onProgress?.(Math.round((i / total) * 100));

            if (!post.takenAt) {
                console.warn('[zip-import] Post missing takenAt, skipping:', post);
                continue;
            }

            const takenAt = post.takenAt;
            const memoryDay = takenAt.slice(0, 10); // YYYY-MM-DD

            const primaryMime = post.primary?.mimeType ?? 'image/jpeg';
            const secondaryMime = post.secondary?.mimeType ?? 'image/jpeg';

            const primaryUrl = await this.resolveBlobUrl(fileMap, post.primary?.path, primaryMime);
            const secondaryUrl = await this.resolveBlobUrl(fileMap, post.secondary?.path, secondaryMime);

            if (!primaryUrl && !secondaryUrl) {
                console.warn('[zip-import] No images found for post at', takenAt, '— paths:', post.primary?.path, post.secondary?.path);
                continue;
            }

            const fallback = primaryUrl ?? secondaryUrl ?? '';

            const memory: Memory = {
                id: post.id ?? `local-${i}`,
                memoryDay,
                takenAt,
                isLate: post.isLate ?? false,
                primary: {
                    url: primaryUrl ?? fallback,
                    width: post.primary?.width ?? 0,
                    height: post.primary?.height ?? 0,
                },
                secondary: {
                    url: secondaryUrl ?? fallback,
                    width: post.secondary?.width ?? 0,
                    height: post.secondary?.height ?? 0,
                },
                thumbnail: {
                    url: primaryUrl ?? fallback,
                    width: post.primary?.width ?? 0,
                    height: post.primary?.height ?? 0,
                },
                ...(post.location?.latitude != null && post.location.longitude != null
                    ? { location: { latitude: post.location.latitude, longitude: post.location.longitude } }
                    : {}),
            };

            memories.push(memory);
        }

        onProgress?.(100);

        if (memories.length === 0) {
            throw new Error('No valid memories could be parsed from the ZIP file.');
        }

        // Sort newest first (same order as API)
        memories.sort((a, b) => (b.memoryDay > a.memoryDay ? 1 : -1));

        this.localMemories.setMemories(memories);
    }

    /**
     * Resolve a blob URL from a posts.json path value.
     *
     * posts.json paths: "/Photos/{userId}/{subfolder}/{file}"
     * ZIP entries:      "Photos/{subfolder}/{file}"   (user ID segment is stripped by BeReal)
     *
     * We drop segment index 1 (the user ID) to obtain the ZIP-relative path.
     */
    private async resolveBlobUrl(
        fileMap: Map<string, JSZip.JSZipObject>,
        path: string | undefined,
        mimeType: string
    ): Promise<string | null> {
        if (!path) return null;

        // Strip leading slash then remove the userId segment:
        // "/Photos/userId/post/file.webp" → ["Photos","userId","post","file.webp"]
        //   → drop index 1 → "Photos/post/file.webp"
        const segments = path.replace(/^\//, '').split('/');
        if (segments.length >= 3) {
            segments.splice(1, 1); // remove userId
        }
        const zipPath = segments.join('/');

        const entry = fileMap.get(zipPath);
        if (!entry) {
            console.warn('[zip-import] File not found in ZIP:', zipPath, '(original path:', path, ')');
            return null;
        }
        const buffer = await entry.async('arraybuffer');
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        this.blobUrls.push(url);
        return url;
    }

    private revokePreviousBlobUrls(): void {
        for (const url of this.blobUrls) {
            URL.revokeObjectURL(url);
        }
        this.blobUrls = [];
    }
}