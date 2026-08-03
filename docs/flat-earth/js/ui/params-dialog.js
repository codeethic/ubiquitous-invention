const PARAMS = [
  ['Earth radius (globe model)', '6371 km'],
  ['Axial tilt', '23.44°'],
  ['Flat map projection', 'North-polar azimuthal equidistant'],
  ['Flat disc radius', '20 015 km (pole to −90° rim)'],
  ['Flat sun altitude', '5000 km'],
  ['Flat sun diameter', 'Derived — sized to subtend the observed 0.533° overhead'],
  ['Flat spotlight radius', '14 153 km — chosen so a centred circle would cover half the disc'],
  ['Cruise speed for flight times', '900 km/h'],
  ['Atmospheric refraction', 'Excluded from all calculations'],
  ['Time zone offsets', 'Standard time; daylight saving ignored'],
  ['Solar position', 'Mean sun; equation of time (±16 min) ignored'],
  ['Sunrise / sunset', 'Geometric horizon; solar semidiameter and refraction ignored'],
];

export function renderParamsDialog(dialogEl, buttonEl) {
  dialogEl.innerHTML = '';

  const h = document.createElement('h2');
  h.textContent = 'MODEL PARAMETERS';

  const note = document.createElement('p');
  note.textContent =
    'The flat model is given its own standard best-case figures. Where a value '
    + 'could be chosen to flatter or hobble it, it is chosen to flatter it.';

  const list = document.createElement('dl');
  for (const [k, v] of PARAMS) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    list.append(dt, dd);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.onclick = () => dialogEl.close();

  dialogEl.append(h, note, list, close);
  buttonEl.onclick = () => dialogEl.showModal();
}
