/**
 * Telegram QR Scanner Integration
 *
 * Wrapper for Telegram WebApp showScanQrPopup() with error handling and Promise interface.
 */

export interface ScanQROptions {
  text?: string; // Instructions shown to user
}

/**
 * Scan QR code using Telegram's native scanner
 *
 * @returns Promise that resolves with QR data or rejects if cancelled/failed
 */
export function scanQRCode(options: ScanQROptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if Telegram WebApp API available
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      reject(new Error('Telegram WebApp API not available'));
      return;
    }

    // Check version (QR scanner added in 6.2)
    if (!window.Telegram.WebApp.isVersionAtLeast('6.2')) {
      reject(new Error('QR scanner not supported (requires Telegram 6.2+)'));
      return;
    }

    const telegram = window.Telegram.WebApp;

    telegram.showScanQrPopup({
      text: options.text || 'Отсканируйте QR-код'
    }, (data) => {
      if (data) {
        // QR scanned successfully
        telegram.closeScanQrPopup();
        resolve(data);
        return true; // Stop scanning
      }

      // No data - continue scanning
      return false;
    });

    // Handle popup close (user cancelled)
    telegram.onEvent('scanQrPopupClosed', () => {
      telegram.offEvent('scanQrPopupClosed', () => {});
      reject(new Error('QR scanning cancelled by user'));
    });
  });
}

/**
 * Scan QR with validation callback
 *
 * Continues scanning until valid QR is found or user cancels.
 */
export function scanQRWithValidation(
  options: ScanQROptions & {
    validate: (data: string) => boolean | Promise<boolean>;
    onInvalid?: (data: string) => void;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.Telegram?.WebApp?.isVersionAtLeast('6.2')) {
      reject(new Error('QR scanner not supported'));
      return;
    }

    const telegram = window.Telegram.WebApp;

    telegram.showScanQrPopup({
      text: options.text || 'Отсканируйте QR-код'
    }, async (data) => {
      if (data) {
        try {
          const isValid = await options.validate(data);

          if (isValid) {
            telegram.closeScanQrPopup();
            resolve(data);
            return true; // Stop scanning
          } else {
            // Invalid QR, continue scanning
            if (options.onInvalid) {
              options.onInvalid(data);
            }
            telegram.showAlert('Неверный QR-код');
            return false; // Continue scanning
          }
        } catch (error) {
          // Validation error, continue scanning
          return false;
        }
      }

      return false;
    });

    telegram.onEvent('scanQrPopupClosed', () => {
      telegram.offEvent('scanQrPopupClosed', () => {});
      reject(new Error('QR scanning cancelled'));
    });
  });
}

/**
 * Example usage:
 *
 * ```typescript
 * import { scanQRCode, scanQRWithValidation } from './qr_scanner';
 *
 * // Basic scanning
 * try {
 *   const qrData = await scanQRCode({
 *     text: 'Отсканируйте карту лояльности'
 *   });
 *
 *   console.log('Scanned:', qrData);
 * } catch (error) {
 *   console.error('Scan failed:', error);
 * }
 *
 * // Scanning with validation
 * const qrData = await scanQRWithValidation({
 *   text: 'Сканируйте карту клиента',
 *   validate: async (data) => {
 *     // Validate QR format
 *     return data.startsWith('loyalty:v1:card:');
 *   },
 *   onInvalid: (data) => {
 *     console.log('Invalid QR scanned:', data);
 *   }
 * });
 * ```
 */
