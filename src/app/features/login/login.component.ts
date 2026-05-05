import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type Step = 'phone' | 'otp';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
})
export class LoginComponent {
    phoneNumber = '+393473577388';
    otpCode = '';

    readonly step = signal<Step>('phone');
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    private vonageRequestId = '';

    constructor(
        private auth: AuthService,
        private router: Router
    ) { }

    async onRequestOtp(): Promise<void> {
        this.error.set(null);
        this.loading.set(true);
        try {
            this.vonageRequestId = await this.auth.requestOtp(this.phoneNumber);
            this.step.set('otp');
        } catch (err: unknown) {
            this.error.set(this.extractMessage(err, 'Failed to send OTP. Check the phone number.'));
        } finally {
            this.loading.set(false);
        }
    }

    async onVerifyOtp(): Promise<void> {
        this.error.set(null);
        this.loading.set(true);
        try {
            await this.auth.verifyOtp(this.otpCode, this.vonageRequestId);
            this.router.navigate(['/memories']);
        } catch (err: unknown) {
            this.error.set(this.extractMessage(err, 'Invalid code. Please try again.'));
        } finally {
            this.loading.set(false);
        }
    }

    goBack(): void {
        this.step.set('phone');
        this.otpCode = '';
        this.error.set(null);
    }

    private extractMessage(err: unknown, fallback: string): string {
        if (err instanceof Error) return err.message;
        return fallback;
    }
}
