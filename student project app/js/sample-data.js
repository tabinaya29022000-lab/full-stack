(function (global) {
  var MGI = global.MGI || {};

  function stamp(id, extra) {
    var now = "2026-10-01T09:00:00.000Z";
    extra.id = id;
    extra.createdAt = extra.createdAt || now;
    extra.updatedAt = extra.updatedAt || now;
    extra.photo = extra.photo || null;
    extra.email = extra.email || "";
    extra.address = extra.address || "";
    extra.courseProgress = extra.courseProgress == null ? 40 : extra.courseProgress;
    return extra;
  }

  function makePhoto(initials, color) {
    var canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, 64, 70);
    return canvas.toDataURL("image/jpeg", 0.7);
  }

  function att(id, studentId, date, status) {
    return {
      id: id,
      studentId: studentId,
      date: date,
      status: status,
      remarks: "",
      createdAt: date + "T09:00:00.000Z",
      updatedAt: date + "T09:00:00.000Z"
    };
  }

  function patternDays(start, count, pattern) {
    var dates = [];
    var i;
    for (i = 0; i < count; i += 1) dates.push(MGI.utils.addDays(start, i));
    return dates.map(function (d, idx) {
      return { date: d, status: pattern[idx % pattern.length] };
    });
  }

  MGI.sample = {
    build: function () {
      var today = MGI.utils.today();
      var start = MGI.utils.addDays(today, -13);
      var ids = {
        priya: "11111111-1111-4111-8111-111111111111",
        arjun: "22222222-2222-4222-8222-222222222222",
        sneha: "33333333-3333-4333-8333-333333333333",
        rohan: "44444444-4444-4444-8444-444444444444",
        ananya: "55555555-5555-4555-8555-555555555555",
        vikram: "66666666-6666-4666-8666-666666666666",
        meera: "77777777-7777-4777-8777-777777777777",
        kabir: "88888888-8888-4888-8888-888888888888",
        diya: "99999999-9999-4999-8999-999999999999",
        farhan: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      };
      var students = [
        stamp(ids.priya, { studentCode: "MGI-2026-001", fullName: "Priya Sharma", phone: "9876543210", email: "priya@example.com", course: "Web Development", batch: "2026-A", joiningDate: "2026-06-15", status: "Active", courseProgress: 72, photo: makePhoto("PS", "#0f6e7a") }),
        stamp(ids.arjun, { studentCode: "MGI-2026-002", fullName: "Arjun Mehta", phone: "9876543211", course: "Web Development", batch: "2026-A", joiningDate: "2026-06-16", status: "Active", courseProgress: 88, photo: makePhoto("AM", "#1b7a4e") }),
        stamp(ids.sneha, { studentCode: "MGI-2026-003", fullName: "Sneha Patel", phone: "9876543212", course: "Data Analytics", batch: "2026-A", joiningDate: "2026-06-18", status: "Active", courseProgress: 55, photo: null }),
        stamp(ids.rohan, { studentCode: "MGI-2026-004", fullName: "Rohan Iyer", phone: "9876543213", course: "Data Analytics", batch: "2026-B", joiningDate: "2026-07-01", status: "Active", courseProgress: 48, photo: makePhoto("RI", "#b86e00") }),
        stamp(ids.ananya, { studentCode: "MGI-2026-005", fullName: "Ananya Reddy", phone: "9876543214", course: "UI/UX Design", batch: "2026-A", joiningDate: "2026-07-04", status: "Active", courseProgress: 30, photo: null }),
        stamp(ids.vikram, { studentCode: "MGI-2026-006", fullName: "Vikram Singh", phone: "9876543215", course: "Digital Marketing", batch: "2026-B", joiningDate: "2026-07-10", status: "Active", courseProgress: 62, photo: makePhoto("VS", "#155a9c") }),
        stamp(ids.meera, { studentCode: "MGI-2026-007", fullName: "Meera Nair", phone: "9876543216", course: "Web Development", batch: "2026-B", joiningDate: "2026-05-02", status: "Inactive", courseProgress: 20, photo: null }),
        stamp(ids.kabir, { studentCode: "MGI-2026-008", fullName: "Kabir Khan", phone: "9876543217", course: "Digital Marketing", batch: "2026-A", joiningDate: "2026-01-10", status: "Completed", courseProgress: 100, photo: makePhoto("KK", "#466175") }),
        stamp(ids.diya, { studentCode: "MGI-2026-009", fullName: "Diya Joshi", phone: "9876543218", course: "UI/UX Design", batch: "2026-B", joiningDate: "2026-08-01", status: "Active", courseProgress: 44, photo: null }),
        stamp(ids.farhan, { studentCode: "MGI-2026-010", fullName: "Farhan Ali", phone: "9876543219", email: "farhan@example.com", course: "Data Analytics", batch: "2026-A", joiningDate: "2026-06-20", status: "Active", courseProgress: 91, photo: makePhoto("FA", "#0a545d") })
      ];

      var attendance = [];
      var n = 1;
      function addDaysFor(studentId, items) {
        items.forEach(function (item) {
          attendance.push(att("att-" + n, studentId, item.date, item.status));
          n += 1;
        });
      }
      var priya = [];
      var i;
      for (i = 0; i < 18; i += 1) priya.push({ date: MGI.utils.addDays(today, -23 + i), status: "Present" });
      priya.push({ date: MGI.utils.addDays(today, -5), status: "Absent" });
      priya.push({ date: MGI.utils.addDays(today, -4), status: "Absent" });
      priya.push({ date: MGI.utils.addDays(today, -3), status: "Leave" });
      priya.push({ date: MGI.utils.addDays(today, -2), status: "Leave" });
      priya.push({ date: MGI.utils.addDays(today, -1), status: "Leave" });
      priya.push({ date: today, status: "Leave" });
      addDaysFor(ids.priya, priya);

      addDaysFor(ids.arjun, patternDays(start, 14, ["Present", "Present", "Present", "Present", "Present", "Present", "Present"]));
      var sneha = [];
      for (i = 0; i < 18; i += 1) sneha.push({ date: MGI.utils.addDays(today, -24 + i), status: "Present" });
      for (i = 0; i < 7; i += 1) sneha.push({ date: MGI.utils.addDays(today, -6 + i), status: "Absent" });
      addDaysFor(ids.sneha, sneha);
      addDaysFor(ids.rohan, patternDays(start, 14, ["Present", "Absent", "Present", "Leave"]));
      addDaysFor(ids.ananya, patternDays(start, 14, ["Present", "Present", "Present", "Absent"]));
      addDaysFor(ids.vikram, patternDays(start, 14, ["Present", "Present", "Present", "Absent"]));
      addDaysFor(ids.diya, patternDays(start, 14, ["Present", "Present", "Present", "Leave"]));
      addDaysFor(ids.farhan, patternDays(start, 14, ["Present"]));
      addDaysFor(ids.meera, [{ date: MGI.utils.addDays(today, -20), status: "Present" }]);

      var yesterday = MGI.utils.addDays(today, -1);
      var tasks = [
        { id: "t01", studentId: ids.priya, title: "HTML semantics lab", description: "Build a semantic landing page", assignedDate: MGI.utils.addDays(today, -10), dueDate: yesterday, status: "Pending", completedDate: null },
        { id: "t02", studentId: ids.priya, title: "CSS layout practice", description: "Flexbox and grid", assignedDate: MGI.utils.addDays(today, -9), dueDate: MGI.utils.addDays(today, 3), status: "In Progress", completedDate: null },
        { id: "t03", studentId: ids.priya, title: "JS functions worksheet", description: "", assignedDate: MGI.utils.addDays(today, -8), dueDate: MGI.utils.addDays(today, -2), status: "Completed", completedDate: MGI.utils.addDays(today, -2) },
        { id: "t04", studentId: ids.priya, title: "Form validation", description: "Client-side checks", assignedDate: MGI.utils.addDays(today, -7), dueDate: MGI.utils.addDays(today, -6), status: "Completed", completedDate: MGI.utils.addDays(today, -6) },
        { id: "t05", studentId: ids.arjun, title: "Portfolio homepage", description: "Responsive homepage", assignedDate: MGI.utils.addDays(today, -12), dueDate: MGI.utils.addDays(today, -1), status: "Completed", completedDate: yesterday },
        { id: "t06", studentId: ids.arjun, title: "Accessibility audit", description: "Labels and contrast", assignedDate: MGI.utils.addDays(today, -6), dueDate: today, status: "Completed", completedDate: today },
        { id: "t07", studentId: ids.arjun, title: "Local storage demo", description: "", assignedDate: MGI.utils.addDays(today, -5), dueDate: MGI.utils.addDays(today, 4), status: "Completed", completedDate: yesterday },
        { id: "t08", studentId: ids.sneha, title: "SQL joins recap", description: "", assignedDate: MGI.utils.addDays(today, -9), dueDate: yesterday, status: "Pending", completedDate: null },
        { id: "t09", studentId: ids.sneha, title: "Chart interpretation", description: "", assignedDate: MGI.utils.addDays(today, -8), dueDate: MGI.utils.addDays(today, 2), status: "Pending", completedDate: null },
        { id: "t10", studentId: ids.rohan, title: "Dashboard critique", description: "", assignedDate: MGI.utils.addDays(today, -11), dueDate: MGI.utils.addDays(today, -3), status: "Pending", completedDate: null },
        { id: "t11", studentId: ids.rohan, title: "Cleaning dataset", description: "", assignedDate: MGI.utils.addDays(today, -4), dueDate: MGI.utils.addDays(today, 5), status: "In Progress", completedDate: null },
        { id: "t12", studentId: ids.vikram, title: "Campaign outline", description: "", assignedDate: MGI.utils.addDays(today, -10), dueDate: MGI.utils.addDays(today, -2), status: "Pending", completedDate: null },
        { id: "t13", studentId: ids.vikram, title: "Keyword research", description: "", assignedDate: MGI.utils.addDays(today, -9), dueDate: MGI.utils.addDays(today, 6), status: "Completed", completedDate: yesterday },
        { id: "t14", studentId: ids.diya, title: "Wireframe set", description: "", assignedDate: MGI.utils.addDays(today, -6), dueDate: MGI.utils.addDays(today, 1), status: "Pending", completedDate: null },
        { id: "t15", studentId: ids.farhan, title: "Capstone analysis", description: "Full notebook", assignedDate: MGI.utils.addDays(today, -14), dueDate: yesterday, status: "Completed", completedDate: yesterday }
      ];
      tasks.forEach(function (t) {
        t.createdAt = t.assignedDate + "T10:00:00.000Z";
        t.updatedAt = t.createdAt;
      });

      var activities = [
        { studentId: ids.priya, date: MGI.utils.addDays(today, -8), type: "Positive", category: "Class Participation", description: "Answered every lab question", points: 20 },
        { studentId: ids.priya, date: MGI.utils.addDays(today, -6), type: "Positive", category: "Project Excellence", description: "Submitted a polished mini project", points: 15 },
        { studentId: ids.priya, date: MGI.utils.addDays(today, -5), type: "Negative", category: "Late Arrival", description: "Arrived 20 minutes late", points: 10 },
        { studentId: ids.priya, date: MGI.utils.addDays(today, -2), type: "Negative", category: "Incomplete Work", description: "Missed one worksheet item", points: 5 },
        { studentId: ids.arjun, date: MGI.utils.addDays(today, -7), type: "Positive", category: "Helping Peers", description: "Supported classmates during lab", points: 12 },
        { studentId: ids.arjun, date: MGI.utils.addDays(today, -3), type: "Positive", category: "Leadership", description: "Led the stand-up discussion", points: 10 },
        { studentId: ids.sneha, date: MGI.utils.addDays(today, -4), type: "Positive", category: "Extra Practice", description: "Completed bonus SQL drills", points: 8 },
        { studentId: ids.rohan, date: MGI.utils.addDays(today, -9), type: "Negative", category: "Misconduct", description: "Disrupted the afternoon session", points: 20 },
        { studentId: ids.rohan, date: MGI.utils.addDays(today, -8), type: "Negative", category: "Phone Distraction", description: "Used phone during lecture", points: 10 },
        { studentId: ids.rohan, date: MGI.utils.addDays(today, -2), type: "Positive", category: "Class Participation", description: "Shared a useful dataset tip", points: 5 },
        { studentId: ids.vikram, date: MGI.utils.addDays(today, -6), type: "Positive", category: "Project Excellence", description: "Strong campaign draft", points: 6 },
        { studentId: ids.vikram, date: MGI.utils.addDays(today, -1), type: "Negative", category: "Missed Deadline", description: "Late keyword sheet", points: 4 },
        { studentId: ids.diya, date: MGI.utils.addDays(today, -5), type: "Positive", category: "Class Participation", description: "Thoughtful critique in review", points: 7 },
        { studentId: ids.farhan, date: MGI.utils.addDays(today, -10), type: "Positive", category: "Project Excellence", description: "Excellent analysis notebook", points: 20 },
        { studentId: ids.farhan, date: MGI.utils.addDays(today, -4), type: "Positive", category: "Helping Peers", description: "Tutored two classmates", points: 12 },
        { studentId: ids.meera, date: MGI.utils.addDays(today, -18), type: "Negative", category: "Late Arrival", description: "Repeated late arrival", points: 8 },
        { studentId: ids.kabir, date: MGI.utils.addDays(today, -30), type: "Positive", category: "Leadership", description: "Mentored the new batch", points: 15 },
        { studentId: ids.sneha, date: MGI.utils.addDays(today, -1), type: "Negative", category: "Incomplete Work", description: "Did not finish lab", points: 6 },
        { studentId: ids.diya, date: today, type: "Positive", category: "Extra Practice", description: "Uploaded extra wireframes", points: 5 },
        { studentId: ids.vikram, date: today, type: "Positive", category: "Class Participation", description: "Asked a clarifying question", points: 4 }
      ];
      activities.forEach(function (a, idx) {
        a.id = "act-" + (idx + 1);
        a.createdAt = a.date + "T11:00:00.000Z";
        a.updatedAt = a.createdAt;
      });

      return {
        students: students,
        attendance: attendance,
        tasks: tasks,
        activities: activities,
        meta: { schemaVersion: MGI.config.schemaVersion, welcomeShown: true, sampleLoaded: true }
      };
    }
  };

  global.MGI = MGI;
})(window);
