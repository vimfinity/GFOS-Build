const reports = [
  ['scan.report.json', 'Scan'],
  ['build-plan.report.json', 'Build Plan'],
  ['build-run.report.json', 'Build Run'],
  ['pipeline-plan.report.json', 'Pipeline Plan'],
  ['pipeline-run.report.json', 'Pipeline Run'],
];

const select = document.querySelector('#report-select');
const summary = document.querySelector('#summary');
const events = document.querySelector('#events');
const details = document.querySelector('#details');

for (const [file, label] of reports) {
  const option = document.createElement('option');
  option.value = file;
  option.textContent = label;
  select.append(option);
}

function renderSummary(report) {
  const rows = [
    ['schemaVersion', report.schemaVersion],
    ['command', report.command],
    ['mode', report.mode],
    ['discovered', report.stats.discoveredCount],
    ['planned', report.stats.plannedCount],
    ['built', report.stats.builtCount],
    ['failed', report.stats.failedCount],
    ['profileCount', report.stats.profileCount],
  ];

  summary.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function renderEvents(report) {
  events.innerHTML = report.events
    .map(event => `<li><strong>${event.type}</strong> · ${JSON.stringify(event.payload ?? {})}</li>`)
    .join('');
}

function renderDetails(report) {
  const payload = {
    buildPlan: report.buildPlan,
    buildResults: report.buildResults,
    pipeline: report.pipeline,
  };

  details.textContent = JSON.stringify(payload, null, 2);
}

async function loadReport(file) {
  const response = await fetch(`../../assets/ui-readiness/${file}`);
  const report = await response.json();
  renderSummary(report);
  renderEvents(report);
  renderDetails(report);
}

select.addEventListener('change', () => {
  loadReport(select.value).catch(error => {
    details.textContent = String(error);
  });
});

loadReport(select.value || reports[0][0]).catch(error => {
  details.textContent = String(error);
});
