/* Sidebar list of the selected university's roster, with search, CRUD, and drag source. */
window.Components['course-catalog'] = class CourseCatalog {
  constructor(host) {
    this.el = Utils.template('course-catalog');
    host.appendChild(this.el);
    this.refs = Utils.refs(this.el);

    this.refs.search.addEventListener('input', () => this.renderList());
    this.refs.filter.addEventListener('change', () => this.renderList());
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.closest('[data-course]')?.dataset.course;
      switch (btn.dataset.action) {
        case 'new-course': Bus.emit('edit-course', {}); break;
        case 'edit-course': Bus.emit('edit-course', { courseId: id }); break;
        case 'plan-course': Bus.emit('edit-plan-entry', { courseId: id }); break;
        case 'delete-course': this.deleteCourse(id); break;
        default: break;
      }
    });
    this.refs.list.addEventListener('dragstart', (e) => {
      const item = Utils.targetEl(e).closest('[data-course]');
      if (!item) return;
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', JSON.stringify({ courseId: item.dataset.course }));
      document.body.classList.add('is-dragging');
    });
    this.refs.list.addEventListener('dragend', () => document.body.classList.remove('is-dragging'));
  }

  deleteCourse(id) {
    const plans = Store.plansForUniversity().filter((p) => p.courseList.some((e) => e.courseId === id));
    const note = plans.length ? `\n\nIt will also be removed from ${plans.length} plan(s): ${plans.map((p) => p.planName).join(', ')}.` : '';
    if (confirm(`Delete course ${id} from ${Store.university().universityName}?${note}`)) {
      Store.deleteCourse(id);
      Utils.toast(`Deleted ${id}`, 'success');
    }
  }

  render() {
    const uni = Store.university();
    this.refs.newBtn.disabled = !uni;
    this.refs.count.textContent = uni ? `(${uni.courses.length})` : '';
    this.renderList();
  }

  renderList() {
    const uni = Store.university();
    const list = this.refs.list;
    if (!uni) { list.innerHTML = '<li class="cc-empty muted">Select or create a university.</li>'; return; }

    const plan = Store.plan();
    const issues = Validation.validate(plan);
    const q = this.refs.search.value.trim().toLowerCase();
    const filter = this.refs.filter.value;
    const courses = Store.rosterCourses()
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      .filter((c) => !q || `${c.id} ${c.name} ${c.description}`.toLowerCase().includes(q))
      .filter((c) => {
        const entry = plan?.courseList.find((e) => e.courseId === c.id);
        if (filter === 'planned') return !!entry;
        if (filter === 'unplanned') return !entry;
        if (filter === 'issues') return issues.has(c.id);
        return true;
      });

    if (!courses.length) {
      list.innerHTML = `<li class="cc-empty muted">${uni.courses.length ? 'No matching courses.' : 'No courses yet — click “+ New”.'}</li>`;
      return;
    }
    list.innerHTML = courses.map((c) => {
      const entry = plan?.courseList.find((e) => e.courseId === c.id);
      const reqs = [
        c.prerequisites.length ? `<div><b>Pre:</b> ${Utils.esc(Utils.formatReqInline(c.prerequisites))}</div>` : '',
        c.corequisites.length ? `<div><b>Co:</b> ${Utils.esc(Utils.formatReqInline(c.corequisites))}</div>` : '',
      ].join('');
      return `
        <li class="cc-item ${entry ? 'cc-planned' : ''} ${issues.has(c.id) ? 'cc-issue' : ''}" draggable="${plan ? 'true' : 'false'}"
            data-course="${Utils.esc(c.id)}" title="${Utils.esc(c.description || c.name)}">
          <div class="cc-row">
            <span class="cc-id">${Utils.esc(c.id)}</span>
            <span class="cc-cr">${Utils.formatCredits(c.credits)} cr</span>
          </div>
          <div class="cc-name">${Utils.esc(c.name)}</div>
          ${reqs ? `<div class="cc-reqs">${reqs}</div>` : ''}
          <div class="cc-row cc-actions">
            ${entry
              ? `<span class="cc-badge" title="${Utils.esc(entry.areas.join(', '))}">${issues.has(c.id) ? '⚠ ' : ''}${Utils.esc(Utils.semesterLabel(entry.semester))}</span>`
              : '<span class="muted cc-unplanned">Not planned</span>'}
            <span class="cc-btns">
              ${plan ? `<button class="icon" data-action="plan-course" title="${entry ? 'Edit in plan' : 'Add to plan'}">${entry ? '📅' : '➕'}</button>` : ''}
              <button class="icon" data-action="edit-course" title="Edit course">✎</button>
              <button class="icon" data-action="delete-course" title="Delete course">🗑</button>
            </span>
          </div>
        </li>`;
    }).join('');
  }
};
