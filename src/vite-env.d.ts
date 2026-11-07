/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_ADS_ENABLED?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_HOME?: string;
  readonly VITE_ADSENSE_SLOT_HOME_BOTTOM?: string;
  readonly VITE_ADSENSE_SLOT_CATEGORY?: string;
  readonly VITE_ADSENSE_SLOT_GAME?: string;
  readonly VITE_ADSENSE_SLOT_GAME_SIDEBAR?: string;
  readonly VITE_ADSENSE_SLOT_LISTING?: string;
  readonly VITE_EXTERNAL_GAME_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
