(function (global) {
  var MGI = global.MGI || {};

  MGI.config = {
    schemaVersion: 1,
    storageKeys: {
      students: "mgi_sms_students",
      attendance: "mgi_sms_attendance",
      tasks: "mgi_sms_tasks",
      activities: "mgi_sms_activities",
      meta: "mgi_sms_meta"
    },
    uiSessionKey: "mgi_sms_ui",
    pageSize: 25,
    maxImageBytes: 2 * 1024 * 1024,
    imageMaxSize: 256,
    imageQuality: 0.7,
    courses: [
      "Web Development",
      "Data Analytics",
      "Digital Marketing",
      "UI/UX Design"
    ],
    studentStatuses: ["Active", "Inactive", "Completed"],
    attendanceStatuses: ["Present", "Absent", "Leave"],
    taskStatuses: ["Pending", "In Progress", "Completed"],
    activityTypes: ["Positive", "Negative"],
    activityCategories: {
      Positive: [
        "Class Participation",
        "Project Excellence",
        "Helping Peers",
        "Extra Practice",
        "Leadership"
      ],
      Negative: [
        "Late Arrival",
        "Incomplete Work",
        "Misconduct",
        "Phone Distraction",
        "Missed Deadline"
      ]
    },
    thresholds: {
      attendance: { green: 90, amberMin: 75 },
      taskCompletion: { green: 80, amberMin: 50 },
      overdue: { greenMax: 0, amberMax: 2 },
      netPoints: { green: 10, amberMin: 0 }
    },
    namePattern: /^[A-Za-z][A-Za-z .'-]{0,59}$/,
    phonePattern: /^\+?[0-9]{10,15}$/,
    emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  };

  global.MGI = MGI;
})(window);
