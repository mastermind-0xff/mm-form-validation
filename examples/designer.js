/**
 * The look designer: edits the settings of `@mmutils/form-validation/css`,
 * styles the page's forms with the CSS they generate, and exports them for
 * another project. Settings are the only state that gets exported; the scheme
 * shown and the open view belong to this page.
 */
import {
  COLORS,
  INLINE_NOTES,
  TOKENS,
  agentBrief,
  defaultLook,
  generateCss,
  generateChanges,
  headSnippet,
  lookChanges,
  parseLook,
} from '../dist/esm/css/index.js';

const element = (id) => document.getElementById(id);

const read = (key) => {
  try {
    return localStorage.getItem(`fv-demo-${key}`);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(`fv-demo-${key}`, value);
  } catch {
    // private mode: the choice lasts until the page reloads
  }
};

const make = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const setRadio = (name, value) => {
  const input = document.querySelector(
    `input[name="${name}"][value="${CSS.escape(value)}"]`
  );
  if (input) input.checked = true;
};

function storedLook() {
  try {
    const result = parseLook(JSON.parse(read('look') ?? '{}'));
    return result.ok ? result.look : defaultLook();
  } catch {
    return defaultLook();
  }
}

const OUTPUTS = {
  brief: {
    file: 'form-look.md',
    type: 'text/markdown',
    text: (look) => agentBrief(look),
  },
  settings: {
    file: 'form-look.json',
    type: 'application/json',
    text: (look) => `${JSON.stringify(lookChanges(look), null, 2)}\n`,
  },
  changes: {
    file: 'form-fields.changes.css',
    type: 'text/css',
    text: (look) => generateChanges(look),
  },
  stylesheet: {
    file: 'form-fields.css',
    type: 'text/css',
    text: (look) => generateCss(look).stylesheet,
  },
  head: {
    file: 'form-fields.head.html',
    type: 'text/html',
    text: (look) => headSnippet(look),
  },
};

/** Bytes as they travel: the page's servers compress, so gzip is what counts. */
async function gzipSize(text) {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return (await new Response(stream).arrayBuffer()).byteLength;
}

const formatBytes = (bytes) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

async function describeSize(text) {
  if (text === '') return 'none';
  return `${formatBytes(new Blob([text]).size)}, ${formatBytes(await gzipSize(text))} gzipped`;
}

/**
 * How far things move between two sets of CSS: the largest change in position
 * or size of anything in the forms, in px. Transitions are off while measuring,
 * or a rect would be read at the start of one.
 */
function measureShift(style, inline, complete) {
  const targets = [...document.querySelectorAll('.cards *')];
  const freeze = make('style', {
    textContent:
      '*,*::before,*::after{transition:none!important;animation:none!important}',
  });
  const shown = style.textContent;
  const { scrollX, scrollY } = window;
  document.head.append(freeze);
  const rects = (css) => {
    style.textContent = css;
    return targets.map((target) => {
      const rect = target.getBoundingClientRect();
      return [
        rect.left + window.scrollX,
        rect.top + window.scrollY,
        rect.width,
        rect.height,
      ];
    });
  };
  const final = rects(complete);
  const worst = (from) =>
    from.reduce((largest, rect, index) => {
      const moved = Math.max(
        ...rect.map((value, part) => Math.abs(value - final[index][part]))
      );
      return Math.max(largest, moved);
    }, 0);
  const result = {
    withInline: inline === '' ? undefined : worst(rects(inline)),
    without: worst(rects('')),
    measured: targets.length,
  };
  style.textContent = shown;
  // laid out with the transitions still off, so nothing animates back
  void document.body.offsetHeight;
  freeze.remove();
  window.scrollTo(scrollX, scrollY);
  return result;
}

const px = (value) => `${Math.round(value * 10) / 10} px`;

/** Starts the panel. `onTiming` is called with the timing, now and on changes. */
export function startDesigner({ onTiming }) {
  const root = document.documentElement;
  const style = element('fv-css');
  const workspace = element('workspace');
  let look = storedLook();
  let view = 'design';
  let output = 'brief';
  let inlineOnly = false;
  let sizeRun = 0;
  const shows = [];

  /** The forms use what a project gets, in the order it gets it. */
  const preview = () =>
    generateCss({
      ...look,
      // the switch above the forms shows either scheme, whatever is exported
      darkMode: look.darkMode === 'none' ? 'none' : 'attribute',
    });

  async function renderExport() {
    const { inline, stylesheet } = generateCss(look);
    const { file, text } = OUTPUTS[output];
    const content = text(look);
    element('output-file').textContent = file;
    element('output-text').textContent =
      content === '' ? 'Nothing: the HTML holds all of it.' : content;
    element('copy').disabled = content === '';
    element('download').disabled = content === '';
    element('inline-note').textContent = INLINE_NOTES[look.inline];
    element('split').disabled = look.inline === 'none';
    element('inline-only').disabled = look.inline === 'none';
    const run = ++sizeRun;
    const [inlineSize, sheetSize] = await Promise.all([
      describeSize(inline),
      describeSize(stylesheet),
    ]);
    if (run !== sizeRun) return;
    element('size-inline').textContent = inlineSize;
    element('size-sheet').textContent = sheetSize;
  }

  function render() {
    const { inline, stylesheet, tokens } = preview();
    const complete = inline + stylesheet;
    const css = inlineOnly && inline !== '' ? inline : complete;
    if (style.textContent !== css) style.textContent = css;
    write('look', JSON.stringify(look));
    write('css', complete);
    const used = new Set(tokens);
    for (const show of shows) show(look, used);
    if (view === 'export') void renderExport();
  }

  /** Applies a change if the settings still parse. Says whether it did. */
  function update(change) {
    const result = parseLook({ ...look, ...change });
    if (!result.ok) return false;
    const timing = look.timing;
    look = result.look;
    element('shift-result').textContent = '';
    if (look.timing !== timing) onTiming(look.timing);
    render();
    return true;
  }

  const setToken = (name, value) =>
    update({ tokens: { ...look.tokens, [name]: value } });

  function tokenControl(name, token) {
    const id = `token-${name}`;
    const label = make('label', { htmlFor: id, textContent: token.label });
    const control = make('div', { className: 'control' }, label);
    let show;
    if (token.unit === undefined) {
      const input = make('input', { id, type: 'text', spellcheck: false });
      const list = make(
        'datalist',
        { id: `${id}-list` },
        ...token.suggestions.map((value) => make('option', { value }))
      );
      input.setAttribute('list', list.id);
      input.addEventListener('input', () => {
        const applied = setToken(name, input.value.trim());
        input.setAttribute('aria-invalid', String(!applied));
      });
      control.classList.add('wide');
      control.append(input, list);
      show = (value) => {
        if (document.activeElement === input) return;
        input.value = value;
        input.removeAttribute('aria-invalid');
      };
    } else {
      const number = make('input', {
        id,
        type: 'number',
        min: 0,
        step: token.step,
      });
      const slider = make('input', {
        type: 'range',
        min: token.min,
        max: token.max,
        step: token.step,
      });
      slider.setAttribute('aria-label', token.label);
      const change = (input) => {
        if (input.value === '') return;
        // a slider's steps can come back as 1.4500000000000002
        const value = Number(Number(input.value).toFixed(4));
        const applied = setToken(name, `${value}${token.unit}`);
        input.setAttribute('aria-invalid', String(!applied));
      };
      number.addEventListener('input', () => change(number));
      slider.addEventListener('input', () => change(slider));
      control.append(
        make(
          'span',
          { className: 'amount' },
          number,
          make('span', { textContent: token.unit })
        ),
        slider
      );
      show = (value) => {
        const amount = Number.parseFloat(value);
        slider.value = amount;
        if (document.activeElement === number) return;
        number.value = amount;
        number.removeAttribute('aria-invalid');
      };
    }
    shows.push((current, used) => {
      show(current.tokens[name]);
      const unused = !used.has(name);
      control.classList.toggle('unused', unused);
      control.title = unused ? 'This look does not use it.' : '';
    });
    return control;
  }

  for (const [name, token] of Object.entries(TOKENS))
    document
      .querySelector(`[data-group="${token.group}"]`)
      .append(tokenControl(name, token));

  function colorInput(name, label, scheme) {
    const input = make('input', { type: 'color' });
    input.setAttribute('aria-label', `${label}, ${scheme}`);
    input.addEventListener('input', () => {
      update({
        colors: {
          ...look.colors,
          [scheme]: { ...look.colors[scheme], [name]: input.value },
        },
      });
    });
    shows.push((current) => {
      input.value = current.colors[scheme][name];
      input.title = input.value;
      input.disabled = scheme === 'dark' && current.darkMode === 'none';
    });
    return input;
  }

  for (const [name, color] of Object.entries(COLORS)) {
    const { label } = color;
    const text = make('span', { textContent: label });
    element(color.group === 'button' ? 'button-colors' : 'colors').append(
      text,
      colorInput(
        name,
        color.group ? `Submit button, ${label}` : label,
        'light'
      ),
      colorInput(name, color.group ? `Submit button, ${label}` : label, 'dark')
    );
    shows.push((_, used) => {
      const unused = !used.has(name);
      text.classList.toggle('unused', unused);
      text.title = unused ? 'This look does not use it.' : '';
    });
  }

  for (const name of ['look', 'darkMode', 'timing', 'inline']) {
    element(name).addEventListener('change', (event) => {
      update({ [name]: event.target.value });
    });
    shows.push((current) => setRadio(name, current[name]));
  }

  element('split').addEventListener('change', (event) => {
    update({ split: event.target.checked });
  });
  shows.push((current) => {
    element('split').checked = current.split;
  });

  element('reset').addEventListener('click', () => {
    const { tokens, colors } = defaultLook();
    update({ tokens, colors });
  });

  // what this page shows: not exported
  const scheme = read('scheme') === 'dark' ? 'dark' : 'light';
  root.dataset.scheme = scheme;
  setRadio('scheme', scheme);
  element('scheme').addEventListener('change', (event) => {
    root.dataset.scheme = event.target.value;
    write('scheme', event.target.value);
  });

  element('view').addEventListener('change', (event) => {
    view = event.target.value;
    workspace.dataset.view = view;
    element('view-design').hidden = view !== 'design';
    element('view-export').hidden = view !== 'export';
    // leaving the export: back to the complete CSS, so nothing looks broken
    inlineOnly = false;
    element('inline-only').checked = false;
    render();
  });

  element('output').addEventListener('change', (event) => {
    output = event.target.value;
    void renderExport();
  });

  element('inline-only').addEventListener('change', (event) => {
    inlineOnly = event.target.checked;
    render();
  });

  element('check-shift').addEventListener('click', () => {
    const { inline, stylesheet } = preview();
    const { withInline, without, measured } = measureShift(
      style,
      inline,
      inline + stylesheet
    );
    element('shift-result').textContent =
      (withInline === undefined ?
        'Nothing is inlined, so the stylesheet must block rendering. '
      : `With this block, the stylesheet moves things by ${px(withInline)}. `) +
      `Without any field CSS it would be ${px(without)}. ` +
      `${measured} elements measured, as the forms are now.`;
  });

  const status = (text) => {
    element('output-status').textContent = text;
    setTimeout(() => {
      if (element('output-status').textContent === text)
        element('output-status').textContent = '';
    }, 2500);
  };

  element('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(OUTPUTS[output].text(look));
      status('Copied.');
    } catch {
      status('The browser refused: select the text below.');
    }
  });

  element('download').addEventListener('click', () => {
    const { file, type, text } = OUTPUTS[output];
    const url = URL.createObjectURL(new Blob([text(look)], { type }));
    make('a', { href: url, download: file }).click();
    URL.revokeObjectURL(url);
  });

  function importSettings(text) {
    const errors = element('import-errors');
    errors.replaceChildren();
    // a saved brief works too: its settings are the JSON block in it
    const json = /```json\r?\n([\s\S]*?)\r?\n```/.exec(text)?.[1] ?? text;
    let parsed;
    let problems;
    try {
      parsed = parseLook(JSON.parse(json));
      if (!parsed.ok) problems = parsed.errors;
    } catch {
      problems = ['That is not JSON, or a brief with its settings in it.'];
    }
    if (problems) {
      errors.append(
        ...problems.map((problem) => make('li', { textContent: problem }))
      );
      return;
    }
    update(parsed.look);
    errors.append(make('li', { className: 'ok', textContent: 'Imported.' }));
  }

  element('import-apply').addEventListener('click', () => {
    importSettings(element('import-text').value);
  });

  element('import-file').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const text = await file.text();
    element('import-text').value = text;
    importSettings(text);
    event.target.value = '';
  });

  render();
  onTiming(look.timing);
}
