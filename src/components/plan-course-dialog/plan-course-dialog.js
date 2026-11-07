/* Modal for adding a course to the plan or editing its semester / areas. */
window.Components['plan-course-dialog'] = class PlanCourseDialog {
  constructor(host) {
    this.el = Utils.template('plan-course-dialog');
    host.replaceWith(this.el);
    this.refs = Utils.refs(this.el);

    Bus.on('edit-plan-entry', (opts) => this.open(opts || {}));
    this.refs.form.addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
    this.refs.course.addEventListener('input', () => this.onCourseChange());
    this.refs.areas.addEventListener('change', () => this.renderPrimary());
    this.el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') this.el.close();
      if (action === 'remove') this.remove();
      if (action === 'edit-course') {
        const id = this.refs.course.value.trim();
        this.el.close();
        Bus.emit('edit-course', Store.course(id) ? { courseId: id } : { presetId: id });
      }
    });
  }

  open({ courseId = null, semester = null, area = null }) {
    const plan = Store.plan();
    if (!plan) { Utils.toast('Create or select a plan first', 'error'); return; }
    const r = this.refs;
    const entry = courseId ? Store.entry(courseId) : null;
    this.editing = !!entry;

    r.title.textContent = entry ? `Edit ${courseId} in plan` : 'Add course to plan';
    r.course.value = courseId || '';
    r.course.readOnly = !!entry;
    r.options.innerHTML = Store.rosterCourses()
      .filter((c) => !plan.courseList.some((e) => e.courseId === c.id))
      .map((c) => `<option value="${Utils.esc(c.id)}">${Utils.esc(c.name)} (${Utils.formatCredits(c.credits)} cr)</option>`)
      .join('');

    const cols = Utils.planSemesters(plan);
    const sem = entry?.semester || semester || cols[1]?.key || PRE_COLLEGE;
    r.semester.innerHTML = cols.map((c) => `<option value="${Utils.esc(c.key)}">${Utils.esc(c.label)}</option>`).join('');
    r.semester.value = sem;

    const selected = new Set(entry ? entry.areas : area ? [area] : []);
    this.primary = entry?.areas.find((a) => plan.areasOfStudy.includes(a)) || area || null;
    r.areas.innerHTML = plan.areasOfStudy.map((a) => `
      <label><input type="checkbox" value="${Utils.esc(a)}" ${selected.has(a) ? 'checked' : ''}> ${Utils.esc(a)}</label>`).join('')
      || '<span class="muted">No areas defined — add some in Plan settings.</span>';
    r.primary.innerHTML = '';
    this.renderPrimary();

    r.error.textContent = '';
    this.onCourseChange();
    this.el.showModal();
    if (!entry) r.course.focus();
  }

  onCourseChange() {
    const r = this.refs;
    const id = r.course.value.trim();
    const c = Store.course(id);
    const entry = Store.entry(id);
    r.remove.hidden = !this.editing;
    r.editCourse.textContent = c ? 'Edit course…' : 'Create course…';
    if (!id) { r.info.innerHTML = ''; return; }
    if (!c) { r.info.innerHTML = '<span class="muted">Unknown course ID — use “Create course…” to add it to the roster.</span>'; return; }
    const issues = Validation.validate(Store.plan()).get(id) || [];
    r.info.innerHTML = `
      <div><b>${Utils.esc(c.name)}</b> · ${Utils.formatCredits(c.credits)} credits</div>
      ${c.description ? `<div class="muted">${Utils.esc(c.description)}</div>` : ''}
      ${c.prerequisites.length ? `<div><b>Pre-reqs:</b> ${Utils.esc(Utils.formatReqInline(c.prerequisites))}</div>` : ''}
      ${c.corequisites.length ? `<div><b>Co-reqs:</b> ${Utils.esc(Utils.formatReqInline(c.corequisites))}</div>` : ''}
      ${!this.editing && entry ? `<div class="pcd-note">Already planned in ${Utils.esc(Utils.semesterLabel(entry.semester))} — saving will move it.</div>` : ''}
      ${issues.map((m) => `<div class="pcd-warn">⚠ ${Utils.esc(m)}</div>`).join('')}`;
  }

  checkedAreas() {
    return [...this.refs.areas.querySelectorAll('input:checked')].map((i) => i.value);
  }

  renderPrimary() {
    const r = this.refs;
    const checked = this.checkedAreas();
    if (r.primary.options.length) this.primary = r.primary.value;
    if (!checked.includes(this.primary)) this.primary = checked[0] || null;
    r.primaryField.hidden = checked.length < 2;
    r.primary.innerHTML = checked.map((a) => `<option value="${Utils.esc(a)}">${Utils.esc(a)}</option>`).join('');
    if (this.primary) r.primary.value = this.primary;
  }

  save() {
    const r = this.refs;
    try {
      const courseId = r.course.value.trim();
      if (!courseId) throw new Error('Choose a course');
      const areas = this.checkedAreas();
      Store.saveEntry({ courseId, semester: r.semester.value, areas, primaryArea: r.primary.value || null });
      this.el.close();
      const issues = Validation.validate(Store.plan()).get(courseId);
      if (issues) Utils.toast(`${courseId}: ${issues[0]}`, 'error');
    } catch (err) {
      r.error.textContent = err.message;
    }
  }

  remove() {
    const id = this.refs.course.value.trim();
    Store.removeEntry(id);
    this.el.close();
    Utils.toast(`Removed ${id} from plan`, 'success');
  }
};
