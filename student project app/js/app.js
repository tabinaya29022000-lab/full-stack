(function (global) {
  var MGI = global.MGI || {};

  function setActiveNav(page) {
    document.querySelectorAll(".nav-link").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-page") === page);
      if (link.classList.contains("active")) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function renderDashboard() {
    var root = MGI.utils.byId("dashboard-root");
    MGI.utils.clear(root);
    var date = MGI.uiState.dashDate || MGI.utils.today();
    var inst = MGI.analytics.institute(MGI.state);
    var today = MGI.analytics.todayAttendance(MGI.state, date);
    var controls = MGI.utils.el("div", { className: "filters card" });
    var dateField = MGI.utils.el("div", { className: "field" });
    dateField.appendChild(MGI.utils.el("label", { for: "dash-date", text: "Attendance summary date" }));
    var dateInput = MGI.utils.el("input", { id: "dash-date", type: "date", value: date, max: MGI.utils.today() });
    dateInput.addEventListener("change", function () {
      MGI.uiState.dashDate = dateInput.value;
      MGI.storage.saveUi(MGI.uiState);
      renderDashboard();
    });
    dateField.appendChild(dateInput);
    controls.appendChild(dateField);
    root.appendChild(controls);

    if (!MGI.state.students.length) {
      root.appendChild(MGI.ui.empty("No students yet. Add a student or load sample data to populate the dashboard. All metrics show 0 or N/A.", [
        { label: "Add Student", onClick: function () { MGI.app.navigate("students"); MGI.students.openForm(null); } },
        { label: "Load Sample Data", className: "btn secondary", onClick: function () { MGI.app.loadSample(); } }
      ]));
    }

    var cards = MGI.utils.el("div", { className: "grid grid-4" });
    cards.appendChild(MGI.ui.metric("Total students", inst.totalStudents, "All statuses"));
    cards.appendChild(MGI.ui.metric("Active students", inst.activeStudents, "Status Active"));
    cards.appendChild(MGI.ui.metric("Attendance %", MGI.utils.pct(inst.attendance.percentage), "Pooled institute total"));
    cards.appendChild(MGI.ui.metric("Task completion", MGI.utils.pct(inst.tasks.percentage)));
    root.appendChild(cards);

    var att = MGI.utils.el("div", { className: "grid grid-4" });
    att.appendChild(MGI.ui.metric("Present (" + date + ")", today.present));
    att.appendChild(MGI.ui.metric("Absent", today.absent));
    att.appendChild(MGI.ui.metric("Leave", today.leave));
    att.appendChild(MGI.ui.metric("Not marked", today.notMarked, "Active students with no record"));
    root.appendChild(att);

    var rest = MGI.utils.el("div", { className: "grid grid-3" });
    rest.appendChild(MGI.ui.metric("Pending tasks", inst.tasks.pending));
    rest.appendChild(MGI.ui.metric("In progress", inst.tasks.inProgress));
    rest.appendChild(MGI.ui.metric("Completed tasks", inst.tasks.completed));
    rest.appendChild(MGI.ui.metric("Overdue tasks", inst.tasks.overdue, "Pending or in progress and due before today"));
    rest.appendChild(MGI.ui.metric("Positive points", inst.activities.positive));
    rest.appendChild(MGI.ui.metric("Negative points", inst.activities.negative));
    rest.appendChild(MGI.ui.metric("Net points", String(inst.activities.net)));
    root.appendChild(rest);

    var courseCard = MGI.utils.el("section", { className: "card" });
    courseCard.appendChild(MGI.utils.el("h3", { text: "Students per course" }));
    inst.courses.forEach(function (c) {
      courseCard.appendChild(MGI.utils.el("p", { text: c.course + ": " + c.count }));
    });
    root.appendChild(courseCard);
    root.appendChild(MGI.charts.progress("Overall task completion", inst.tasks.percentage));

    var charts = MGI.utils.el("div", { className: "grid grid-3" });
    charts.appendChild(MGI.charts.bars("Course distribution", inst.courses.map(function (c) {
      return { label: c.course, value: c.count };
    })));
    charts.appendChild(MGI.charts.donut("Today's attendance split", [
      { label: "Present", value: today.present },
      { label: "Absent", value: today.absent },
      { label: "Leave", value: today.leave },
      { label: "Not marked", value: today.notMarked }
    ]));
    charts.appendChild(MGI.charts.donut("Task status distribution", [
      { label: "Pending", value: inst.tasks.pending },
      { label: "In Progress", value: inst.tasks.inProgress },
      { label: "Completed", value: inst.tasks.completed }
    ]));
    root.appendChild(charts);

    var rank = MGI.analytics.ranking(MGI.state).slice().sort(function (a, b) {
      return (b.activities.net || 0) - (a.activities.net || 0);
    });
    var top = rank.slice(0, 5);
    var bottom = rank.slice().reverse().slice(0, 5);
    var cmp = MGI.utils.el("section", { className: "card" });
    cmp.appendChild(MGI.utils.el("h3", { text: "Performance comparison by net points" }));
    cmp.appendChild(MGI.charts.bars("Top five (net points)", top.map(function (m) {
      return { label: m.student.fullName, value: m.activities.net, tone: "success" };
    })));
    cmp.appendChild(MGI.charts.bars("Bottom five (net points)", bottom.map(function (m) {
      return { label: m.student.fullName, value: m.activities.net, tone: "warning" };
    })));
    root.appendChild(cmp);
  }

  function renderAnalysis() {
    var root = MGI.utils.byId("analysis-root");
    MGI.utils.clear(root);
    var search = MGI.utils.el("input", { id: "anl-search", type: "search", value: MGI.uiState.analysisSearch || "", placeholder: "Search by name or Student ID" });
    var box = MGI.utils.el("div", { className: "card" });
    box.appendChild(MGI.utils.el("label", { for: "anl-search", text: "Student search" }));
    box.appendChild(search);
    var results = MGI.utils.el("div", { id: "anl-results" });
    box.appendChild(results);
    root.appendChild(box);
    var detail = MGI.utils.el("div", { id: "anl-detail" });
    root.appendChild(detail);
    var compareHost = MGI.utils.el("section", { className: "card" });
    compareHost.appendChild(MGI.utils.el("h3", { text: "Compare 2–4 students" }));
    var compareOut = MGI.utils.el("div");
    compareHost.appendChild(compareOut);
    root.appendChild(compareHost);
    var selected = {};

    var rules = MGI.utils.el("section", { className: "card" });
    rules.appendChild(MGI.utils.el("h3", { text: "Rating rules used by this application" }));
    var t = MGI.config.thresholds;
    [
      "Attendance % — Green: " + t.attendance.green + "% or more; Amber: " + t.attendance.amberMin.toFixed(1) + "% to " + (t.attendance.green - 0.1).toFixed(1) + "%; Red: below " + t.attendance.amberMin + "%; N/A when no attendance records.",
      "Task completion % — Green: " + t.taskCompletion.green + "% or more; Amber: " + t.taskCompletion.amberMin.toFixed(1) + "% to " + (t.taskCompletion.green - 0.1).toFixed(1) + "%; Red: below " + t.taskCompletion.amberMin + "%; N/A when no tasks.",
      "Overdue tasks — Green: 0; Amber: 1 to " + t.overdue.amberMax + "; Red: 3 or more; N/A when no tasks.",
      "Net activity points — Green: +" + t.netPoints.green + " or more; Amber: 0 to +" + (t.netPoints.green - 1) + "; Red: below 0; N/A when no activity records.",
      "Overall status (first match): Not Rated if fewer than two indicators are available; At Risk if any available indicator is Red; Excellent if every available indicator is Green; Good if none is Red and at least one is Green; Needs Improvement if all available indicators are Amber."
    ].forEach(function (line) {
      rules.appendChild(MGI.utils.el("p", { text: line }));
    });
    root.appendChild(rules);

    function drawCompare() {
      MGI.utils.clear(compareOut);
      var ids = Object.keys(selected).filter(function (id) { return selected[id]; });
      if (ids.length < 2) {
        compareOut.appendChild(MGI.utils.el("p", { className: "muted", text: "Select two to four students from the search results." }));
        return;
      }
      if (ids.length > 4) {
        compareOut.appendChild(MGI.utils.el("p", { className: "field-error", text: "Select at most four students." }));
        return;
      }
      var metrics = ids.map(function (id) {
        return MGI.analytics.studentMetrics(MGI.state, MGI.state.students.find(function (s) { return s.id === id; }));
      });
      var grid = MGI.utils.el("div", { className: "compare-grid" });
      metrics.forEach(function (m) {
        var col = MGI.utils.el("article", { className: "card" });
        col.appendChild(MGI.ui.avatar(m.student));
        col.appendChild(MGI.utils.el("h4", { text: m.student.fullName }));
        col.appendChild(MGI.utils.el("p", { text: m.student.studentCode }));
        col.appendChild(MGI.utils.el("p", { text: "Attendance " + MGI.utils.pct(m.attendance.percentage) + " (" + m.attendance.present + "/" + m.attendance.total + ")" }));
        col.appendChild(MGI.utils.el("p", { text: "Tasks " + MGI.utils.pct(m.tasks.percentage) + " · Overdue " + m.tasks.overdue }));
        col.appendChild(MGI.utils.el("p", { text: "Points + " + m.activities.positive + " / − " + m.activities.negative + " · Net " + m.activities.net }));
        col.appendChild(MGI.ui.statusPill(m.overall));
        grid.appendChild(col);
      });
      compareOut.appendChild(grid);
    }

    function showStudent(id) {
      var student = MGI.state.students.find(function (s) { return s.id === id; });
      MGI.utils.clear(detail);
      if (!student) return;
      var m = MGI.analytics.studentMetrics(MGI.state, student);
      var card = MGI.utils.el("section", { className: "card" });
      card.appendChild(MGI.utils.el("h3", { text: "Analytics: " + student.fullName }));
      card.appendChild(MGI.utils.el("p", { text: "Present " + m.attendance.present + ", Absent " + m.attendance.absent + ", Leave " + m.attendance.leave + ", Attendance " + MGI.utils.pct(m.attendance.percentage) }));
      card.appendChild(MGI.utils.el("p", { text: "Tasks total " + m.tasks.total + ", completed " + m.tasks.completed + ", in progress " + m.tasks.inProgress + ", pending " + m.tasks.pending + ", overdue " + m.tasks.overdue + ", completion " + MGI.utils.pct(m.tasks.percentage) }));
      card.appendChild(MGI.utils.el("p", { text: "Positive " + m.activities.positive + ", Negative " + m.activities.negative + ", Net " + m.activities.net }));
      card.appendChild(MGI.students.performanceCard(m));
      var open = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Open full profile" });
      open.addEventListener("click", function () { MGI.app.navigate("profile", { id: student.id }); });
      card.appendChild(open);
      detail.appendChild(card);
    }

    function drawResults() {
      var q = MGI.utils.trim(search.value).toLowerCase();
      MGI.uiState.analysisSearch = search.value;
      MGI.storage.saveUi(MGI.uiState);
      var list = MGI.state.students.filter(function (s) {
        if (!q) return true;
        return s.fullName.toLowerCase().indexOf(q) !== -1 || s.studentCode.toLowerCase().indexOf(q) !== -1;
      });
      MGI.utils.clear(results);
      if (!list.length) {
        results.appendChild(MGI.ui.empty("No students match your search", [{ label: "Clear filters", className: "btn ghost", onClick: function () { search.value = ""; drawResults(); } }]));
        return;
      }
      list.forEach(function (s) {
        var m = MGI.analytics.studentMetrics(MGI.state, s);
        var row = MGI.utils.el("div", { className: "sheet-row" });
        var who = MGI.utils.el("button", { type: "button", className: "btn ghost" });
        who.appendChild(MGI.ui.avatar(s));
        who.appendChild(document.createTextNode(" " + s.fullName + " (" + s.studentCode + ") · " + s.course + " · " + s.batch + " · " + s.status));
        who.addEventListener("click", function () { showStudent(s.id); });
        row.appendChild(who);
        row.appendChild(MGI.utils.el("p", { text: "Attendance " + MGI.utils.pct(m.attendance.percentage) + " · Tasks " + MGI.utils.pct(m.tasks.percentage) + " · Net " + m.activities.net }));
        var cbLab = MGI.utils.el("label");
        var cb = MGI.utils.el("input", { type: "checkbox" });
        cb.checked = !!selected[s.id];
        cb.addEventListener("change", function () {
          selected[s.id] = cb.checked;
          drawCompare();
        });
        cbLab.appendChild(cb);
        cbLab.appendChild(document.createTextNode(" Compare"));
        row.appendChild(cbLab);
        results.appendChild(row);
      });
      var rankCard = MGI.utils.el("div", { className: "table-wrap" });
      var table = MGI.utils.el("table");
      var thead = document.createElement("thead");
      var hr = document.createElement("tr");
      ["Name", "Attendance", "Tasks", "Overdue", "Net", "Overall"].forEach(function (h) {
        var th = document.createElement("th");
        th.scope = "col";
        var btn = MGI.utils.el("button", { type: "button", className: "sort", text: h });
        th.appendChild(btn);
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tb = document.createElement("tbody");
      MGI.analytics.ranking(MGI.state).forEach(function (m) {
        var tr = document.createElement("tr");
        [m.student.fullName, MGI.utils.pct(m.attendance.percentage), MGI.utils.pct(m.tasks.percentage), String(m.tasks.overdue), String(m.activities.net), m.overall].forEach(function (c) {
          var td = document.createElement("td");
          td.textContent = c;
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      rankCard.appendChild(table);
      results.appendChild(rankCard);
    }
    search.addEventListener("input", drawResults);
    drawResults();
  }

  function renderData() {
    var root = MGI.utils.byId("data-root");
    MGI.utils.clear(root);
    var notice = MGI.utils.el("section", { className: "notice card" });
    notice.appendChild(MGI.utils.el("h3", { text: "Local Storage limitations" }));
    notice.appendChild(MGI.utils.el("p", { text: "This application stores records in the browser’s Local Storage. Data is specific to one browser on one device, does not synchronise to the cloud, does not provide secure multi-user access or authentication, may be cleared by the user or by browser settings, and is not suitable for confidential real student data." }));
    root.appendChild(notice);
    var usage = MGI.storage.estimateUsage();
    root.appendChild(MGI.ui.metric("Estimated storage used", (usage.bytes / 1024).toFixed(1) + " KB of about 5 MB"));
    var actions = MGI.utils.el("div", { className: "card inline-actions" });
    var load = MGI.utils.el("button", { type: "button", className: "btn", text: "Load Sample Data" });
    load.addEventListener("click", function () { MGI.app.loadSample(); });
    var clear = MGI.utils.el("button", { type: "button", className: "btn danger", text: "Clear All Data" });
    clear.addEventListener("click", function () { MGI.app.clearAll(); });
    var backup = MGI.utils.el("button", { type: "button", className: "btn secondary", text: "Export backup JSON" });
    backup.addEventListener("click", function () {
      MGI.utils.download("mgi-sms-backup-" + MGI.utils.today() + ".json", JSON.stringify(MGI.storage.exportBackup(), null, 2), "application/json");
    });
    var restore = MGI.utils.el("input", { type: "file", accept: "application/json,.json", id: "restore-file" });
    restore.addEventListener("change", function () {
      var file = restore.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var err = MGI.storage.validateBackup(data);
          if (err) throw new Error(err);
          MGI.ui.confirm({
            title: "Restore backup?",
            body: "This will replace current data with " + (data.students || []).length + " students, " + (data.attendance || []).length + " attendance, " + (data.tasks || []).length + " tasks and " + (data.activities || []).length + " activities.",
            okText: "Replace data"
          }).then(function (ok) {
            if (!ok) return;
            var next = {
              students: data.students || [],
              attendance: data.attendance || [],
              tasks: data.tasks || [],
              activities: data.activities || [],
              meta: data.meta || { schemaVersion: data.schemaVersion }
            };
            var result = MGI.storage.commit(function (state) {
              state.students = next.students;
              state.attendance = next.attendance;
              state.tasks = next.tasks;
              state.activities = next.activities;
              state.meta = next.meta;
            });
            if (!result.ok) MGI.ui.toast(result.message, "error", true);
            else { MGI.ui.toast("Backup restored.", "success"); MGI.app.refresh(); }
          });
        } catch (e) {
          MGI.ui.toast("Invalid backup file. Existing data was not changed. " + e.message, "error", true);
        }
      };
      reader.readAsText(file);
    });
    actions.appendChild(load);
    actions.appendChild(clear);
    actions.appendChild(backup);
    actions.appendChild(MGI.utils.el("label", { for: "restore-file", text: "Restore backup" }));
    actions.appendChild(restore);
    root.appendChild(actions);
    root.appendChild(MGI.utils.el("p", { className: "muted", text: "About: Student Management & Performance Analytics System · Project code MGI-FE-PROJ-01 · HTML5, CSS3 and Vanilla JavaScript." }));
  }

  function renderPage() {
    var page = MGI.uiState.page || "dashboard";
    document.querySelectorAll(".page").forEach(function (el) {
      el.classList.toggle("active", el.id === "page-" + page);
    });
    setActiveNav(page);
    MGI.utils.byId("page-title").textContent = {
      dashboard: "Dashboard",
      students: "Students",
      profile: "Student profile",
      attendance: "Attendance",
      tasks: "Tasks",
      activities: "Activities",
      analysis: "Search and analysis",
      reports: "Reports",
      data: "Data and About"
    }[page] || "Dashboard";
    if (page === "dashboard") renderDashboard();
    if (page === "students") MGI.students.renderList();
    if (page === "profile") MGI.students.renderProfile(MGI.uiState.params && MGI.uiState.params.id);
    if (page === "attendance") MGI.attendance.render();
    if (page === "tasks") MGI.tasks.render();
    if (page === "activities") MGI.activities.render();
    if (page === "analysis") renderAnalysis();
    if (page === "reports") MGI.reports.render();
    if (page === "data") renderData();
  }

  MGI.app = {
    navigate: function (page, params) {
      MGI.uiState.page = page;
      MGI.uiState.params = params || {};
      MGI.storage.saveUi(MGI.uiState);
      document.getElementById("sidebar").classList.remove("open");
      renderPage();
      MGI.utils.byId("main").focus();
    },
    refresh: function () {
      renderPage();
    },
    loadSample: function () {
      var proceed = function () {
        var sample = MGI.sample.build();
        var result = MGI.storage.commit(function (state) {
          state.students = sample.students;
          state.attendance = sample.attendance;
          state.tasks = sample.tasks;
          state.activities = sample.activities;
          state.meta = sample.meta;
        });
        if (!result.ok) MGI.ui.toast(result.message, "error", true);
        else {
          MGI.ui.toast("Sample data loaded.", "success");
          MGI.app.refresh();
        }
      };
      if (MGI.state.students.length || MGI.state.attendance.length || MGI.state.tasks.length || MGI.state.activities.length) {
        MGI.ui.confirm({
          title: "Replace existing data?",
          body: "Load Sample Data will replace the records currently stored in this browser. Export a backup first if you need to keep them.",
          okText: "Load sample data"
        }).then(function (ok) { if (ok) proceed(); });
      } else proceed();
    },
    clearAll: function () {
      MGI.ui.confirm({
        title: "Clear all data?",
        body: "This permanently removes every student, attendance, task and activity record stored in this browser. This cannot be undone.",
        okText: "Clear all data"
      }).then(function (ok) {
        if (!ok) return;
        try {
          MGI.storage.clearAll();
          MGI.ui.toast("All data cleared.", "success");
          MGI.app.refresh();
        } catch (e) {
          MGI.ui.toast("Could not clear storage.", "error", true);
        }
      });
    },
    init: function () {
      var loaded = MGI.storage.load();
      MGI.state = loaded.state;
      MGI.uiState = Object.assign({ page: "dashboard", params: {}, studentSort: "fullName", studentDir: "asc", studentPage: 1 }, MGI.storage.loadUi());
      loaded.warnings.forEach(function (w) { MGI.ui.toast(w, "warning", true); });
      if (loaded.needsRecovery) {
        MGI.ui.toast("Some stored JSON could not be read. You can start with empty data or load sample data from Data and About. The original text was kept under a backup key.", "warning", true);
      }
      document.querySelectorAll(".nav-link").forEach(function (link) {
        link.addEventListener("click", function () {
          MGI.app.navigate(link.getAttribute("data-page"));
        });
      });
      MGI.utils.byId("menu-toggle").addEventListener("click", function () {
        document.getElementById("sidebar").classList.toggle("open");
      });
      MGI.utils.byId("theme-toggle").addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
      });
      MGI.utils.byId("add-student-btn").addEventListener("click", function () {
        MGI.app.navigate("students");
        MGI.students.openForm(null);
      });
      MGI.utils.byId("student-form").addEventListener("submit", function (e) {
        e.preventDefault();
        MGI.students.submitForm();
      });
      MGI.utils.byId("student-cancel").addEventListener("click", function () {
        MGI.ui.closeDialog("student-dialog");
      });
      MGI.utils.byId("save-without-photo").addEventListener("click", function () {
        MGI.students.saveWithoutPhoto();
      });
      MGI.utils.byId("stu-photo").addEventListener("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        MGI.students.processImage(file).then(function (dataUrl) {
          MGI.utils.byId("stu-photo-error").textContent = "";
          MGI.students.setPendingPhoto(dataUrl);
        }).catch(function (err) {
          MGI.utils.byId("stu-photo-error").textContent = err.message;
          e.target.value = "";
        });
      });
      MGI.utils.byId("remove-photo").addEventListener("click", function () {
        MGI.utils.byId("stu-photo").value = "";
        MGI.utils.byId("stu-photo-error").textContent = "";
        MGI.students.setPendingPhoto(null);
      });
      var drop = MGI.utils.byId("photo-drop");
      drop.addEventListener("dragover", function (e) { e.preventDefault(); });
      drop.addEventListener("drop", function (e) {
        e.preventDefault();
        var file = e.dataTransfer.files[0];
        if (file) {
          MGI.students.processImage(file).then(function (dataUrl) {
            MGI.utils.byId("stu-photo-error").textContent = "";
            MGI.students.setPendingPhoto(dataUrl);
          }).catch(function (err) {
            MGI.utils.byId("stu-photo-error").textContent = err.message;
          });
        }
      });
      global.addEventListener("storage", function () {
        var loaded2 = MGI.storage.load();
        MGI.state = loaded2.state;
        MGI.app.refresh();
      });
      renderPage();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    MGI.app.init();
  });

  global.MGI = MGI;
})(window);
