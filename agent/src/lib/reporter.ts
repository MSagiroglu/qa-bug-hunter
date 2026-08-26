import { TestResult } from './executor.js';
import { DOMAnalysis } from './analyzer.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportConfig {
  outputDir: string;
  format: 'markdown' | 'html' | 'json';
  includeEvidence: boolean;
}

export class Reporter {
  private config: ReportConfig;

  constructor(config: Partial<ReportConfig> = {}) {
    this.config = {
      outputDir: './docs/qa-reports',
      format: 'markdown',
      includeEvidence: true,
      ...config,
    };
  }

  async generateReport(
    url: string,
    domAnalysis: DOMAnalysis,
    testResults: TestResult[],
    executionTime: number,
    videoPath?: string | null
  ): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportDir = path.join(this.config.outputDir, `${timestamp}`);
    
    await this.ensureDir(reportDir);

    const report = this.buildReport(url, domAnalysis, testResults, executionTime, videoPath);
    const reportPath = path.join(reportDir, `report.${this.config.format}`);
    
    await fs.promises.writeFile(reportPath, report, 'utf-8');
    
    // Copy evidence files if enabled
    if (this.config.includeEvidence) {
      await this.copyEvidenceFiles(reportDir);
    }

    console.log(`📄 Rapor oluşturuldu: ${reportPath}`);
    
    return reportPath;
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.promises.access(dir);
    } catch {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  private buildReport(
    url: string,
    domAnalysis: DOMAnalysis,
    testResults: TestResult[],
    executionTime: number,
    videoPath?: string | null
  ): string {
    const passed = testResults.filter(r => r.status === 'pass').length;
    const failed = testResults.filter(r => r.status === 'fail').length;
    const warnings = testResults.filter(r => r.status === 'warning').length;

    let report = `# Exploratory QA Report

**Target:** ${url}
**Date:** ${new Date().toISOString().split('T')[0]}
**Execution Time:** ${(executionTime / 1000).toFixed(2)}s
**Browser:** Chromium (Playwright) - Headed Mode
**Viewport:** 1920x1080
${videoPath ? `**Video Recording:** ${videoPath}` : ''}

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${testResults.length} |
| ✅ Passed | ${passed} |
| ❌ Failed | ${failed} |
| ⚠️ Warnings | ${warnings} |
| Success Rate | ${((passed / testResults.length) * 100).toFixed(1)}% |

---

## 2. Page Analysis

| Property | Value |
|----------|-------|
| Title | ${domAnalysis.title} |
| URL | ${domAnalysis.url} |
| Total Elements | ${domAnalysis.totalElements} |
| Visible Elements | ${domAnalysis.visibleElements} |

### DOM Breakdown

| Component | Total | Visible |
|-----------|-------|---------|
| Input Fields | ${domAnalysis.inputs.length} | ${domAnalysis.inputs.filter(i => i.isVisible).length} |
| Buttons | ${domAnalysis.buttons.length} | ${domAnalysis.buttons.filter(b => b.isVisible).length} |
| Links | ${domAnalysis.links.length} | ${domAnalysis.links.filter(l => l.isVisible).length} |
| Images | ${domAnalysis.images.length} | ${domAnalysis.images.filter(i => i.isVisible).length} |
| Forms | ${domAnalysis.forms.length} | ${domAnalysis.forms.filter(f => f.isVisible).length} |

---

## 3. Test Results

`;

    for (const result of testResults) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      const severityBadge = result.severity ? ` [${result.severity.toUpperCase()}]` : '';
      
      report += `### ${icon} ${result.testCaseId}: ${result.status.toUpperCase()}${severityBadge}

**Test Name:** ${result.testCaseId}
**Status:** ${result.status.toUpperCase()}
${result.severity ? `**Severity:** ${result.severity.toUpperCase()}` : ''}

**Description:**
${result.message}

`;

      if (result.details) {
        report += `**Technical Details:**
\`\`\`json
${JSON.stringify(result.details, null, 2)}
\`\`\`

`;
      }

      if (result.evidence.length > 0) {
        report += `**Evidence:**
`;
        result.evidence.forEach(e => {
          if (e.endsWith('.png') || e.endsWith('.jpg')) {
            report += `- 📸 ${e}\n`;
          } else if (e.endsWith('.mp4') || e.endsWith('.webm')) {
            report += `- 🎬 ${e}\n`;
          } else {
            report += `- ${e}\n`;
          }
        });
        report += '\n';
      }

      report += `---\n\n`;
    }

    report += `## 4. Findings Summary

### Critical Issues (${testResults.filter(r => r.status === 'fail' && r.severity === 'critical').length})
${testResults.filter(r => r.status === 'fail' && r.severity === 'critical').map(r => `- ${r.testCaseId}: ${r.message}`).join('\n') || 'None'}

### High Severity (${testResults.filter(r => r.status === 'fail' && r.severity === 'high').length})
${testResults.filter(r => r.status === 'fail' && r.severity === 'high').map(r => `- ${r.testCaseId}: ${r.message}`).join('\n') || 'None'}

### Medium Severity (${testResults.filter(r => r.status === 'fail' && r.severity === 'medium').length})
${testResults.filter(r => r.status === 'fail' && r.severity === 'medium').map(r => `- ${r.testCaseId}: ${r.message}`).join('\n') || 'None'}

### Low Severity (${testResults.filter(r => r.status === 'fail' && r.severity === 'low').length})
${testResults.filter(r => r.status === 'fail' && r.severity === 'low').map(r => `- ${r.testCaseId}: ${r.message}`).join('\n') || 'None'}

---

## 5. Recommendations

`;

    if (failed > 0) {
      report += `### Immediate Actions
- Fix all critical and high severity issues
- Review evidence files for detailed information
- Investigate root cause and implement fixes
- Verify fixes with regression testing

`;
    }

    report += `### Best Practices
- Implement automated regression tests for found issues
- Add security headers and input validation
- Ensure responsive design across all viewports
- Follow WCAG 2.1 accessibility guidelines
- Regular security audits recommended

---

## 6. Evidence Files

Evidence files are saved in: \`evidence/\`
${videoPath ? `Video recording: ${videoPath}` : ''}

---

*Report generated by QA Bug Hunter Agent*
*Test Methodology: Exploratory Testing (Session-Based)*
`;

    return report;
  }

  private async copyEvidenceFiles(reportDir: string): Promise<void> {
    const evidenceDir = path.join(reportDir, 'evidence');
    await this.ensureDir(evidenceDir);

    const sourceEvidenceDir = './evidence';
    try {
      await fs.promises.access(sourceEvidenceDir);
      const items = await fs.promises.readdir(sourceEvidenceDir);
      
      for (const item of items) {
        const sourcePath = path.join(sourceEvidenceDir, item);
        const destPath = path.join(evidenceDir, item);
        
        const stat = await fs.promises.stat(sourcePath);
        if (stat.isDirectory()) {
          // Copy directory recursively
          await this.copyDirRecursive(sourcePath, destPath);
        } else {
          await fs.promises.copyFile(sourcePath, destPath);
        }
      }
    } catch {
      // Evidence directory doesn't exist
    }
  }

  private async copyDirRecursive(source: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });
    const items = await fs.promises.readdir(source);
    
    for (const item of items) {
      const sourcePath = path.join(source, item);
      const destPath = path.join(dest, item);
      
      const stat = await fs.promises.stat(sourcePath);
      if (stat.isDirectory()) {
        await this.copyDirRecursive(sourcePath, destPath);
      } else {
        await fs.promises.copyFile(sourcePath, destPath);
      }
    }
  }

  async generateJSONReport(
    url: string,
    domAnalysis: DOMAnalysis,
    testResults: TestResult[],
    executionTime: number,
    videoPath?: string | null
  ): Promise<object> {
    return {
      metadata: {
        url,
        date: new Date().toISOString(),
        executionTime,
        browser: 'Chromium (Playwright)',
        mode: 'headed',
        videoPath,
      },
      domAnalysis,
      testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.status === 'pass').length,
        failed: testResults.filter(r => r.status === 'fail').length,
        warnings: testResults.filter(r => r.status === 'warning').length,
        bySeverity: {
          critical: testResults.filter(r => r.severity === 'critical').length,
          high: testResults.filter(r => r.severity === 'high').length,
          medium: testResults.filter(r => r.severity === 'medium').length,
          low: testResults.filter(r => r.severity === 'low').length,
        },
      },
    };
  }
}
