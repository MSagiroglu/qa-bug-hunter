import { TestResult } from './executor.js';
import * as fs from 'fs';
import * as path from 'path';

export interface TicketConfig {
  outputDir: string;
  format: 'jira' | 'markdown' | 'azure';
}

export interface Ticket {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
  stepsToReproduce: string[];
  actualResult: string;
  expectedResult: string;
  environment: string;
  evidence: string[];
  category: string;
  components: string[];
  oracle: string;
  confidence: 'high' | 'medium' | 'low';
}

export class TicketGenerator {
  private config: TicketConfig;

  constructor(config: Partial<TicketConfig> = {}) {
    this.config = {
      outputDir: './docs/qa-reports',
      format: 'jira',
      ...config,
    };
  }

  async generateTickets(
    testResults: TestResult[],
    evidenceDir: string = './evidence',
    videoPath?: string | null
  ): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (const result of testResults) {
      if (result.status === 'fail') {
        tickets.push(this.createTicket(result, evidenceDir, videoPath));
      }
    }

    // Save tickets
    await fs.promises.mkdir(this.config.outputDir, { recursive: true });
    const ticketPath = path.join(this.config.outputDir, 'tickets.md');
    await this.saveTickets(tickets, ticketPath);

    // Also save as JSON for programmatic access
    const jsonPath = path.join(this.config.outputDir, 'tickets.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(tickets, null, 2), 'utf-8');

    console.log(`🎫 ${tickets.length} ticket oluşturuldu`);
    
    return tickets;
  }

  private createTicket(result: TestResult, evidenceDir: string, videoPath?: string | null): Ticket {
    const ticketId = `BUG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const severity = result.severity || 'medium';
    const priority = this.mapSeverityToPriority(severity);
    
    return {
      id: ticketId,
      title: `[${severity.toUpperCase()}] ${result.testCaseId}: ${result.message}`,
      severity,
      priority,
      description: this.generateDescription(result),
      stepsToReproduce: this.generateSteps(result),
      actualResult: this.generateActualResult(result),
      expectedResult: this.generateExpectedResult(result),
      environment: this.generateEnvironment(),
      evidence: [...result.evidence, ...(videoPath ? [videoPath] : [])],
      category: this.mapTestToCategory(result.testCaseId),
      components: this.mapTestToComponents(result.testCaseId),
      oracle: result.oracle ?? 'unspecified (test did not record what observation decided the verdict)',
      confidence: result.confidence ?? 'low',
    };
  }

  private generateDescription(result: TestResult): string {
    let description = `## Bug Description\n\n`;
    description += `${result.message}\n\n`;
    description += `### Test Information\n`;
    description += `- **Test Case ID:** ${result.testCaseId}\n`;
    description += `- **Severity:** ${result.severity?.toUpperCase() || 'MEDIUM'}\n`;
    description += `- **Date Found:** ${new Date().toISOString().split('T')[0]}\n`;
    description += `- **Test Type:** Exploratory Testing\n\n`;
    
    if (result.details) {
      description += `### Technical Details\n`;
      description += `\`\`\`json\n${JSON.stringify(result.details, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (result.evidence.length > 0) {
      description += `### Evidence Files\n`;
      result.evidence.forEach(e => {
        description += `- ${e}\n`;
      });
    }

    return description;
  }

  private generateSteps(result: TestResult): string[] {
    const steps: string[] = [];
    
    steps.push(`1. Open browser in headed mode (Chromium)`);
    steps.push(`2. Navigate to the target URL`);
    steps.push(`3. Wait for page to fully load (networkidle)`);
    steps.push(`4. Execute test: ${result.testCaseId}`);
    steps.push(`5. Observe the behavior`);
    steps.push(`6. Check browser console for errors`);
    steps.push(`7. Review network requests`);
    steps.push(`8. Capture evidence (screenshot/video)`);
    
    return steps;
  }

  private generateActualResult(result: TestResult): string {
    let actual = `${result.message}\n\n`;
    
    if (result.evidence.length > 0) {
      actual += `Evidence captured:\n`;
      result.evidence.forEach(e => {
        actual += `- ${e}\n`;
      });
    }
    
    return actual;
  }

  private generateExpectedResult(result: TestResult): string {
    const testId = result.testCaseId;
    
    if (testId.startsWith('SEC')) {
      return `The application should properly sanitize and validate all user inputs. No security vulnerabilities should be exploitable. The application should:\n- Escape special characters\n- Validate input length and type\n- Use parameterized queries for database operations\n- Implement Content Security Policy (CSP) headers`;
    }
    
    if (testId.startsWith('INPUT')) {
      return `The application should gracefully handle all types of user input without:\n- Showing server errors (5xx)\n- Exposing stack traces\n- Crashing or becoming unresponsive\n- Corrupting data`;
    }
    
    if (testId.startsWith('RESP')) {
      return `The application should be fully responsive at all viewport sizes:\n- No horizontal overflow\n- All content should be accessible\n- Navigation should work properly\n- Text should be readable without horizontal scrolling`;
    }
    
    if (testId.startsWith('A11Y')) {
      return `The application should meet WCAG 2.1 accessibility guidelines:\n- All images should have descriptive alt text\n- All form inputs should have associated labels\n- Heading hierarchy should be logical\n- Keyboard navigation should work properly`;
    }
    
    if (testId.startsWith('NAV')) {
      return `The application should have:\n- No broken internal links\n- No JavaScript console errors\n- Proper error handling for failed requests`;
    }
    
    return `The application should handle this case gracefully without errors or security vulnerabilities`;
  }

  private generateEnvironment(): string {
    return `**Browser:** Chromium (Playwright)
**Mode:** Headed (Full Screen)
**Viewport:** 1920x1080
**OS:** Windows
**Date:** ${new Date().toISOString().split('T')[0]}
**Time:** ${new Date().toISOString().split('T')[1].split('.')[0]}`;
  }

  private mapSeverityToPriority(severity: string): 'P0' | 'P1' | 'P2' | 'P3' {
    const mapping: Record<string, 'P0' | 'P1' | 'P2' | 'P3'> = {
      critical: 'P0',
      high: 'P1',
      medium: 'P2',
      low: 'P3',
    };
    return mapping[severity] || 'P2';
  }

  private mapTestToCategory(testId: string): string {
    if (testId.startsWith('SEC')) return 'Security';
    if (testId.startsWith('INPUT')) return 'Input Validation';
    if (testId.startsWith('RESP')) return 'Responsive Design';
    if (testId.startsWith('A11Y')) return 'Accessibility';
    if (testId.startsWith('NAV')) return 'Navigation';
    return 'General';
  }

  private mapTestToComponents(testId: string): string[] {
    if (testId.startsWith('SEC')) return ['Security', 'Input Handling'];
    if (testId.startsWith('INPUT')) return ['Forms', 'Input Validation'];
    if (testId.startsWith('RESP')) return ['CSS', 'Layout', 'Responsive'];
    if (testId.startsWith('A11Y')) return ['Accessibility', 'HTML'];
    if (testId.startsWith('NAV')) return ['Navigation', 'Links'];
    return ['General'];
  }

  private async saveTickets(tickets: Ticket[], filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    let content = `# Bug Tickets\n\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Total Tickets: ${tickets.length}\n\n`;
    content += `---\n\n`;

    for (const ticket of tickets) {
      content += this.formatTicket(ticket);
    }

    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  private formatTicket(ticket: Ticket): string {
    let formatted = `## ${ticket.id}\n\n`;
    formatted += `**Title:** ${ticket.title}\n\n`;
    formatted += `**Severity:** ${ticket.severity.toUpperCase()} | **Priority:** ${ticket.priority}\n\n`;
    formatted += `**Oracle:** ${ticket.oracle} | **Confidence:** ${ticket.confidence.toUpperCase()}\n\n`;
    formatted += `**Category:** ${ticket.category}\n\n`;
    formatted += `**Components:** ${ticket.components.join(', ')}\n\n`;
    formatted += `---\n\n`;
    formatted += `### Description\n\n`;
    formatted += `${ticket.description}\n\n`;
    formatted += `---\n\n`;
    formatted += `### Steps to Reproduce\n\n`;
    ticket.stepsToReproduce.forEach(step => {
      formatted += `${step}\n`;
    });
    formatted += `\n---\n\n`;
    formatted += `### Actual Result\n\n`;
    formatted += `${ticket.actualResult}\n\n`;
    formatted += `---\n\n`;
    formatted += `### Expected Result\n\n`;
    formatted += `${ticket.expectedResult}\n\n`;
    formatted += `---\n\n`;
    formatted += `### Environment\n\n`;
    formatted += `${ticket.environment}\n\n`;
    formatted += `---\n\n`;
    formatted += `### Evidence\n\n`;
    ticket.evidence.forEach(e => {
      formatted += `- ${e}\n`;
    });
    formatted += `\n---\n\n`;
    
    return formatted;
  }

  async exportToJira(tickets: Ticket[], outputDir: string): Promise<void> {
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    for (const ticket of tickets) {
      const jiraContent = this.convertToJira(ticket);
      const filePath = path.join(outputDir, `${ticket.id}.txt`);
      await fs.promises.writeFile(filePath, jiraContent, 'utf-8');
    }
    
    console.log(`📋 ${tickets.length} Jira formatında dışa aktarıldı`);
  }

  private convertToJira(ticket: Ticket): string {
    let jira = `Summary: ${ticket.title}\n`;
    jira += `Priority: ${this.mapSeverityToJira(ticket.severity)}\n`;
    jira += `Issue Type: Bug\n`;
    jira += `Component: ${ticket.components.join(', ')}\n`;
    jira += `Labels: exploratory-testing, automated, confidence-${ticket.confidence}\n`;
    jira += `Oracle: ${ticket.oracle}\n\n`;
    jira += `h3. Description\n\n`;
    jira += `{noformat}\n`;
    jira += ticket.description;
    jira += `{noformat}\n\n`;
    jira += `h3. Steps to Reproduce\n\n`;
    ticket.stepsToReproduce.forEach(step => {
      jira += `# ${step}\n`;
    });
    jira += `\nh3. Actual Result\n\n`;
    jira += `{noformat}\n`;
    jira += ticket.actualResult;
    jira += `{noformat}\n\n`;
    jira += `h3. Expected Result\n\n`;
    jira += `{noformat}\n`;
    jira += ticket.expectedResult;
    jira += `{noformat}\n\n`;
    jira += `h3. Environment\n\n`;
    jira += `{noformat}\n`;
    jira += ticket.environment;
    jira += `{noformat}\n\n`;
    jira += `h3. Evidence\n\n`;
    ticket.evidence.forEach(e => {
      jira += `* ${e}\n`;
    });
    
    return jira;
  }

  private mapSeverityToJira(severity: string): string {
    const mapping: Record<string, string> = {
      critical: 'Blocker',
      high: 'Critical',
      medium: 'Major',
      low: 'Minor',
    };
    return mapping[severity] || 'Major';
  }

  async exportToAzureDevOps(tickets: Ticket[], outputDir: string): Promise<void> {
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    for (const ticket of tickets) {
      const azureContent = this.convertToAzure(ticket);
      const filePath = path.join(outputDir, `${ticket.id}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(azureContent, null, 2), 'utf-8');
    }
    
    console.log(`📋 ${tickets.length} Azure DevOps formatında dışa aktarıldı`);
  }

  private convertToAzure(ticket: Ticket): object {
    return {
      op: 'add',
      path: '/fields/System.Title',
      value: ticket.title,
    };
  }
}
