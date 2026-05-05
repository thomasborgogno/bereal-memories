import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ZipImportService } from '../../core/services/zip-import.service';

@Component({
    selector: 'app-zip-import',
    standalone: true,
    templateUrl: './zip-import.component.html',
    styleUrl: './zip-import.component.scss',
})
export class ZipImportComponent {
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    readonly loading = signal(false);
    readonly progress = signal<number | null>(null);
    readonly error = signal<string | null>(null);
    readonly isDragOver = signal(false);
    readonly showHelp = signal(false);

    constructor(
        private zipImport: ZipImportService,
        private router: Router
    ) { }

    openFilePicker(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) this.processFile(file);
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(true);
    }

    onDragLeave(): void {
        this.isDragOver.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(false);
        const file = event.dataTransfer?.files[0];
        if (file) this.processFile(file);
    }

    private async processFile(file: File): Promise<void> {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            this.error.set('Please upload a .zip file — "BeReal Profile Activity&Data.zip".');
            return;
        }

        this.error.set(null);
        this.loading.set(true);
        this.progress.set(0);

        try {
            await this.zipImport.parseExportZip(file, (pct) => this.progress.set(pct));
            this.router.navigate(['/memories']);
        } catch (err: unknown) {
            this.error.set(err instanceof Error ? err.message : 'Failed to read ZIP file.');
            this.progress.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    goBack(): void {
        this.router.navigate(['/']);
    }
}
