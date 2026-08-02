/**
 * Builds inputs from module.controls and writes changes into the state store.
 * Two control kinds: a range slider (default) and a select (when `options` is
 * present). Values are clamped by the input element itself.
 */
export function renderControls(el, controls, state) {
  el.innerHTML = '';
  const current = state.get();

  for (const c of controls) {
    const wrap = document.createElement('label');
    wrap.className = 'control';

    const name = document.createElement('span');
    name.className = 'control-label';
    name.textContent = c.label;

    const value = document.createElement('span');
    value.className = 'control-value';

    let input;
    if (c.options) {
      input = document.createElement('select');
      for (const o of c.options) {
        const opt = document.createElement('option');
        opt.value = String(o.value);
        opt.textContent = o.label;
        if (o.value === current[c.id]) opt.selected = true;
        input.append(opt);
      }
      value.textContent = '';
      input.oninput = () => state.set({ [c.id]: input.value });
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step;
      input.value = current[c.id];
      const show = () => { value.textContent = `${input.value} ${c.unit ?? ''}`.trim(); };
      show();
      input.oninput = () => { show(); state.set({ [c.id]: Number(input.value) }); };
    }

    wrap.append(name, input, value);
    el.append(wrap);
  }
}
