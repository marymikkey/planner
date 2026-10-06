// Theme handling. The chosen theme is mirrored to localStorage so theme-boot.js can apply
// it before first paint (no flash); IndexedDB remains the source of truth.
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  try { localStorage.setItem('planner-theme', theme); } catch { /* storage may be blocked */ }
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17181a' : '#f4f0e7');
}
