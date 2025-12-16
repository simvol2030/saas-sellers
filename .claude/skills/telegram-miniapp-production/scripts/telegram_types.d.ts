/**
 * TypeScript type definitions for Telegram WebApp API
 *
 * Usage:
 * Add this to your src/global.d.ts or reference directly:
 *
 * /// <reference path="../path/to/telegram_types.d.ts" />
 *
 * Or in tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "types": ["./telegram_types"]
 *   }
 * }
 */

interface Window {
  Telegram: {
    WebApp: TelegramWebApp;
  };
}

interface TelegramWebApp {
  /**
   * A string with raw data transferred to the Mini App, convenient for validating data.
   * WARNING: Validate on backend, this data can be spoofed on the client-side.
   */
  initData: string;

  /**
   * An object with input data transferred to the Mini App.
   * WARNING: Data from this object should not be trusted.
   * You should only use data from initData on the backend.
   */
  initDataUnsafe: WebAppInitData;

  /**
   * The version of the Bot API available in the user's Telegram app.
   */
  version: string;

  /**
   * The name of the platform of the user's Telegram app.
   */
  platform: string;

  /**
   * The color scheme currently used in the Telegram app. Either "light" or "dark".
   */
  colorScheme: 'light' | 'dark';

  /**
   * An object containing the current theme settings used in the Telegram app.
   */
  themeParams: ThemeParams;

  /**
   * True if the Mini App is expanded to the maximum available height.
   */
  isExpanded: boolean;

  /**
   * The current height of the visible area of the Mini App.
   */
  viewportHeight: number;

  /**
   * The height of the visible area of the Mini App in its last stable state.
   */
  viewportStableHeight: number;

  /**
   * Current header color in the #RRGGBB format.
   */
  headerColor: string;

  /**
   * Current background color in the #RRGGBB format.
   */
  backgroundColor: string;

  /**
   * An object for controlling the back button which can be displayed in the header.
   */
  BackButton: BackButton;

  /**
   * An object for controlling the main button.
   */
  MainButton: MainButton;

  /**
   * An object for controlling haptic feedback.
   */
  HapticFeedback: HapticFeedback;

  /**
   * An object for controlling cloud storage.
   */
  CloudStorage: CloudStorage;

  /**
   * Returns true if the user's app supports a version of the Bot API that is equal to or higher than the version passed as the parameter.
   */
  isVersionAtLeast(version: string): boolean;

  /**
   * A method that sets the app header color.
   */
  setHeaderColor(color: 'bg_color' | 'secondary_bg_color' | string): void;

  /**
   * A method that sets the app background color in the #RRGGBB format.
   */
  setBackgroundColor(color: string): void;

  /**
   * A method that enables a confirmation dialog while the user is trying to close the Mini App.
   */
  enableClosingConfirmation(): void;

  /**
   * A method that disables the confirmation dialog while the user is trying to close the Mini App.
   */
  disableClosingConfirmation(): void;

  /**
   * A method that informs the Telegram app that the Mini App is ready to be displayed.
   */
  ready(): void;

  /**
   * A method that expands the Mini App to the maximum available height.
   */
  expand(): void;

  /**
   * A method that closes the Mini App.
   */
  close(): void;

  /**
   * A method that shows a native popup described by the params argument of the type PopupParams.
   */
  showPopup(params: PopupParams, callback?: (button_id: string) => void): void;

  /**
   * A method that shows message in a simple alert with a 'Close' button.
   */
  showAlert(message: string, callback?: () => void): void;

  /**
   * A method that shows message in a simple confirmation window with 'OK' and 'Cancel' buttons.
   */
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;

  /**
   * A method that shows a native popup for scanning QR codes described by the params argument.
   */
  showScanQrPopup(
    params: ScanQrPopupParams,
    callback?: (data: string) => boolean | void
  ): void;

  /**
   * A method that closes the native popup for scanning QR codes.
   */
  closeScanQrPopup(): void;

  /**
   * A method that requests text from the clipboard.
   */
  readTextFromClipboard(callback?: (text: string) => void): void;

  /**
   * A method that opens a link in an external browser.
   */
  openLink(url: string, options?: { try_instant_view?: boolean }): void;

  /**
   * A method that opens a telegram link inside Telegram app.
   */
  openTelegramLink(url: string): void;

  /**
   * A method that opens an invoice using the link url.
   */
  openInvoice(url: string, callback?: (status: InvoiceStatus) => void): void;

  /**
   * Subscribes to events.
   */
  onEvent(eventType: WebAppEventType, callback: () => void): void;

  /**
   * Unsubscribes from events.
   */
  offEvent(eventType: WebAppEventType, callback: () => void): void;

  /**
   * Sends data to the bot.
   */
  sendData(data: string): void;

  /**
   * Switches to inline mode.
   */
  switchInlineQuery(query: string, choose_chat_types?: string[]): void;
}

interface WebAppInitData {
  /**
   * A unique identifier for the Mini App session.
   */
  query_id?: string;

  /**
   * An object containing data about the current user.
   */
  user?: WebAppUser;

  /**
   * An object containing data about the chat partner of the current user in the chat where the bot was launched via attachment menu.
   */
  receiver?: WebAppUser;

  /**
   * An object containing data about the chat where the bot was launched via attachment menu.
   */
  chat?: WebAppChat;

  /**
   * Type of the chat from which the Mini App was opened.
   */
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';

  /**
   * Global identifier, uniquely corresponding to the chat from which the Mini App was opened.
   */
  chat_instance?: string;

  /**
   * The value of the startattach parameter.
   */
  start_param?: string;

  /**
   * Time in seconds when the form was opened.
   */
  auth_date?: number;

  /**
   * A hash of all passed parameters.
   */
  hash?: string;
}

interface WebAppUser {
  /**
   * A unique identifier for the user.
   */
  id: number;

  /**
   * True, if this user is a bot. Returns in the receiver field only.
   */
  is_bot?: boolean;

  /**
   * First name of the user.
   */
  first_name: string;

  /**
   * Last name of the user.
   */
  last_name?: string;

  /**
   * Username of the user.
   */
  username?: string;

  /**
   * IETF language tag of the user's language.
   */
  language_code?: string;

  /**
   * True, if this user is a Telegram Premium user.
   */
  is_premium?: boolean;

  /**
   * URL of the user's profile photo.
   */
  photo_url?: string;
}

interface WebAppChat {
  /**
   * Unique identifier for this chat.
   */
  id: number;

  /**
   * Type of chat.
   */
  type: 'group' | 'supergroup' | 'channel';

  /**
   * Title of the chat.
   */
  title: string;

  /**
   * Username of the chat.
   */
  username?: string;

  /**
   * URL of the chat's photo.
   */
  photo_url?: string;
}

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

interface BackButton {
  /**
   * Shows whether the button is visible.
   */
  isVisible: boolean;

  /**
   * Shows the button.
   */
  show(): void;

  /**
   * Hides the button.
   */
  hide(): void;

  /**
   * A method to set the button press event handler.
   */
  onClick(callback: () => void): void;

  /**
   * A method that removes the button press event handler.
   */
  offClick(callback: () => void): void;
}

interface MainButton {
  /**
   * Current button text.
   */
  text: string;

  /**
   * Current button color.
   */
  color: string;

  /**
   * Current button text color.
   */
  textColor: string;

  /**
   * Shows whether the button is visible.
   */
  isVisible: boolean;

  /**
   * Shows whether the button is active.
   */
  isActive: boolean;

  /**
   * Readonly. Shows whether the button is displaying a loading indicator.
   */
  isProgressVisible: boolean;

  /**
   * A method to set the button text.
   */
  setText(text: string): MainButton;

  /**
   * A method to set the button press event handler.
   */
  onClick(callback: () => void): MainButton;

  /**
   * A method that removes the button press event handler.
   */
  offClick(callback: () => void): MainButton;

  /**
   * A method to make the button visible.
   */
  show(): MainButton;

  /**
   * A method to hide the button.
   */
  hide(): MainButton;

  /**
   * A method to enable the button.
   */
  enable(): MainButton;

  /**
   * A method to disable the button.
   */
  disable(): MainButton;

  /**
   * A method to show a loading indicator on the button.
   */
  showProgress(leaveActive?: boolean): MainButton;

  /**
   * A method to hide the loading indicator.
   */
  hideProgress(): MainButton;

  /**
   * A method to set the button parameters.
   */
  setParams(params: MainButtonParams): MainButton;
}

interface MainButtonParams {
  text?: string;
  color?: string;
  text_color?: string;
  is_active?: boolean;
  is_visible?: boolean;
}

interface HapticFeedback {
  /**
   * A method tells that an impact occurred.
   */
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;

  /**
   * A method tells that a task or action has succeeded, failed, or produced a warning.
   */
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;

  /**
   * A method tells that the user has changed a selection.
   */
  selectionChanged(): void;
}

interface CloudStorage {
  /**
   * Saves a value for the key.
   */
  setItem(key: string, value: string, callback?: (error: string | null) => void): void;

  /**
   * Gets a value for the key.
   */
  getItem(key: string, callback?: (error: string | null, value?: string) => void): void;

  /**
   * Gets values for the keys.
   */
  getItems(keys: string[], callback?: (error: string | null, values?: Record<string, string>) => void): void;

  /**
   * Removes the value for the key.
   */
  removeItem(key: string, callback?: (error: string | null) => void): void;

  /**
   * Removes values for the keys.
   */
  removeItems(keys: string[], callback?: (error: string | null) => void): void;

  /**
   * Gets all keys.
   */
  getKeys(callback?: (error: string | null, keys?: string[]) => void): void;
}

interface PopupParams {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

interface PopupButton {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

interface ScanQrPopupParams {
  text?: string;
}

type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

type WebAppEventType =
  | 'themeChanged'
  | 'viewportChanged'
  | 'mainButtonClicked'
  | 'backButtonClicked'
  | 'settingsButtonClicked'
  | 'invoiceClosed'
  | 'popupClosed'
  | 'qrTextReceived'
  | 'clipboardTextReceived'
  | 'writeAccessRequested'
  | 'contactRequested';
