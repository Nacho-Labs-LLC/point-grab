import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Used only by the independent --list pass; never starts browsers or servers. */
export default class InventoryReporter {
  constructor() {
    this.suite = process.env.POINT_GRAB_INVENTORY_SUITE;
    this.outputDir = process.env.POINT_GRAB_EVIDENCE_DIR;
    if (!this.outputDir || !this.suite) throw new Error('Missing review inventory destination');
    this.report = { suite: this.suite, completed: false, forbidOnly: false, tests: [], errors: [] };
  }
  onBegin(config, suite) {
    this.report.forbidOnly = config.forbidOnly;
    this.report.tests = suite.allTests().map(test => ({ id: test.id, titlePath: test.titlePath(), location: test.location }));
  }
  onError(error) { this.report.errors.push({ message: error.message, stack: error.stack }); }
  onEnd(result) {
    Object.assign(this.report, { completed: true, status: result.status });
    const dir = join(this.outputDir, this.suite);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'inventory.json'), JSON.stringify(this.report, null, 2) + '\n', { flag: 'wx' });
  }
}
