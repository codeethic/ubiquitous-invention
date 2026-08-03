export function renderSelector(el, modules, activeId, onChange) {
  el.innerHTML = '';
  for (const m of modules) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.title;
    if (m.id === activeId) opt.selected = true;
    el.append(opt);
  }
  el.onchange = () => onChange(el.value);
}
