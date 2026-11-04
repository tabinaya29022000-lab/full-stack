(function (global) {
  var MGI = global.MGI || {};
  console.log(global.MGI);
  console.log(MGI);

  function rangeLabel(from, to) {
    if (!from && !to) return "All stored records";
    return (from || "start") + " to " + (to || "today");
  }

  function table(headers, rows) {
    if (!rows.length) return MGI.utils.el("p", { text: "No records for the selected period" });
    var t = MGI.utils.el("table");
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    headers.forEach(function (h) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    t.appendChild(thead);
    var tb = document.createElement("tbody");
    rows.forEach(function (row) {
      var r = document.createElement("tr");
      row.forEach(function (c) {
        var td = document.createElement("td");
        td.textContent = c;
        r.appendChild(td);
      });
      tb.appendChild(r);
    });
    t.appendChild(tb);
    var wrap = MGI.utils.el("div", { className: "table-wrap" });
    wrap.appendChild(t);
    return wrap;
  }

  function csv(filename, headers, rows) {
    var lines = [headers.map(MGI.utils.csvEscape).join(",")];
    rows.forEach(function (row) {
      lines.push(row.map(MGI.utils.csvEscape).join(","));
    });
    MGI.utils.download(filename, "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
  }

  MGI.reports = {
    render: function () {
      var root = MGI.utils.byId("reports-root");
      MGI.utils.clear(root);
      var controls = MGI.utils.el("div", { className: "card filters no-print" });
      var type = MGI.utils.el("select", { id: "rpt-type" });
      MGI.ui.fillSelect(type, [{ value: "institute", label: "Institute-wide report" }, { value: "individual", label: "Individual student report" }], MGI.uiState.reportType || "institute");
      var student = MGI.utils.el("select", { id: "rpt-student" });
      MGI.ui.fillSelect(student, MGI.ui.studentOptions(false), MGI.uiState.reportStudent || "");
      var from = MGI.utils.el("input", { type: "date", id: "rpt-from", value: MGI.uiState.reportFrom || "" });
      var to = MGI.utils.el("input", { type: "date", id: "rpt-to", value: MGI.uiState.reportTo || "" });
      [["Report type", type], ["Student", student], ["From", from], ["To", to]].forEach(function (row) {
        var f = MGI.utils.el("div", { className: "field" });
        f.appendChild(MGI.utils.el("label", { text: row[0] }));
        f.appendChild(row[1]);
        controls.appendChild(f);
      });
      var printBtn = MGI.utils.el("button", { type: "button", className: "btn", text: "Print Report" });
      printBtn.addEventListener("click", function () { global.print(); });
      controls.appendChild(printBtn);
      ["Students", "Attendance", "Tasks", "Activities"].forEach(function (name) {
        var b = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "CSV: " + name });
        b.addEventListener("click", function () { MGI.reports.exportCsv(name.toLowerCase()); });
        controls.appendChild(b);
      });
      root.appendChild(controls);
      var out = MGI.utils.el("div", { id: "report-output" });
      root.appendChild(out);
      function draw() {
        MGI.uiState.reportType = type.value;
        MGI.uiState.reportStudent = student.value;
        MGI.uiState.reportFrom = from.value;
        MGI.uiState.reportTo = to.value;
        MGI.storage.saveUi(MGI.uiState);
        MGI.utils.clear(out);
        if (from.value && to.value && from.value > to.value) {
          out.appendChild(MGI.utils.el("p", { className: "field-error", role: "alert", text: "From must not be later than To. The previous report was not replaced." }));
          return;
        }
        var f = from.value || null;
        var t = to.value || null;
        if (type.value === "institute") MGI.reports.institute(out, f, t);
        else MGI.reports.individual(out, student.value, f, t);
      }
      [type, student, from, to].forEach(function (el) { el.addEventListener("change", draw); });
      draw();
    },

    institute: function (out, from, to) {
      var inst = MGI.analytics.institute(MGI.state, from, to);
      out.appendChild(MGI.utils.el("h2", { text: "Institute Performance Report" }));
      out.appendChild(MGI.utils.el("p", { text: "Generated " + new Date().toLocaleString("en-GB") }));
      out.appendChild(MGI.utils.el("p", { text: "Date range: " + rangeLabel(from, to) + ". Attendance is filtered by attendance date, activities by activity date, and tasks by due date." }));
      var metrics = MGI.utils.el("div", { className: "grid grid-4" });
      metrics.appendChild(MGI.ui.metric("Students", inst.totalStudents));
      metrics.appendChild(MGI.ui.metric("Active", inst.activeStudents));
      metrics.appendChild(MGI.ui.metric("Attendance", MGI.utils.pct(inst.attendance.percentage)));
      metrics.appendChild(MGI.ui.metric("Task completion", MGI.utils.pct(inst.tasks.percentage)));
      out.appendChild(metrics);
      out.appendChild(MGI.utils.el("h3", { text: "Course-wise counts" }));
      out.appendChild(table(["Course", "Students"], inst.courses.map(function (c) { return [c.course, String(c.count)]; })));
      out.appendChild(MGI.utils.el("h3", { text: "Student list" }));
      out.appendChild(table(["Student ID", "Name", "Course", "Batch", "Status"], MGI.state.students.map(function (s) {
        return [s.studentCode, s.fullName, s.course, s.batch, s.status];
      })));
      out.appendChild(MGI.utils.el("h3", { text: "Attendance and leave summary" }));
      if (!inst.attendance.total) out.appendChild(MGI.utils.el("p", { text: "No records for the selected period" }));
      else out.appendChild(MGI.utils.el("p", { text: "Present " + inst.attendance.present + ", Absent " + inst.attendance.absent + ", Leave " + inst.attendance.leave + ", Percentage " + MGI.utils.pct(inst.attendance.percentage) }));
      out.appendChild(MGI.utils.el("h3", { text: "Tasks" }));
      out.appendChild(MGI.utils.el("p", { text: inst.tasks.total ? ("Completed " + inst.tasks.completed + ", Pending " + inst.tasks.pending + ", In Progress " + inst.tasks.inProgress + ", Overdue " + inst.tasks.overdue) : "No records for the selected period" }));
      out.appendChild(MGI.utils.el("h3", { text: "Activity points" }));
      out.appendChild(MGI.utils.el("p", { text: inst.activities.available ? ("Positive " + inst.activities.positive + ", Negative " + inst.activities.negative + ", Net " + inst.activities.net) : "No records for the selected period" }));
      out.appendChild(MGI.utils.el("h3", { text: "Overall student performance" }));
      var rank = MGI.analytics.ranking(MGI.state);
      out.appendChild(table(["Student", "Attendance", "Tasks", "Overdue", "Net", "Overall"], rank.map(function (m) {
        return [m.student.fullName, MGI.utils.pct(m.attendance.percentage), MGI.utils.pct(m.tasks.percentage), String(m.tasks.overdue), String(m.activities.net), m.overall];
      })));
      var charts = MGI.utils.el("div", { className: "grid grid-2" });
      charts.appendChild(MGI.charts.bars("Students per course", inst.courses.map(function (c) { return { label: c.course, value: c.count }; })));
      charts.appendChild(MGI.charts.donut("Task status", [
        { label: "Pending", value: inst.tasks.pending },
        { label: "In Progress", value: inst.tasks.inProgress },
        { label: "Completed", value: inst.tasks.completed }
      ]));
      out.appendChild(charts);
    },

    individual: function (out, studentId, from, to) {
      var student = MGI.state.students.find(function (s) { return s.id === studentId; });
      if (!student) {
        out.appendChild(MGI.utils.el("p", { text: "Select a student to generate an individual report." }));
        return;
      }
      var m = MGI.analytics.studentMetrics(MGI.state, student, from, to);
      out.appendChild(MGI.utils.el("h2", { text: "Individual Student Report" }));
      out.appendChild(MGI.utils.el("p", { text: student.fullName + " (" + student.studentCode + ")" }));
      out.appendChild(MGI.utils.el("p", { text: "Generated " + new Date().toLocaleString("en-GB") + ". Date range: " + rangeLabel(from, to) + ". Attendance by date, activities by date, tasks by due date." }));
      out.appendChild(MGI.utils.el("p", { text: student.course + " · " + student.batch + " · " + student.status + " · Joined " + MGI.utils.formatDate(student.joiningDate) }));
      out.appendChild(MGI.students.performanceCard(m));
      var att = MGI.state.attendance.filter(function (r) { return r.studentId === student.id && (!from || r.date >= from) && (!to || r.date <= to); });
      out.appendChild(MGI.utils.el("h3", { text: "Attendance" }));
      out.appendChild(table(["Date", "Status", "Remarks"], att.map(function (r) { return [r.date, r.status, r.remarks || ""]; })));
      var tasks = MGI.state.tasks.filter(function (r) { return r.studentId === student.id && (!from || r.dueDate >= from) && (!to || r.dueDate <= to); });
      out.appendChild(MGI.utils.el("h3", { text: "Tasks" }));
      out.appendChild(table(["Title", "Due", "Status"], tasks.map(function (r) { return [r.title, r.dueDate, r.status]; })));
      var acts = MGI.state.activities.filter(function (r) { return r.studentId === student.id && (!from || r.date >= from) && (!to || r.date <= to); });
      out.appendChild(MGI.utils.el("h3", { text: "Activities" }));
      out.appendChild(table(["Date", "Type", "Category", "Points", "Description"], acts.map(function (r) {
        return [r.date, r.type, r.category, MGI.utils.signedPoints(r.type, r.points), r.description];
      })));
      out.appendChild(MGI.charts.donut("Attendance split", [
        { label: "Present", value: m.attendance.present },
        { label: "Absent", value: m.attendance.absent },
        { label: "Leave", value: m.attendance.leave }
      ]));
    },

    exportCsv: function (kind) {
      var day = MGI.utils.today();
      if (kind === "students") {
        csv("students-" + day + ".csv", ["studentCode", "fullName", "phone", "email", "course", "batch", "status"], MGI.state.students.map(function (s) {
          return [s.studentCode, s.fullName, s.phone, s.email, s.course, s.batch, s.status];
        }));
      } else if (kind === "attendance") {
        csv("attendance-" + day + ".csv", ["studentId", "date", "status", "remarks"], MGI.state.attendance.map(function (r) {
          return [r.studentId, r.date, r.status, r.remarks || ""];
        }));
      } else if (kind === "tasks") {
        csv("tasks-" + day + ".csv", ["studentId", "title", "dueDate", "status"], MGI.state.tasks.map(function (r) {
          return [r.studentId, r.title, r.dueDate, r.status];
        }));
      } else {
        csv("activities-" + day + ".csv", ["studentId", "date", "type", "category", "points", "description"], MGI.state.activities.map(function (r) {
          return [r.studentId, r.date, r.type, r.category, r.points, r.description];
        }));
      }
    }
  };

  global.MGI = MGI;
})(window);
