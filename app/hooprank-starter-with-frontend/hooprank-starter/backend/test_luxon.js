const { DateTime } = require('luxon');

let startLocal = DateTime.now().setZone('America/Los_Angeles').startOf('day');
console.log("Start Local:", startLocal.toString());

// Next Sunday
let candidateLocal = startLocal.plus({ days: 3 }); // assuming today is Thursday
candidateLocal = candidateLocal.set({ hour: 10, minute: 45 });
console.log("Candidate Local:", candidateLocal.toString());

const jsDate = candidateLocal.toJSDate();
console.log("JS Date (ISO):", jsDate.toISOString());
console.log("JS Date (local string):", jsDate.toString());
