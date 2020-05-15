import {FeatureStats, Settings} from './types';
import {debug, waitFor} from './utils';

/** Type for feature constructors */
export type FeatureConstructor = new (api: Alfred) => Feature;

// LINT.IfChange
/**
 * Interface for Feature.
 */
export abstract class Feature {
  abstract name: string;
  abstract description: string;
  protected teardownQueue: Array<() => void> = [];

  // default value, this value will be updated from storage when load
  value?: string;

  // default all opt-in
  // also will be the value for boolean features
  enabled: boolean = false;

  // execution order will follow the priority number
  priority: number = 0;

  // stats
  stats: FeatureStats = {
    runTimes: 0,
    failures: [],
  };

  constructor(protected api: Alfred) {}

  // return true if should run this feature
  abstract async shouldRun(): Promise<boolean>;

  // Execution when enabled
  abstract async run(): Promise<void>;

  // clean up when feature is disabled
  async cleanup(): Promise<void> {
    this.teardownQueue.forEach(tdfn => {
      // TODO: async ?
      tdfn();
    });
    return;
  }

  // Validate if value is valid
  async validate(value?: string): Promise<boolean> {
    if (value === undefined) return true;

    // if string, always in json
    try {
      JSON.parse(value);
      return true;
    } catch (e) {
      return false;
    }
  }

  // format value before save, but always store as string
  format(value?: string): string {
    return value === undefined ? '' :
                                 JSON.stringify(JSON.parse(value), null, 2);
  }
}
// LINT.ThenChange(contribute.md)

let ALFRED_INSTANCE: Alfred;

/**
 * Alfred class.
 * @singleton
 */
export class Alfred {
  static features = new Map<string, Feature>();
  static registerFeature(featureC: FeatureConstructor) {
    const feature = new featureC(ALFRED_INSTANCE);
    if (Alfred.features.has(feature.name)) {
      console.error('Feature with same name exists!');
    } else {
      Alfred.features.set(feature.name, feature);
    }
  }

  /**
   * set to true when local overrides kick in and you want to skip global sync
   */
  skipSync = false;

  private settings: Settings = {};

  constructor() {
    if (ALFRED_INSTANCE) {
      console.warn('Singleton, import alfred instead.');
      return ALFRED_INSTANCE;
    }
  }

  /**
   * Update settings of alfred, for features that changed settings, will
   * re-run.
   */
  setSettings(settings: Settings, noRun = false) {
    this.settings = settings;
    const featuresToRun = new Set<Feature>();

    // update all features with latest settings
    this.features.forEach(feature => {
      // if never ran before, always try to run it
      if (!feature.stats.lastRunTime) {
        featuresToRun.add(feature);
      }
      const featureSetting = settings[feature.name];
      if (featureSetting) {
        // if feature enable status changed
        if (feature.enabled !== featureSetting.enabled) {
          featuresToRun.add(feature);
        }

        feature.enabled = featureSetting.enabled;
        if (feature.hasOwnProperty('value')) {
          // if feature value changed
          if (feature.value !== featureSetting.value) {
            featuresToRun.add(feature);
          }
          feature.value = featureSetting.value === undefined ?
              feature.value :
              featureSetting.value;
        }
      } else {
        // if settings doesn't have it yet, always run it
        featuresToRun.add(feature);
      }
    });

    if (featuresToRun.size && !noRun) {
      this.run([...featuresToRun]).catch(e => debug(e));
    }
  }

  get features() {
    return Array.from(Alfred.features.values())
        .sort((fa, fb) => fa.priority - fb.priority);
  }

  async run(features = this.features) {
    for (const feature of features) {
      // clean up in case feature was enabled, we wait for clean up up to 5s
      try {
        await waitFor(feature.cleanup(), 5 * 1000);
        if (!feature.enabled) continue;
        debug('running enabled feature: ', feature.name, feature.stats);
        if (await feature.shouldRun()) {
          feature.stats.lastRunTime = Date.now();
          feature.stats.runTimes++;
          await feature.run();
        }
      } catch (e) {
        feature.stats.failures.push(e);
      }
    }
  }
}

ALFRED_INSTANCE = new Alfred();

/** The singleton instance of the Alfred */
export const alfred = ALFRED_INSTANCE;