export function setLoading(visible, statusText = '') {
  const screen = document.getElementById('loading-screen');
  const status = document.getElementById('loading-status');
  if (statusText) status.textContent = statusText;
  screen.hidden = !visible;
}
