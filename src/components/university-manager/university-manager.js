/* Modal for adding / editing / deleting universities. */
window.Components['university-manager'] = class UniversityManager {
  constructor(host) {
    this.el = Utils.template('university-manager');
    host.replaceWith(this.el);
    this.refs = Utils.refs(this.el);
    this.editingId = null;

    Bus.on('manage-universities', () => this.open());
    this.refs.form.addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.closest('tr')?.dataset.id;
      switch (btn.dataset.action) {
        case 'close': this.el.close(); break;
        case 'reset-form': this.resetForm(); break;
        case 'select': Store.selectUniversity(id); this.el.close(); break;
        case 'edit': this.startEdit(id); break;
        case 'delete': this.remove(id); break;
        default: break;
      }
    });
  }

  open() {
    this.resetForm();
    this.render();
    this.el.showModal();
  }

  resetForm() {
    this.editingId = null;
    const r = this.refs;
    r.id.value = '';
    r.name.value = '';
    r.error.textContent = '';
    r.formTitle.textContent = 'Add university';
    r.submit.textContent = 'Add university';
    r.cancelEdit.hidden = true;
  }

  startEdit(id) {
    const u = Store.university(id);
    if (!u) return;
    this.editingId = id;
    const r = this.refs;
    r.id.value = u.universityId;
    r.name.value = u.universityName;
    r.error.textContent = '';
    r.formTitle.textContent = `Edit ${u.universityName}`;
    r.submit.textContent = 'Save changes';
    r.cancelEdit.hidden = false;
    r.name.focus();
  }

  save() {
    try {
      Store.saveUniversity({ universityId: this.refs.id.value, universityName: this.refs.name.value }, this.editingId);
      Utils.toast(this.editingId ? 'University updated' : 'University added', 'success');
      this.resetForm();
    } catch (err) {
      this.refs.error.textContent = err.message;
    }
  }

  remove(id) {
    const u = Store.university(id);
    const plans = Store.plansForUniversity(id).length;
    if (confirm(`Delete ${u.universityName}? This also deletes its ${u.courses.length} roster course(s) and ${plans} plan(s).`)) {
      Store.deleteUniversity(id);
      if (this.editingId === id) this.resetForm();
    }
  }

  render() {
    const { state } = Store;
    this.refs.list.innerHTML = state.universities.map((u) => `
      <tr data-id="${Utils.esc(u.universityId)}" class="${u.universityId === state.ui.universityId ? 'um-current' : ''}">
        <td>${Utils.esc(u.universityName)}</td>
        <td><code>${Utils.esc(u.universityId)}</code></td>
        <td>${u.courses.length}</td>
        <td>${Store.plansForUniversity(u.universityId).length}</td>
        <td class="um-actions">
          <button class="icon" data-action="select" title="Open">Open</button>
          <button class="icon" data-action="edit" title="Edit">✎</button>
          <button class="icon" data-action="delete" title="Delete">🗑</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">No universities yet.</td></tr>';
  }
};
