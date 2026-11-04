(function (global) {
  var MGI = global.MGI || {};

  function recordsFor(list, studentId) {
    if (!studentId) return list.slice();
    return list.filter(function (r) {
      return r.studentId === studentId;
    });
  }

  function inRange(date, from, to) {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  MGI.analytics = {
    attendanceSummary: function (attendance, studentId, from, to) {
      var rows = recordsFor(attendance, studentId).filter(function (r) {
        return inRange(r.date, from, to);
      });
      var present = 0;
      var absent = 0;
      var leave = 0;
      rows.forEach(function (r) {
        if (r.status === "Present") present += 1;
        else if (r.status === "Absent") absent += 1;
        else if (r.status === "Leave") leave += 1;
      });
      var total = present + absent + leave;
      return {
        present: present,
        absent: absent,
        leave: leave,
        total: total,
        percentage: total === 0 ? null : (present / total) * 100
      };
    },

    isOverdue: function (task, today) {
      today = today || MGI.utils.today();
      return task.status !== "Completed" && task.dueDate < today;
    },

    taskSummary: function (tasks, studentId, from, to) {
      var rows = recordsFor(tasks, studentId).filter(function (t) {
        return inRange(t.dueDate, from, to);
      });
      var pending = 0;
      var progress = 0;
      var completed = 0;
      var overdue = 0;
      rows.forEach(function (t) {
        if (t.status === "Pending") pending += 1;
        else if (t.status === "In Progress") progress += 1;
        else if (t.status === "Completed") completed += 1;
        if (MGI.analytics.isOverdue(t)) overdue += 1;
      });
      var total = rows.length;
      return {
        total: total,
        pending: pending,
        inProgress: progress,
        completed: completed,
        overdue: overdue,
        percentage: total === 0 ? null : (completed / total) * 100
      };
    },

    activitySummary: function (activities, studentId, from, to) {
      var rows = recordsFor(activities, studentId).filter(function (a) {
        return inRange(a.date, from, to);
      });
      var positive = 0;
      var negative = 0;
      rows.forEach(function (a) {
        if (a.type === "Positive") positive += a.points;
        else negative += a.points;
      });
      return {
        count: rows.length,
        positive: positive,
        negative: negative,
        net: positive - negative,
        available: rows.length > 0
      };
    },

    rateAttendance: function (pct) {
      var t = MGI.config.thresholds.attendance;
      if (pct === null || pct === undefined) {
        return { rating: "N/A", label: "Not available", rule: "No attendance records", value: "N/A" };
      }
      var shown = MGI.utils.pct(pct);
      if (pct >= t.green) return { rating: "Green", label: "Green", rule: t.green + "% or more", value: shown };
      if (pct >= t.amberMin) {
        return {
          rating: "Amber",
          label: "Amber",
          rule: t.amberMin.toFixed(1) + "% to " + (t.green - 0.1).toFixed(1) + "%",
          value: shown
        };
      }
      return { rating: "Red", label: "Red", rule: "below " + t.amberMin + "%", value: shown };
    },

    rateTasks: function (pct) {
      var t = MGI.config.thresholds.taskCompletion;
      if (pct === null || pct === undefined) {
        return { rating: "N/A", label: "Not available", rule: "No tasks", value: "N/A" };
      }
      var shown = MGI.utils.pct(pct);
      if (pct >= t.green) return { rating: "Green", label: "Green", rule: t.green + "% or more", value: shown };
      if (pct >= t.amberMin) {
        return {
          rating: "Amber",
          label: "Amber",
          rule: t.amberMin.toFixed(1) + "% to " + (t.green - 0.1).toFixed(1) + "%",
          value: shown
        };
      }
      return { rating: "Red", label: "Red", rule: "below " + t.amberMin + "%", value: shown };
    },

    rateOverdue: function (count, hasTasks) {
      var t = MGI.config.thresholds.overdue;
      if (!hasTasks) {
        return { rating: "N/A", label: "Not available", rule: "No tasks", value: "N/A" };
      }
      if (count <= t.greenMax) return { rating: "Green", label: "Green", rule: "0 overdue", value: String(count) };
      if (count <= t.amberMax) return { rating: "Amber", label: "Amber", rule: "1 to 2 overdue", value: String(count) };
      return { rating: "Red", label: "Red", rule: "3 or more overdue", value: String(count) };
    },

    rateNet: function (summary) {
      var t = MGI.config.thresholds.netPoints;
      if (!summary.available) {
        return { rating: "N/A", label: "Not available", rule: "No activity records", value: "N/A" };
      }
      var n = summary.net;
      var shown = (n > 0 ? "+" : "") + n;
      if (n >= t.green) return { rating: "Green", label: "Green", rule: "+" + t.green + " or more", value: shown };
      if (n >= t.amberMin) return { rating: "Amber", label: "Amber", rule: "0 to +" + (t.green - 1), value: shown };
      return { rating: "Red", label: "Red", rule: "below 0", value: shown };
    },

    overallStatus: function (ratings) {
      var available = ratings.filter(function (r) {
        return r.rating !== "N/A";
      });
      if (available.length < 2) return "Not Rated";
      if (available.some(function (r) { return r.rating === "Red"; })) return "At Risk";
      if (available.every(function (r) { return r.rating === "Green"; })) return "Excellent";
      if (available.some(function (r) { return r.rating === "Green"; })) return "Good";
      return "Needs Improvement";
    },

    studentMetrics: function (state, student, from, to) {
      var att = MGI.analytics.attendanceSummary(state.attendance, student.id, from, to);
      var tsk = MGI.analytics.taskSummary(state.tasks, student.id, from, to);
      var act = MGI.analytics.activitySummary(state.activities, student.id, from, to);
      var ratings = [
        MGI.analytics.rateAttendance(att.percentage),
        MGI.analytics.rateTasks(tsk.percentage),
        MGI.analytics.rateOverdue(tsk.overdue, tsk.total > 0),
        MGI.analytics.rateNet(act)
      ];
      return {
        student: student,
        attendance: att,
        tasks: tsk,
        activities: act,
        ratings: {
          attendance: ratings[0],
          tasks: ratings[1],
          overdue: ratings[2],
          net: ratings[3]
        },
        overall: MGI.analytics.overallStatus(ratings)
      };
    },

    courseCounts: function (students) {
      return MGI.config.courses.map(function (course) {
        return {
          course: course,
          count: students.filter(function (s) { return s.course === course; }).length
        };
      });
    },

    todayAttendance: function (state, date) {
      date = date || MGI.utils.today();
      var active = state.students.filter(function (s) { return s.status === "Active"; });
      var present = 0;
      var absent = 0;
      var leave = 0;
      var marked = {};
      state.attendance.forEach(function (r) {
        if (r.date === date) marked[r.studentId] = r.status;
      });
      active.forEach(function (s) {
        var st = marked[s.id];
        if (st === "Present") present += 1;
        else if (st === "Absent") absent += 1;
        else if (st === "Leave") leave += 1;
      });
      return {
        date: date,
        present: present,
        absent: absent,
        leave: leave,
        notMarked: Math.max(0, active.length - present - absent - leave),
        active: active.length
      };
    },

    institute: function (state, from, to) {
      var att = MGI.analytics.attendanceSummary(state.attendance, null, from, to);
      var tsk = MGI.analytics.taskSummary(state.tasks, null, from, to);
      var act = MGI.analytics.activitySummary(state.activities, null, from, to);
      var total = state.students.length;
      var active = state.students.filter(function (s) { return s.status === "Active"; }).length;
      return {
        totalStudents: total,
        activeStudents: active,
        courses: MGI.analytics.courseCounts(state.students),
        attendance: att,
        tasks: tsk,
        activities: act,
        today: MGI.analytics.todayAttendance(state)
      };
    },

    ranking: function (state) {
      return state.students.map(function (s) {
        return MGI.analytics.studentMetrics(state, s);
      });
    }
  };

  global.MGI = MGI;
})(window);
