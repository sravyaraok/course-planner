/* Top bar: university / plan selection, plan CRUD, import / export. */
window.Components['app-header'] = class AppHeader {
  constructor(host) {
    this.el = Utils.template('app-header');
    host.replaceWith(this.el);
    this.refs = Utils.refs(this.el);

    this.refs.university.addEventListener('change', (e) => Store.selectUniversity(e.target.value));
    this.refs.plan.addEventListener('change', (e) => Store.selectPlan(e.target.value));
    this.refs.file.addEventListener('change', (e) => this.importFile(e.target.files[0]));
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) this.onAction(btn.dataset.action);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.hdr-menu')) this.refs.exportMenu.hidden = true;
    });
  }

  onAction(action) {
    try {
      switch (action) {
        case 'manage-universities': Bus.emit('manage-universities'); break;
        case 'new-plan': {
          if (!Store.university()) { Utils.toast('Create a university first', 'error'); Bus.emit('manage-universities'); break; }
          const name = prompt('Name for the new plan:', 'New Plan');
          if (name !== null) Store.createPlan({ planName: name.trim() || 'New Plan' });
          break;
        }
        case 'duplicate-plan': Store.duplicatePlan(); Utils.toast('Plan duplicated', 'success'); break;
        case 'delete-plan': {
          const p = Store.plan();
          if (p && confirm(`Delete plan "${p.planName}"? This cannot be undone.`)) Store.deletePlan(p.planId);
          break;
        }
        case 'import': this.refs.file.value = ''; this.refs.file.click(); break;
        case 'toggle-export': this.refs.exportMenu.hidden = !this.refs.exportMenu.hidden; break;
        case 'export-plan': {
          const p = Store.exportPlan();
          Utils.download(`plan-${Utils.slug(p.planName)}.json`, p);
          break;
        }
        case 'export-university': {
          const u = Store.exportUniversity();
          Utils.download(`university-${Utils.slug(u.universityId)}.json`, u);
          break;
        }
        case 'export-workspace': Utils.download('course-planner-workspace.json', Store.exportWorkspace()); break;
        case 'reset':
          if (confirm('Replace ALL local data with the sample data? Export first if you want to keep your changes.')) {
            Store.resetToSample();
            Utils.toast('Sample data restored', 'success');
          }
          break;
        default: break;
      }
      if (action.startsWith('export-')) this.refs.exportMenu.hidden = true;
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async importFile(file) {
    if (!file) return;
    try {
      const counts = Store.importData(JSON.parse(await file.text()));
      const parts = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`);
      Utils.toast(`Imported ${parts.join(', ') || 'nothing'}`, 'success');
    } catch (err) {
      Utils.toast(`Import failed: ${err.message}`, 'error');
    }
  }

  render() {
    const { state } = Store;
    const { university, plan, duplicate } = this.refs;
    university.innerHTML = state.universities.length
      ? state.universities.map((u) => `<option value="${Utils.esc(u.universityId)}">${Utils.esc(u.universityName)}</option>`).join('')
      : '<option value="">— none —</option>';
    university.value = state.ui.universityId || '';

    const plans = Store.plansForUniversity();
    plan.innerHTML = plans.length
      ? plans.map((p) => `<option value="${Utils.esc(p.planId)}">${Utils.esc(p.planName)}</option>`).join('')
      : '<option value="">— no plans —</option>';
    plan.value = state.ui.planId || '';
    plan.disabled = !plans.length;
    duplicate.disabled = !Store.plan();
    this.refs.delete.disabled = !Store.plan();
  }
};
