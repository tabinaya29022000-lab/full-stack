(function (global) {
  var MGI = global.MGI || {};

  function validate(data) {
    var errors = {};
    var desc = MGI.utils.trim(data.description);
    if (!data.studentId) errors.studentId = "Select a student.";
    if (!data.date || !MGI.utils.isValidDate(data.date)) errors.date = "Enter a valid date.";
    else if (data.date > MGI.utils.today()) errors.date = "Activity date cannot be in the future.";
    if (MGI.config.activityTypes.indexOf(data.type) === -1) errors.type = "Select Positive or Negative.";
    var cats = MGI.config.activityCategories[data.type] || [];
    if (!data.category || cats.indexOf(data.category) === -1) errors.category = "Select a category for the chosen type.";
    if (!desc || desc.length < 5 || desc.length > 300) errors.description = "Description must be 5–300 characters.";
    var points = Number(data.points);
    if (data.points === "" || Number.isNaN(points) || points < 1 || points > 100 || points % 1 !== 0) {
      errors.points = "Points must be a whole number from 1 to 100.";
    }
    return errors;
  }

  MGI.activities = {
    save: function (data, id) {
      var errors = validate(data);
      if (Object.keys(errors).length) return { ok: false, errors: errors };
      var now = MGI.utils.nowIso();
      return MGI.storage.commit(function (state) {
        if (id) {
          var rec = state.activities.find(function (a) { return a.id === id; });
          rec.studentId = data.studentId;
          rec.date = data.date;
          rec.type = data.type;
          rec.category = data.category;
          rec.description = MGI.utils.trim(data.description);
          rec.points = Number(data.points);
          rec.updatedAt = now;
        } else {
          state.activities.push({
            id: MGI.utils.uuid(),
            studentId: data.studentId,
            date: data.date,
            type: data.type,
            category: data.category,
            description: MGI.utils.trim(data.description),
            points: Number(data.points),
            createdAt: now,
            updatedAt: now
          });
        }
      });
    },

    render: function () {
      var root = MGI.utils.byId("activities-root");
      MGI.utils.clear(root);
      if (!MGI.state.students.length) {
        root.appendChild(MGI.ui.empty("No students are registered. Add a student before recording activities.", [
          { label: "Add Student", onClick: function () { MGI.app.navigate("students"); } }
        ]));
        return;
      }
      var inst = MGI.analytics.activitySummary(MGI.state.activities);
      var metrics = MGI.utils.el("div", { className: "grid grid-3" });
      metrics.appendChild(MGI.ui.metric("Positive points", inst.positive));
      metrics.appendChild(MGI.ui.metric("Negative points", inst.negative, "Shown as a positive magnitude"));
      metrics.appendChild(MGI.ui.metric("Net points", (inst.net > 0 ? "+" : "") + inst.net));
      root.appendChild(metrics);

      var form = MGI.utils.el("form", { className: "card" });
      form.appendChild(MGI.utils.el("h3", { text: "Record activity" }));
      var studentSel = MGI.utils.el("select", { id: "act-student" });
      MGI.ui.fillSelect(studentSel, MGI.ui.studentOptions(false), (MGI.uiState.params && MGI.uiState.params.studentId) || "");
      var date = MGI.utils.el("input", { id: "act-date", type: "date", value: MGI.utils.today(), max: MGI.utils.today() });
      var type = MGI.utils.el("select", { id: "act-type" });
      MGI.ui.fillSelect(type, MGI.config.activityTypes.map(function (t) { return { value: t, label: t }; }), "Positive");
      var category = MGI.utils.el("select", { id: "act-category" });
      var desc = MGI.utils.el("textarea", { id: "act-desc" });
      var points = MGI.utils.el("input", { id: "act-points", type: "number", min: "1", max: "100", step: "1" });
      function fillCats() {
        MGI.ui.fillSelect(category, MGI.config.activityCategories[type.value].map(function (c) { return { value: c, label: c }; }));
      }
      fillCats();
      type.addEventListener("change", fillCats);
      var fields = MGI.utils.el("div", { className: "filters" });
      [["Student (required)", studentSel, "act-student"], ["Date (required)", date, "act-date"], ["Type (required)", type, "act-type"], ["Category (required)", category, "act-category"], ["Points (required)", points, "act-points"]].forEach(function (row) {
        var f = MGI.utils.el("div", { className: "field" });
        f.appendChild(MGI.utils.el("label", { for: row[2], text: row[0] }));
        f.appendChild(row[1]);
        f.appendChild(MGI.utils.el("p", { className: "field-error", id: row[2] + "-error" }));
        fields.appendChild(f);
      });
      form.appendChild(fields);
      var df = MGI.utils.el("div", { className: "field" });
      df.appendChild(MGI.utils.el("label", { for: "act-desc", text: "Description (required, 5–300 characters)" }));
      df.appendChild(desc);
      df.appendChild(MGI.utils.el("p", { className: "field-error", id: "act-desc-error" }));
      form.appendChild(df);
      form.appendChild(MGI.utils.el("button", { type: "submit", className: "btn", text: "Save activity" }));
      var editingId = null;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = { studentId: studentSel.value, date: date.value, type: type.value, category: category.value, description: desc.value, points: points.value };
        var result = MGI.activities.save(data, editingId);
        if (!result.ok && result.errors) {
          var map = { studentId: "act-student", date: "act-date", type: "act-type", category: "act-category", description: "act-desc", points: "act-points" };
          var first = null;
          Object.keys(map).forEach(function (k) {
            var input = MGI.utils.byId(map[k]);
            MGI.ui.setFieldError(input, result.errors[k] || "");
            if (result.errors[k] && !first) first = input;
          });
          if (first) first.focus();
          return;
        }
        if (!result.ok) { MGI.ui.toast(result.message, "error", true); return; }
        editingId = null;
        MGI.ui.toast("Activity saved.", "success");
        MGI.app.refresh();
      });
      root.appendChild(form);

      var hist = MGI.utils.el("section", { className: "card" });
      hist.appendChild(MGI.utils.el("h3", { text: "Activity history" }));
      var fStudent = MGI.utils.el("select");
      MGI.ui.fillSelect(fStudent, MGI.ui.studentOptions(true), "");
      var fType = MGI.utils.el("select");
      MGI.ui.fillSelect(fType, [{ value: "", label: "All types" }, { value: "Positive", label: "Positive" }, { value: "Negative", label: "Negative" }]);
      var fCat = MGI.utils.el("select");
      var allCats = MGI.config.activityCategories.Positive.concat(MGI.config.activityCategories.Negative);
      MGI.ui.fillSelect(fCat, [{ value: "", label: "All categories" }].concat(allCats.map(function (c) { return { value: c, label: c }; })));
      var from = MGI.utils.el("input", { type: "date" });
      var to = MGI.utils.el("input", { type: "date" });
      var filters = MGI.utils.el("div", { className: "filters" });
      [["Student", fStudent], ["Type", fType], ["Category", fCat], ["From", from], ["To", to]].forEach(function (row) {
        var f = MGI.utils.el("div", { className: "field" });
        f.appendChild(MGI.utils.el("label", { text: row[0] }));
        f.appendChild(row[1]);
        filters.appendChild(f);
      });
      hist.appendChild(filters);
      var host = MGI.utils.el("div");
      hist.appendChild(host);
      root.appendChild(hist);

      function draw() {
        var rows = MGI.state.activities.filter(function (a) {
          if (fStudent.value && a.studentId !== fStudent.value) return false;
          if (fType.value && a.type !== fType.value) return false;
          if (fCat.value && a.category !== fCat.value) return false;
          if (from.value && a.date < from.value) return false;
          if (to.value && a.date > to.value) return false;
          return true;
        }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt); });
        MGI.utils.clear(host);
        if (!rows.length) {
          host.appendChild(MGI.utils.el("p", { className: "muted", text: "No activities match the current filters." }));
          return;
        }
        var table = MGI.utils.el("table");
        var thead = document.createElement("thead");
        var hr = document.createElement("tr");
        ["Date", "Student", "Type", "Category", "Points", "Description", "Actions"].forEach(function (h) {
          var th = document.createElement("th");
          th.scope = "col";
          th.textContent = h;
          hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        var tb = document.createElement("tbody");
        rows.forEach(function (a) {
          var student = MGI.state.students.find(function (s) { return s.id === a.studentId; });
          var tr = document.createElement("tr");
          [MGI.utils.formatDate(a.date), student ? student.fullName : "Unknown", a.type, a.category, MGI.utils.signedPoints(a.type, a.points), a.description].forEach(function (c) {
            var td = document.createElement("td");
            td.textContent = c;
            tr.appendChild(td);
          });
          var act = document.createElement("td");
          var edit = MGI.utils.el("button", { type: "button", className: "btn ghost", text: "Edit" });
          edit.addEventListener("click", function () {
            editingId = a.id;
            studentSel.value = a.studentId;
            date.value = a.date;
            type.value = a.type;
            fillCats();
            category.value = a.category;
            desc.value = a.description;
            points.value = a.points;
            points.focus();
          });
          var del = MGI.utils.el("button", { type: "button", className: "btn danger", text: "Delete" });
          del.addEventListener("click", function () {
            MGI.ui.confirm({ title: "Delete activity?", body: "Delete this activity record? Totals will be recalculated. This cannot be undone.", okText: "Delete" }).then(function (ok) {
              if (!ok) return;
              var result = MGI.storage.commit(function (state) {
                state.activities = state.activities.filter(function (x) { return x.id !== a.id; });
              });
              if (result.ok) { MGI.ui.toast("Activity deleted.", "success"); MGI.app.refresh(); }
              else MGI.ui.toast(result.message, "error", true);
            });
          });
          act.appendChild(edit);
          act.appendChild(del);
          tr.appendChild(act);
          tb.appendChild(tr);
        });
        table.appendChild(tb);
        var wrap = MGI.utils.el("div", { className: "table-wrap" });
        wrap.appendChild(table);
        host.appendChild(wrap);
      }
      [fStudent, fType, fCat, from, to].forEach(function (el) { el.addEventListener("change", draw); });
      draw();
    }
  };

  global.MGI = MGI;
})(window);
