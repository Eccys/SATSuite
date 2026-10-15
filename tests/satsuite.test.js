const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createMockElement(tagName, classNames = []) {
  const classes = new Set(classNames);
  const attributes = new Map();
  const listeners = new Map();
  const children = [];

  const el = {
    tagName: String(tagName || 'div').toUpperCase(),
    id: '',
    type: '',
    textContent: '',
    parentElement: null,
    style: { display: '', position: 'static', scrollBehavior: '', outline: '' },
    children,
    get className() {
      return Array.from(classes).join(' ');
    },
    set className(val) {
      classes.clear();
      String(val || '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => classes.add(c));
    },
    classList: {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c)
    },
    setAttribute: (k, v) => attributes.set(k, String(v)),
    getAttribute: (k) => attributes.get(k) ?? null,
    addEventListener: (ev, fn) => {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev).push(fn);
    },
    click: () => {
      const fns = listeners.get('click') || [];
      for (const fn of fns) {
        fn({
          target: el,
          preventDefault: () => {},
          stopPropagation: () => {}
        });
      }
    },
    appendChild: (child) => {
      child.parentElement = el;
      children.push(child);
      return child;
    },
    remove: () => {
      if (el.parentElement) {
        const idx = el.parentElement.children.indexOf(el);
        if (idx !== -1) el.parentElement.children.splice(idx, 1);
        el.parentElement = null;
      }
    },
    querySelectorAll: (selector) => {
      const results = [];
      const visit = (node) => {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) results.push(child);
          visit(child);
        }
      };
      visit(el);
      return results;
    },
    querySelector: (selector) => {
      return el.querySelectorAll(selector)[0] || null;
    }
  };
  return el;
}

function matchesSelector(node, selector) {
  if (selector.startsWith('.')) {
    return node.classList.contains(selector.slice(1));
  }
  const attrMatch = selector.match(/^\[data-action="([^"]+)"\]$/);
  if (attrMatch) {
    return node.getAttribute('data-action') === attrMatch[1];
  }
  return false;
}

describe('SATSuite content script (content.js)', () => {
  it('hides multiple answers, prevents duplicate IDs, and preserves user-opened answer across 500ms SPA timer', () => {
    const contentSource = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

    const root = createMockElement('body');
    const sharedParent = createMockElement('div');
    const answer1 = createMockElement('div', ['answer-content']);
    const answer2 = createMockElement('div', ['answer-content']);
    sharedParent.appendChild(answer1);
    sharedParent.appendChild(answer2);
    root.appendChild(sharedParent);

    const observers = [];
    const timeouts = [];
    const locationObj = { href: 'https://satsuitequestionbank.collegeboard.org/digital/results?q=1' };

    const context = vm.createContext({
      console: { log: () => {} },
      Boolean,
      WeakMap,
      MutationObserver: class {
        constructor(cb) {
          this.cb = cb;
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
      setTimeout: (fn, ms) => {
        const t = { fn, ms, cleared: false };
        timeouts.push(t);
        return t;
      },
      clearTimeout: (t) => {
        if (t) t.cleared = true;
      },
      location: locationObj,
      window: {
        addEventListener: () => {},
        getComputedStyle: (el) => ({ position: el.style.position || 'static' })
      },
      document: {
        readyState: 'complete',
        body: root,
        documentElement: root,
        createElement: (tag) => createMockElement(tag),
        querySelectorAll: (sel) => root.querySelectorAll(sel),
        getElementById: (id) => {
          const all = [];
          const walk = (n) => {
            for (const c of n.children) {
              if (c.id === id) all.push(c);
              walk(c);
            }
          };
          walk(root);
          return all[0] || null;
        }
      },
      browser: {
        storage: {
          local: {
            get: () => Promise.resolve({ animationEnabled: true })
          },
          onChanged: { addListener: () => {} }
        },
        runtime: {
          onMessage: { addListener: () => {} }
        }
      }
    });

    vm.runInContext(contentSource, context);

    // Both answers start hidden and processed
    assert.equal(answer1.classList.contains('sat-answer-hidden'), true);
    assert.equal(answer2.classList.contains('sat-answer-hidden'), true);

    // Even when sharing the same parentElement, both answer1 and answer2 keep their own button containers
    const containers = sharedParent.querySelectorAll('.sat-button-container');
    assert.equal(containers.length, 2);

    // Only the first show/hide buttons get the singleton IDs (no duplicate IDs in DOM)
    const showBtns = sharedParent.querySelectorAll('[data-action="show"]');
    assert.equal(showBtns.length, 2);
    assert.equal(showBtns[0].id, 'sat-show-answer-btn');
    assert.equal(showBtns[1].id, '');

    // Clicking show on answer2 reveals only answer2, not answer1
    showBtns[1].click();
    assert.equal(answer1.classList.contains('sat-answer-hidden'), true);
    assert.equal(answer2.classList.contains('sat-answer-hidden'), false);

    // Simulate SPA URL navigation to q=2
    locationObj.href = 'https://satsuitequestionbank.collegeboard.org/digital/results?q=2';
    observers[0](); // urlChangeObserver callback
    assert.equal(answer2.classList.contains('sat-answer-hidden'), true);

    // User immediately clicks Show Answer on answer1 BEFORE the 500ms timer fires
    showBtns[0].click();
    assert.equal(answer1.classList.contains('sat-answer-hidden'), false);

    // Fire the 500ms timer -> must NOT re-hide answer1 that the user just opened
    const activeTimer = timeouts.find((t) => !t.cleared);
    assert.ok(activeTimer);
    activeTimer.fn();
    assert.equal(answer1.classList.contains('sat-answer-hidden'), false);
  });
});

describe('SATSuite background script (background.js)', () => {
  it('preserves existing animationEnabled setting on update and toggles state on icon click', async () => {
    const bgSource = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
    const storageMap = { animationEnabled: true };
    const onInstalledListeners = [];
    const onClickedListeners = [];
    const sentMessages = [];
    let lastTitle = '';

    const context = vm.createContext({
      console,
      Boolean,
      Promise,
      browser: {
        storage: {
          local: {
            get: async (k) => ({ [k]: storageMap[k] }),
            set: async (items) => Object.assign(storageMap, items)
          }
        },
        runtime: {
          onInstalled: { addListener: (fn) => onInstalledListeners.push(fn) }
        },
        action: {
          onClicked: { addListener: (fn) => onClickedListeners.push(fn) },
          setIcon: () => {},
          setTitle: ({ title }) => { lastTitle = title; }
        },
        tabs: {
          query: async () => [{ id: 101 }],
          sendMessage: async (tabId, msg) => { sentMessages.push({ tabId, msg }); }
        }
      }
    });

    vm.runInContext(bgSource, context);
    await new Promise((r) => setTimeout(r, 10));

    await onInstalledListeners[0]();
    assert.equal(storageMap.animationEnabled, true);
    assert.ok(lastTitle.includes('Animation: ON'));

    await onClickedListeners[0]();
    assert.equal(storageMap.animationEnabled, false);
    assert.ok(lastTitle.includes('Animation: OFF'));
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].msg.animationEnabled, false);
  });
});
