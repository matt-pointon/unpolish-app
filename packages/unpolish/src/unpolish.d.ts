// Type declarations for the unpolish runtime (ES module and CommonJS builds).

export type ThemeId = 'original' | 'black-white' | 'sketch' | 'blueprint' | 'pastel';
export type LofiThemeId = Exclude<ThemeId, 'original'>;

export interface ThemeSettings {
  /** Strength of the theme's own treatment, 0 (off) to 100. */
  details: number;
  palette: Record<string, string>;
  typography: 'original' | 'neutral' | 'hand' | 'technical' | 'rounded';
  border: { weight: number; style: 'solid' | 'dashed' | 'hand' | 'none' };
  radius: number | 'keep';
  shadows: 'none' | 'soft' | 'flat';
  images: 'original' | 'mono' | 'theme' | 'placeholder';
}

/** The shared, version-controlled project configuration (unpolish.config.json). */
export interface UnpolishConfig {
  $schema?: string;
  version?: 1;
  id?: string;
  enabled?: boolean;
  defaultTheme?: ThemeId;
  ui?: 'visible' | 'hidden';
  launcher?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | false;
  webFonts?: boolean;
  exclude?: string[];
  roles?: Record<string, 'surface' | 'fill' | 'media' | 'icon' | 'plain'>;
  shortcuts?: { toggle?: string; themes?: Partial<Record<ThemeId, string>> };
  themes?: Partial<Record<LofiThemeId, Partial<ThemeSettings>>>;
  overrides?: Partial<Record<'*' | LofiThemeId, string>>;
}

export interface InitOptions {
  /** Inline configuration. */
  config?: UnpolishConfig;
  /** URL of unpolish.config.json, fetched before starting. Ignored when `config` is given. */
  configUrl?: string;
  /** Tried when `configUrl` fails to load. */
  fallbackConfigUrl?: string | null;
}

export interface UnpolishState {
  theme: ThemeId;
  settings: ThemeSettings | null;
  source: 'project' | 'draft' | 'review';
  open: boolean;
}

export interface UnpolishApi {
  readonly version: string;
  readonly themes: ThemeId[];
  init(options?: InitOptions): UnpolishApi;
  setTheme(id: ThemeId | string): UnpolishApi;
  getTheme(): ThemeId;
  update(partial: Partial<ThemeSettings>): UnpolishApi;
  getSettings(id?: ThemeId): ThemeSettings | null;
  getConfig(): UnpolishConfig;
  getConfigInstructions(): string;
  getReviewLink(options?: { hideUI?: boolean }): string;
  open(): UnpolishApi;
  close(): UnpolishApi;
  toggle(): UnpolishApi;
  restore(): UnpolishApi;
  resetTheme(): UnpolishApi;
  discardLocalChanges(): UnpolishApi;
  on(event: 'change' | 'ready' | 'open' | 'close', listener: (state: UnpolishState) => void): () => void;
  state(): UnpolishState;
  destroy(): void;
}

/** Start Unpolish in the browser. Returns null on the server; repeated calls return the running instance. */
export function init(options?: InitOptions): UnpolishApi | null;
/** The running instance, created on first use; null on the server. */
export function getUnpolish(): UnpolishApi | null;
export const version: string;

declare const unpolish: { init: typeof init; getUnpolish: typeof getUnpolish; version: string };
export default unpolish;

declare global {
  interface Window {
    Unpolish?: UnpolishApi;
    UnpolishConfig?: UnpolishConfig;
  }
}
