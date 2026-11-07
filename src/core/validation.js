/* Pre-/co-requisite checks for a plan. Pre-college credits are treated as satisfied. */
const Validation = {
  /** @returns {Map<string, string[]>} courseId -> list of issues */
  validate(plan) {
    const issues = new Map();
    if (!plan) return issues;
    const when = new Map(plan.courseList.map((e) => [e.courseId, Utils.semesterOrder(e.semester)]));
    const roster = new Set(Store.university(plan.universityId)?.courses || []);
    const fmt = (set) => (set.length > 1 ? `one of ${set.join(', ')}` : set[0]);

    for (const entry of plan.courseList) {
      const msgs = [];
      const course = Store.course(entry.courseId);
      if (!course) {
        msgs.push('Course is not in the catalog');
      } else {
        if (!roster.has(course.id)) msgs.push('Course is not in this university\'s roster');
        if (entry.semester !== PRE_COLLEGE) {
          const mine = when.get(entry.courseId);
          for (const set of course.prerequisites || []) {
            if (!set.some((id) => when.has(id) && when.get(id) < mine)) {
              msgs.push(`Prerequisite: take ${fmt(set)} before ${entry.semester}`);
            }
          }
          for (const set of course.corequisites || []) {
            if (!set.some((id) => when.has(id) && when.get(id) <= mine)) {
              msgs.push(`Co-requisite: take ${fmt(set)} before or during ${entry.semester}`);
            }
          }
        }
      }
      if (msgs.length) issues.set(entry.courseId, msgs);
    }
    return issues;
  },
};
