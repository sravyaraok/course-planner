/*
 * Boots the app: loads state, mounts every component registered on window.Components
 * into its matching [data-component] element, and re-renders on state changes.
 */
document.addEventListener('DOMContentLoaded', () => {
  Store.load();
  const instances = [];
  document.querySelectorAll('[data-component]').forEach((host) => {
    const Component = window.Components[host.dataset.component];
    if (!Component) {
      console.warn(`No component registered for "${host.dataset.component}"`);
      return;
    }
    const instance = new Component(host);
    instances.push(instance);
  });
  const renderAll = () => instances.forEach((c) => c.render && c.render());
  Store.subscribe(renderAll);
  renderAll();
});
