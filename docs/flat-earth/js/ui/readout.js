function column(heading, rows) {
  const col = document.createElement('div');
  col.className = 'readout-column';
  const h = document.createElement('h3');
  h.textContent = heading;
  col.append(h);
  for (const r of rows) {
    const line = document.createElement('div');
    line.className = 'readout-row';
    const l = document.createElement('span');
    l.textContent = r.label;
    const v = document.createElement('strong');
    v.textContent = r.value;
    line.append(l, v);
    col.append(line);
  }
  return col;
}

export function renderReadout(el, module, state) {
  el.innerHTML = '';

  const claim = document.createElement('p');
  claim.className = 'readout-claim';
  claim.textContent = `CLAIM — ${module.claim}`;

  const grid = document.createElement('div');
  grid.className = 'readout-grid';

  const data = module.readout(state.get());
  grid.append(
    column('PREDICTION — FLAT', data.flat),
    column('PREDICTION — GLOBE', data.globe),
  );

  const observed = document.createElement('p');
  observed.className = 'readout-observed';
  observed.textContent = `OBSERVED — ${data.observed}`;

  el.append(claim, grid, observed);
}
