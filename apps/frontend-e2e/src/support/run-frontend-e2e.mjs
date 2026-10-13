import { spawnSync } from 'child_process';

/** @param {string} command */
function run(command) {
  const res = spawnSync(command, { stdio: 'inherit', shell: true });

  if (res.error) {
    console.error(res.error);

    return 1;
  }
  return res.status ?? 1;
}

const projectRoot = process.argv[2];

if (!projectRoot) {
  console.error('Missing {projectRoot} argument.');
  process.exit(2);
}

const clusterAlreadyExists = 3;

let exitCode = 0;
let started = false;

try {
  exitCode = run('sh infra/scripts/start-dev.sh e2e');
  // Tearing down would destroy the environment that is already running.
  started = exitCode !== clusterAlreadyExists;

  if (exitCode === 0) {
    exitCode = run(`npx cypress run --project ${projectRoot}`);
  }
} finally {
  if (started) {
    const downCode = run('sh infra/scripts/stop-dev.sh');

    if (exitCode === 0 && downCode !== 0) {
      exitCode = downCode;
    }
  }
}

process.exit(exitCode);
