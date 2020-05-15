import './features';

import {css, customElement, html, LitElement, property} from 'lit-element';

import {alfred, Feature} from './api';
import {EventNames, Settings} from './types';

/**
 * AlfredSettings component.
 */
@customElement('alfred-settings')
export class AlfredSettings extends LitElement {
  @property({type: Boolean}) loading = true;
  @property({type: Boolean}) modified = false;

  constructor() {
    super();

    // listen on settings back when ready and changed
    chrome.runtime.onMessage.addListener(request => {
      if (request.eventName === EventNames.SYNC_SETTINGS_RESPONSE) {
        alfred.setSettings(request.settings, /* noRun= */ true);
        this.loading = false;
        this.requestUpdate();
      }
    });

    // ask to sync the settings
    chrome.runtime.sendMessage({eventName: EventNames.SYNC_SETTINGS_REQUEST});
  }

  onChange() {
    this.modified = true;
  }

  async handleReset() {
    // send update to background process
    chrome.runtime.sendMessage({
      eventName: EventNames.RESETE_SETTINGS_REQUEST,
    });
  }

  async handleSave() {
    if (!this.modified) return;

    // save only when all features are valid
    const settingsToUpdate: Settings = {};
    for (const feature of alfred.features) {
      const isValid = await feature.validate(feature.value);
      if (!isValid) {
        alert('Invalid rule');
        return;
      }

      if (!feature.hasOwnProperty('value')) {
        settingsToUpdate[feature.name] = {
          enabled: feature.enabled,
        };
      } else {
        settingsToUpdate[feature.name] = {
          value: feature.format(feature.value),
          enabled: feature.enabled,
        };
      }
    }

    // send update to background process
    chrome.runtime.sendMessage({
      eventName: EventNames.UPDATE_SETTINGS_REQUEST,
      settings: settingsToUpdate
    });

    this.modified = false;
  }

  private getFetureTemplate(feature: Feature) {
    return html`<alfred-setting-item @setting-changed=${
        this.onChange} .feature=${feature}></alfred-setting-item>`;
  }

  render() {
    return this.loading ? html`loading...` : html`
        <div class="actions">
          <button
            @click=${this.handleSave}
            ?disabled=${!this.modified}>
            Save
          </button>
          <button
            @click=${this.handleReset}>
            Reset
          </button>
        </div>
        <div class="feature-option-area">
          ${alfred.features.map(feature => this.getFetureTemplate(feature))}
        </div>
      `;
  }

  static get styles() {
    return css`
        :host {
          background-color: #fafafa;
        }
        .actions {
          position: fixed;
          width: 100%;
          box-sizing: border-box;
          padding: 10px;
          top: 0;
          left: 0;
          background-color: #fafafa;
        }
        button {
          font-family: Roboto, sans-serif;
          font-weight: 500;
          text-transform: uppercase;
          user-select: none;
          box-sizing: content-box;
          cursor: pointer;
          border-radius: 4px;
          border-width: 1px;
          border-style: solid;
          border-color: rgb(51, 51, 51);
          border-image: initial;
          padding: 5px;
          outline: none;
          width: 100px;
          height: 30px;
        }
        .feature-option-area {
          margin-top: 60px;
        }
        `;
  }
}

/**
 * AlfredSettingItem component.
 */
@customElement('alfred-setting-item')
export class AlfredSettingItem extends LitElement {
  @property({type: Object, attribute: false}) feature!: Feature;

  handleInputChange(e: Event) {
    this.feature.value = (e.target as HTMLInputElement).value;
    this.onChange();
  }

  toggleDisable() {
    this.feature.enabled = !this.feature.enabled;
    this.onChange();
  }

  onChange() {
    this.dispatchEvent(new CustomEvent<Partial<Feature>>('setting-changed', {
      detail: {...this.feature},
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
        <h4>${this.feature.name}</h4>
        <input
          type="checkbox"
          id="${this.feature.name}"
          .checked=${this.feature.enabled}
          @click=${this.toggleDisable} />
        <label for="${this.feature.name}">${this.feature.description}</label>
        <textarea
          .hidden=${typeof this.feature.value !== 'string'}
          name="${this.feature.name}"
          .value=${this.feature.value as string}
          @input=${this.handleInputChange}>
        </textarea>
       `;
  }

  static get styles() {
    return css`
        :host {
          display: block;
          visibility: visible;
          border-radius: 4px;
          background-color: '#fff';
          box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.2),0 1px 1px 0 rgba(0, 0, 0, 0.14),0 1px 3px 0 rgba(0,0,0,.12);
          flex-direction: column;
          box-sizing: border-box;
          width: 100%;
          padding: 15px;
          margin-bottom: 10px;
        }
        textarea {
          display: block;
          margin: 10px 0 0 0;
          min-height: 200px;
          width: 100%;
          padding: 10px;
          box-sizing: border-box;
        }
        textarea[hidden] {
          display: none;
        }
        `;
  }
}