import './features';

import {alfred} from './api';
import {EventNames} from './types';
import {debug, intervalManager} from './utils';

// listen on settings back when ready and changed
chrome.runtime.onMessage.addListener(request => {
  if (request.eventName === EventNames.SYNC_SETTINGS_RESPONSE) {
    if (alfred.skipSync) return;

    alfred.setSettings(request.settings);
  }
});

// ask to sync the settings
chrome.runtime.sendMessage({eventName: EventNames.SYNC_SETTINGS_REQUEST});

let curLocation = location.href;

// run alfred again when location changed
intervalManager.add({
  name: 'location change listener',
  interval: 2000,
  run: async () => {
    if (location.href === curLocation) return;
    curLocation = location.href;

    // TODO(taoalpha): maybe support hard-run and soft-run ? since sometimes
    // location change may not need a complete re-run
    return alfred.run().catch(e => debug(e));
  },
});