// Outputs received argv as JSON (skipping node and script path).
// Used by integration tests to verify argument quoting.
import process from 'node:process';

process.stdout.write(JSON.stringify(process.argv.slice(2)));
