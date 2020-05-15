/** All supported event names. */
export enum EventNames {
  SYNC_SETTINGS_REQUEST = 'sync_settings_request',
  SYNC_SETTINGS_RESPONSE = 'sync_settings_response',
  UPDATE_SETTINGS_REQUEST = 'update_settings_request',
  RESETE_SETTINGS_REQUEST = 'reset_settings_request',
}

/**
 * Settings interface.
 */
export interface Settings {
  // feature name
  [key: string]: FeatureSetting;
}

/**
 * Setting for each feature.
 */
export interface FeatureSetting {
  value?: string;
  enabled: boolean;
}

/**
 * Stats for every feature
 */
export interface FeatureStats {
  lastRunTime?: number;
  runTimes: number;
  failures: Error[];
}