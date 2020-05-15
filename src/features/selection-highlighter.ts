import {Alfred, Feature} from '../api';
import {debounce, querySelectorAll} from '../utils';

interface HighlightConfig {
  highlightStyle?: string;
  excludeSelf?: boolean;
  excludeParents?: string[];
  noHighlightWithin?: string[];
}

class SelectionHighlighter extends Feature {
  name = 'Select To Highlight';
  description =
      'Select any text and highlight all occurrences on the page, `excludeParents` may have performance impact, so careful to use.';
  enabled = true;
  value = JSON.stringify(
      {
        excludeSelf: true,
        highlightStyle: 'background-color: yellow;',
        excludeParents: [],
        noHighlightWithin: ['input', 'textarea', '[contentEditable]'],
      },
      null, 2);

  private currentHighlightText = '';
  private annotatedNodes = new Set<Element>();
  private listener = debounce(() => this.highlight());

  get selectedText() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  }

  async shouldRun() {
    return true;
  }

  async run() {
    document.addEventListener('selectionchange', this.listener);
    this.teardownQueue.push(() => {
      document.removeEventListener('selectionchange', this.listener);
      this.resetAll();
    });
  }

  private resetAll() {
    // clean up all existing annotated nodes
    if (this.annotatedNodes.size) {
      this.annotatedNodes.forEach(node => {
        const parentNode = node.parentNode;
        node.replaceWith(node.textContent || '');
        // merge with text nodes close to it
        parentNode && parentNode.normalize();
      });
      this.annotatedNodes = new Set();
      this.currentHighlightText = '';
    }
  }

  private highlight() {
    const curSelectedText = this.selectedText;
    // ignore no selection or text less than 2 char
    if (!curSelectedText || curSelectedText.length <= 2) return;

    // no change on selected text
    if (curSelectedText === this.currentHighlightText) return;

    // ignore when selection inside of ignore elements
    const config: HighlightConfig = JSON.parse(this.value);
    if (config.noHighlightWithin && config.noHighlightWithin.length) {
      const currentSelection = window.getSelection();
      const walkNode = currentSelection && currentSelection.anchorNode;
      if (walkNode &&
          this.hasParentInChain(walkNode, config.noHighlightWithin)) {
        return;
      }
    }

    this.resetAll();

    // walk through all the nodes and annotate them
    let nodes: Array<Element|ShadowRoot> = [document.body];
    while (nodes.length) {
      const node = nodes.shift();
      if (!node) continue;
      if (node.innerHTML.includes(curSelectedText)) {
        const textNodes = this.textNodesUnder(node);
        textNodes.forEach(nodeToBeAnnotate => {
          this.annotateTextNode(nodeToBeAnnotate, curSelectedText);
        });
        this.currentHighlightText = curSelectedText;
      }

      // add all shadow nodes
      nodes = nodes.concat(Array.from(node.querySelectorAll('*'))
                               .filter(n => !!n.shadowRoot)
                               .map(n => n.shadowRoot!));
    }
  }

  private highlightTemplate(text: string) {
    const span = document.createElement('span');
    const config: HighlightConfig = JSON.parse(this.value);
    span.style.cssText = config.highlightStyle || 'background-color:yellow;';
    span.innerHTML = text;
    return span;
  }


  private annotateTextNode(node: Text, text: string) {
    // if its whole match
    if (!node.textContent) return;
    if (node.textContent.trim() === text) {
      const replaceNode = this.highlightTemplate(node.textContent);
      node.replaceWith(replaceNode);
      this.annotatedNodes.add(replaceNode);
    } else {
      const matchIndex = node.textContent.indexOf(text);
      if (matchIndex !== -1) {
        // split before and after the curSelectedText
        const nodeAfterSplit = node.splitText(matchIndex);
        const remainNode = nodeAfterSplit.splitText(text.length);
        const replaceNode = this.highlightTemplate(text);
        nodeAfterSplit.replaceWith(replaceNode);
        this.annotatedNodes.add(replaceNode);

        // recursively annoate it
        this.annotateTextNode(remainNode, text);
      }
    }
  }

  private textNodesUnder(el: Element|ShadowRoot) {
    let node: Node|null;
    const textNodes: Text[] = [];
    const walk = document.createTreeWalker(
        el, NodeFilter.SHOW_TEXT, {
          acceptNode: node => {
            const config: HighlightConfig = JSON.parse(this.value);
            // exclude current node
            if (config.excludeSelf) {
              const currentSelection = window.getSelection();
              if (currentSelection && currentSelection.containsNode(node)) {
                // for multiple occurrences, handle them separately
                const multiOccurrences =
                    new RegExp(`(${currentSelection.toString()}).*\\1`)
                        .test(node.textContent || '');

                if (!multiOccurrences) {
                  return NodeFilter.FILTER_REJECT;
                } else {
                  // keep spliting the nodes and do the same on the remaining
                  const nodeAfterSplit =
                      (node as Text)
                          .splitText(
                              (node.textContent ||
                               '').indexOf(currentSelection.toString()) +
                              currentSelection.toString().length);
                  // if selection is in second half, then accept current node
                  // otherwise reject it as it contains the current selection
                  return currentSelection.containsNode(nodeAfterSplit) ?
                      NodeFilter.FILTER_ACCEPT :
                      NodeFilter.FILTER_REJECT;
                }
              }
            }

            // exclude defined parent selectors
            // will be a huge performance hit
            if (config.excludeParents && config.excludeParents.length &&
                this.hasParentInChain(node, config.excludeParents)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        },
        false);
    while (node = walk.nextNode()) {
      if (node) textNodes.push(node as Text);
    }
    return textNodes;
  }

  private hasParentInChain(curNode: Node, selectors: string[]) {
    let walkNode = curNode.parentElement;
    let found = false;
    while (walkNode) {
      if (selectors.some(
              selector =>
                  walkNode && walkNode.matches && walkNode.matches(selector))) {
        found = true;
        break;
      }
      walkNode = walkNode.parentElement;
    }
    return found;
  }
}

Alfred.registerFeature(SelectionHighlighter);
