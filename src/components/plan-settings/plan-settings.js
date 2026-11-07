/* Collapsible configuration panel for the current plan. */
window.Components['plan-settings'] = class PlanSettings {
  constructor(host) {
    this.el = Utils.template('plan-settings');
    host.replaceWith(this.el);
    this.refs = Utils.refs(this.el);

    this.el.addEventListener('toggle', () => {
      if (Store.state.ui.settingsOpen !== this.el.open) Store.setUi({ settingsOpen: this.el.open });
    });
    this.el.querySelector('.ps-section').addEventListener('change', (e) => this.onFieldChange(e.target));
    this.refs.addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.safe(() => Store.addArea(this.refs.newArea.value));
      this.refs.newArea.value = '';
      this.refs.newArea.focus();
    });
    this.refs.areas.addEventListener('change', (e) => {
      if (e.target.matches('input[data-area]')) {
        const ok = this.safe(() => Store.renameArea(e.target.dataset.area, e.target.value));
        if (!ok) e.target.value = e.target.dataset.area;
      }
    });
    this.refs.areas.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const area = btn.closest('li').dataset.area;
      if (btn.dataset.action === 'up') Store.moveArea(area, -1);
      if (btn.dataset.action === 'down') Store.moveArea(area, 1);
      if (btn.dataset.action === 'delete') {
        const used = Store.plan().courseList.filter((x) => x.areas.includes(area)).length;
        const msg = used ? `Delete area "${area}"? ${used} course(s) will lose this area.` : `Delete area "${area}"?`;
        if (confirm(msg)) Store.deleteArea(area);
      }
    });
  }

  safe(fn) {
    try { fn(); return true; } catch (err) { Utils.toast(err.message, 'error'); return false; }
  }

  onFieldChange(input) {
    const field = input.dataset.field;
    if (!field) return;
    const p = Store.plan();
    const start = Utils.parseSemester(p.startSemester) || { term: 'Fall', year: new Date().getFullYear() };
    switch (field) {
      case 'planName': Store.updatePlan({ planName: input.value.trim() || p.planName }); break;
      case 'startTerm': Store.updatePlan({ startSemester: `${input.value} ${start.year}` }); break;
      case 'startYear': {
        const y = parseInt(input.value, 10);
        if (y >= 1900 && y <= 2200) Store.updatePlan({ startSemester: `${start.term} ${y}` });
        else this.render();
        break;
      }
      case 'years': {
        const n = parseInt(input.value, 10);
        if (n >= 1 && n <= 10) Store.updatePlan({ years: n });
        else this.render();
        break;
      }
      case 'showWinter': Store.updatePlan({ showWinter: input.checked }); break;
      case 'showSummer': Store.updatePlan({ showSummer: input.checked }); break;
      default: break;
    }
  }

  render() {
    const p = Store.plan();
    this.el.hidden = !p;
    if (!p) return;
    this.el.open = !!Store.state.ui.settingsOpen;
    const r = this.refs;
    const start = Utils.parseSemester(p.startSemester) || { term: 'Fall', year: new Date().getFullYear() };
    const setVal = (el, v) => { if (document.activeElement !== el) el.value = v; };
    setVal(r.planName, p.planName);
    setVal(r.startTerm, start.term);
    setVal(r.startYear, start.year);
    setVal(r.years, p.years);
    r.showWinter.checked = p.showWinter;
    r.showSummer.checked = p.showSummer;

    const terms = ['Fall', 'Spring', p.showWinter && 'Winter', p.showSummer && 'Summer'].filter(Boolean).join(', ');
    r.summary.textContent = `${p.planName} · starts ${p.startSemester} · ${p.years} yr · ${terms} · ${p.areasOfStudy.length} areas`;

    r.areas.innerHTML = p.areasOfStudy.map((a, i) => `
      <li data-area="${Utils.esc(a)}">
        <input data-area="${Utils.esc(a)}" value="${Utils.esc(a)}" title="Rename area">
        <button type="button" class="icon" data-action="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon" data-action="down" title="Move down" ${i === p.areasOfStudy.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon" data-action="delete" title="Delete area">✕</button>
      </li>`).join('') || '<li class="muted">No areas yet — add one below.</li>';
  }
};
