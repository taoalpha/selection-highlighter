import {Alfred, Feature} from '../api';
import {Settings} from '../types';

class FeatureToggles extends Feature {
  name = 'Feature Toggles';
  description = 'Toggle features on/off on every page';
  enabled = false;

  private elId = 'extension-feature-toggles';

  private shortcutKeyHandler = (event: KeyboardEvent) => {
    if (event.metaKey && event.shiftKey && event.code === 'KeyA') {
      this.showFeatureToggles();
    }
  };

  private showFeatureToggles() {
    const featureToggleEl = document.getElementById(this.elId);
    if (featureToggleEl) {
      featureToggleEl.style.display = 'block';
      return;
    }
    const features = Alfred.features;
    const container = document.createElement('div');
    container.id = this.elId;
    const containerStyle = document.createElement('style');
    containerStyle.innerHTML = `
      :host {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        max-height: 400px;
        overflow-y: scroll;
        background: white;
        z-index: 1000;
        box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.2),0 1px 1px 0 rgba(0, 0, 0, 0.14),0 1px 3px 0 rgba(0,0,0,.12);
        padding: 10px;
      }
      p {
        padding: 5px;
        margin: 0;
        color: #dc8e00;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
      }
      p span {
        color: blue;
        cursor: pointer;
      }
      li {
        list-style: none;
        padding: 5px;
      }
      button {
        width: 80px;
        height: 30px;
      }
        `;
    const shadowContainer = container.attachShadow({mode: 'open'});
    shadowContainer.appendChild(containerStyle);
    const notice = document.createElement('p');
    notice.innerHTML = 'Settings updated here are only temporary.';
    const close = document.createElement('span');
    close.innerHTML = 'close';
    close.onclick = () => container.style.display = 'none';
    notice.appendChild(close);
    shadowContainer.appendChild(notice);
    features.forEach(feature => {
      shadowContainer.appendChild(this.generateFeatureTemplate(feature));
    });

    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = 'Save';
    shadowContainer.appendChild(saveBtn);

    // bind event
    saveBtn.onclick = () => {
      // construct the settings
      const allFeatures = shadowContainer.querySelectorAll('input');
      const settings: Settings = {};
      allFeatures.forEach(feature => {
        settings[feature.id] = {enabled: feature.checked};
      });

      // skip sync
      this.api.skipSync = true;

      // update settings
      this.api.setSettings(settings);
    };

    // add it to the page
    document.body.appendChild(container);
  }

  private generateFeatureTemplate(feature: Feature) {
    const featureItem = document.createElement('li');
    featureItem.innerHTML = `
        <input type="checkbox" ${feature.enabled ? 'checked' : ''} id="${
        feature.name}" />
        <label for="${feature.name}">${feature.description}</label>
    `;
    return featureItem;
  }

  async shouldRun() {
    return true;
  }

  async run() {
    document.addEventListener('keydown', this.shortcutKeyHandler);
    this.teardownQueue.push(() => {
      document.removeEventListener('keydown', this.shortcutKeyHandler);
      const featureToggleEl = document.getElementById(this.elId);
      if (featureToggleEl) featureToggleEl.remove();
    });
  }
}

Alfred.registerFeature(FeatureToggles);
