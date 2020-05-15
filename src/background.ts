import {EventNames, Settings} from './types';

function notifyAll(message: {}) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, message);
    });
  });
}

function notifyActiveTab(message: {}) {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    const currentTab = tabs && tabs[0];
    if (!currentTab || !currentTab.id) return;
    chrome.tabs.sendMessage(currentTab.id, message);
  });
}

// Listen on events from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tab = sender.tab;
  switch (request.eventName) {
    case EventNames.SYNC_SETTINGS_REQUEST:
      chrome.storage.sync.get(['settings'], result => {
        // send to all tabs asynchronously so they can reload with latest
        // settings
        notifyAll({
          eventName: EventNames.SYNC_SETTINGS_RESPONSE,
          settings: (result['settings'] || {}) as Settings
        });
      });
      break;
    // update settings
    case EventNames.UPDATE_SETTINGS_REQUEST:
      if (!request.settings) break;
      chrome.storage.sync.get(['settings'], result => {
        const settings = (result['settings'] || {}) as Settings;
        // merge in and store
        Object.keys(request.settings).forEach(featureName => {
          settings[featureName] = Object.assign(
              {}, settings[featureName], request.settings[featureName]);
        });

        // now update and notify
        chrome.storage.sync.set({settings}, () => {
          notifyAll({eventName: EventNames.SYNC_SETTINGS_RESPONSE, settings});
        });
      });
      break;
    case EventNames.RESETE_SETTINGS_REQUEST:
      chrome.storage.sync.clear(() => {
        // now update and notify
        notifyAll({eventName: EventNames.SYNC_SETTINGS_RESPONSE, settings: {}});
      });
      break;
    default:
      break;
  }
  return true;
});

// record stats collected from all content scripts