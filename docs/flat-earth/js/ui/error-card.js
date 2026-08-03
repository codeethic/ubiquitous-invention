export function showErrorCard(el, title, detail) {
  el.hidden = false;
  el.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'error-card';
  const h = document.createElement('strong');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  card.append(h, p);
  el.append(card);
}

export function clearErrorCard(el) {
  el.hidden = true;
  el.innerHTML = '';
}
