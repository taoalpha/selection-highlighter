/** Debug logging */
export function debug(...args: unknown[]) {
  if (location.search.includes('DEBUG')) console.info('[talfred]', ...args);
}

/**
 * Query selector on a dom element.
 *
 * This is shadow DOM compatible, but only works when selector is within
 * one shadow host, won't work if your selector is crossing
 * multiple shadow hosts.
 *
 */
export function querySelector(selector: string, el: Element = document.body) {
  let nodes: Array<Element|ShadowRoot> = [el];
  let element: Element|null = null;
  while (nodes.length) {
    const node = nodes.pop();

    // Skip if it's an invalid node.
    if (!node || !node.querySelector) continue;

    // Try find it with native querySelector directly
    element = node.querySelector(selector);

    if (element) {
      break;
    } else {
      nodes = nodes.concat(Array.from(node.querySelectorAll('*'))
                               .filter(n => !!n.shadowRoot)
                               .map(n => n.shadowRoot!));
      const curShadowRoot = (node as Element).shadowRoot;
      if (curShadowRoot) {
        nodes.push(curShadowRoot);
      }
    }
  }
  return element;
}

/**
 * querySelectorAll for shadow doms.
 */
export function querySelectorAll(
    selector: string, el: Element = document.body) {
  let nodes: Array<Element|ShadowRoot> = [el];
  const elements: Element[] = [];
  while (nodes.length) {
    const node = nodes.pop();

    // Skip if it's an invalid node.
    if (!node || !node.querySelector) continue;

    // Try find it with native querySelector directly
    const ns = node.querySelectorAll(selector);
    ns.forEach(n => {
      if (!elements.includes(n)) elements.push(n);
    });

    nodes = nodes.concat(Array.from(node.querySelectorAll('*'))
                             .filter(n => !!n.shadowRoot)
                             .map(n => n.shadowRoot!));
    const curShadowRoot = (node as Element).shadowRoot;
    if (curShadowRoot) {
      nodes.push(curShadowRoot);
    }
  }
  return elements;
}


/**
 * Ready function for document.
 */
export function ready(fn: () => void) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

interface IntervalConfig {
  interval: number;
  maxInterval: number;
  stopIf?: () => boolean;
}

/** IntervalInstance interface */
export interface IntervalInstance {
  name: string;
  interval: number;
  run: () => Promise<unknown>;
  stopWhen?: () => boolean;  // return true to stop this instance

  id?: number;  // auto assigned when add to manager
  lastRunTime?: number;
  stop?: () => void;  // call to stop
  isExecuting?: boolean;
}

class IntervalManager {
  private id = 0;  // auto increment
  private intervalPool = new Set<Required<IntervalInstance>>();
  private gInterval?: number;
  private runStats = {runTimes: 0, executions: 0};

  get size() {
    return this.intervalPool.size;
  }

  start() {
    if (this.gInterval !== undefined) return;
    this.run();
  }

  run() {
    this.runStats.runTimes++;
    debug(
        'interval manager stats: ', this.runStats,
        'interval pool size is:', this.size);
    this.gInterval = window.setTimeout(() => {
      // run on every instances from the pool
      this.intervalPool.forEach(instance => {
        if (instance.stopWhen && instance.stopWhen()) {
          this.remove(instance);
        } else if (
            !instance.isExecuting &&
            (!instance.lastRunTime ||
             Date.now() - instance.lastRunTime > instance.interval)) {
          // mark as executing
          instance.isExecuting = true;
          this.runStats.executions++;
          instance.run().finally(() => {
            // either finished or failed, mark as done and last run time
            instance.lastRunTime = Date.now();
            instance.isExecuting = false;
          });
        } else {
          debug('skip run for: ', instance.name);
        }
      });

      // run every 500 ms
      this.run();
    }, 500);
  }

  // once add, can not change from outside other than calling stop
  add(instance: IntervalInstance): Required<IntervalInstance> {
    const instanceToBeAdded: Required<IntervalInstance> = {
      name: instance.name,
      id: this.id++,
      interval: instance.interval || 1000,
      run: instance.run,
      stop: () => this.remove(instanceToBeAdded),
      stopWhen: instance.stopWhen ? instance.stopWhen : () => false,
      isExecuting: false,
      lastRunTime: 0,
    };

    this.intervalPool.add(instanceToBeAdded);
    if (this.intervalPool.size > 0) {
      this.start();
    }

    return instanceToBeAdded;
  }

  stop() {
    if (this.gInterval !== undefined) {
      clearTimeout(this.gInterval);
      this.gInterval = undefined;
    }
  }

  remove(instance: Required<IntervalInstance>) {
    this.intervalPool.delete(instance);

    if (this.intervalPool.size === 0) {
      this.stop();
    }
  }
}

/** The interval manager used by the entire app. */
export const intervalManager = new IntervalManager();

function waitUntilNextFrame(ts: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ts);
  });
}

interface CheckElementOption {
  parent?: Element;
  maxNumTries?: number;
}

interface CheckConditionFn<T> {
  (): T;
}

/**
 * Check if element is ready.
 */
export async function checkElementOrConditon<T>(
    filter: string|CheckConditionFn<T>, options: CheckElementOption = {
      maxNumTries: 10
    }) {
  let conditionFn;
  if (typeof filter === 'function') {
    conditionFn = filter;
  } else {
    conditionFn = () => querySelector(filter, options.parent || document.body);
  }
  let count = 1;
  let condition = conditionFn();
  while (!condition) {
    await waitUntilNextFrame(count * 500);
    count++;
    condition = conditionFn();
    if (count > (options.maxNumTries || 10)) break;
  }

  return condition;
}

/** timeout after */
export function waitFor<T>(p: Promise<T>, ts: number) {
  const timeoutP = new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('timeout on waiting')), ts);
  });
  return Promise.race([p, timeoutP]);
}

/** debounce */
export function debounce(
    fn: (...args: unknown[]) => unknown, bounceTime = 500) {
  let timer: number;
  const newFn = (...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), bounceTime);
  };
  return newFn;
}

/** returns if a node is in a shadow DOM or not */
export function isInShadowDom(el: Node) {
  return el && el.getRootNode() && !!(el.getRootNode() as {host?: Node}).host;
}