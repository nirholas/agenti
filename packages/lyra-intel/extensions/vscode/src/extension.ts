import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';

interface AnalysisResult {
    metrics?: {
        total_files?: number;
        total_lines?: number;
        complexity?: number;
    };
    security?: {
        findings?: SecurityFinding[];
    };
    quality_score?: number;
}

interface SecurityFinding {
    severity: string;
    type: string;
    file_path: string;
    line: number;
    description: string;
    recommendation?: string;
}

class LyraIntelClient {
    private client: AxiosInstance;
    
    constructor(private serverUrl: string, private apiKey: string) {
        this.client = axios.create({
            baseURL: serverUrl,
            headers: apiKey ? { 'X-API-Key': apiKey } : {},
            timeout: 30000,
        });
    }
    
    async analyzeFile(filePath: string, content: string): Promise<AnalysisResult> {
        const response = await this.client.post('/api/v1/analyze/file', {
            file_path: filePath,
            content: content,
        });
        return response.data;
    }
    
    async analyzeWorkspace(workspacePath: string): Promise<AnalysisResult> {
        const response = await this.client.post('/api/v1/analyze', {
            repo_url: workspacePath,
        });
        return response.data;
    }
    
    async securityScan(filePath: string, content: string): Promise<SecurityFinding[]> {
        const response = await this.client.post('/api/v1/security/scan', {
            file_path: filePath,
            content: content,
        });
        return response.data.findings || [];
    }
}

class LyraIntelProvider implements vscode.TreeDataProvider<InsightItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<InsightItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private insights: InsightItem[] = [];
    
    constructor() {}
    
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    setInsights(insights: InsightItem[]): void {
        this.insights = insights;
        this.refresh();
    }
    
    getTreeItem(element: InsightItem): vscode.TreeItem {
        return element;
    }
    
    getChildren(element?: InsightItem): Thenable<InsightItem[]> {
        if (!element) {
            return Promise.resolve(this.insights);
        }
        return Promise.resolve([]);
    }
}

class InsightItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly severity?: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = description;
        this.description = description;
        
        if (severity) {
            switch (severity) {
                case 'critical':
                case 'high':
                    this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                    break;
                case 'medium':
                    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
                    break;
                default:
                    this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('infoForeground'));
            }
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Lyra Intel extension is now active');
    
    const config = vscode.workspace.getConfiguration('lyraIntel');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:8080');
    const apiKey = config.get<string>('apiKey', '');
    
    const client = new LyraIntelClient(serverUrl, apiKey);
    const insightsProvider = new LyraIntelProvider();
    
    // Register tree view
    vscode.window.registerTreeDataProvider('lyraIntelInsights', insightsProvider);
    
    // Diagnostic collection for security issues
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('lyraIntel');
    context.subscriptions.push(diagnosticCollection);
    
    // Analyze workspace command
    const analyzeWorkspace = vscode.commands.registerCommand('lyraIntel.analyze', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing workspace...',
            cancellable: false,
        }, async (progress) => {
            try {
                progress.report({ increment: 0 });
                
                const result = await client.analyzeWorkspace(workspaceFolder.uri.fsPath);
                
                progress.report({ increment: 100 });
                
                // Show results
                const insights: InsightItem[] = [];
                
                if (result.metrics) {
                    insights.push(new InsightItem(
                        `Total Files: ${result.metrics.total_files || 0}`,
                        '',
                        vscode.TreeItemCollapsibleState.None
                    ));
                    insights.push(new InsightItem(
                        `Lines of Code: ${result.metrics.total_lines || 0}`,
                        '',
                        vscode.TreeItemCollapsibleState.None
                    ));
                    insights.push(new InsightItem(
                        `Complexity: ${result.metrics.complexity || 0}`,
                        '',
                        vscode.TreeItemCollapsibleState.None
                    ));
                }
                
                if (result.security?.findings) {
                    insights.push(new InsightItem(
                        `Security Issues: ${result.security.findings.length}`,
                        '',
                        vscode.TreeItemCollapsibleState.None,
                        'high'
                    ));
                }
                
                insightsProvider.setInsights(insights);
                
                vscode.window.showInformationMessage(
                    `Analysis complete: ${result.metrics?.total_files || 0} files analyzed`
                );
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
            }
        });
    });
    
    // Analyze current file command
    const analyzeCurrentFile = vscode.commands.registerCommand('lyraIntel.analyzeCurrent', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        
        const document = editor.document;
        const filePath = document.fileName;
        const content = document.getText();
        
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing file...',
            cancellable: false,
        }, async () => {
            try {
                const result = await client.analyzeFile(filePath, content);
                
                vscode.window.showInformationMessage(
                    `Analysis complete. Complexity: ${result.metrics?.complexity || 0}`
                );
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
            }
        });
    });
    
    // Security scan command
    const securityScan = vscode.commands.registerCommand('lyraIntel.securityScan', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        
        const document = editor.document;
        const filePath = document.fileName;
        const content = document.getText();
        
        try {
            const findings = await client.securityScan(filePath, content);
            
            // Clear previous diagnostics
            diagnosticCollection.clear();
            
            // Convert findings to diagnostics
            if (findings.length > 0) {
                const diagnostics: vscode.Diagnostic[] = findings.map(finding => {
                    const line = Math.max(0, finding.line - 1);
                    const range = new vscode.Range(line, 0, line, 1000);
                    
                    let severity = vscode.DiagnosticSeverity.Information;
                    if (finding.severity === 'critical' || finding.severity === 'high') {
                        severity = vscode.DiagnosticSeverity.Error;
                    } else if (finding.severity === 'medium') {
                        severity = vscode.DiagnosticSeverity.Warning;
                    }
                    
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `${finding.description}${finding.recommendation ? ' - ' + finding.recommendation : ''}`,
                        severity
                    );
                    diagnostic.source = 'Lyra Intel';
                    diagnostic.code = finding.type;
                    
                    return diagnostic;
                });
                
                diagnosticCollection.set(document.uri, diagnostics);
                
                vscode.window.showWarningMessage(
                    `Security scan found ${findings.length} issue(s)`
                );
            } else {
                vscode.window.showInformationMessage('No security issues found');
            }
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Security scan failed: ${error.message}`);
        }
    });
    
    // Show insights command
    const showInsights = vscode.commands.registerCommand('lyraIntel.showInsights', () => {
        vscode.commands.executeCommand('lyraIntelInsights.focus');
    });
    
    // Auto-analyze on save if enabled
    const autoAnalyze = config.get<boolean>('autoAnalyze', false);
    if (autoAnalyze) {
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (config.get<boolean>('securityScanOnSave', true)) {
                try {
                    const findings = await client.securityScan(
                        document.fileName,
                        document.getText()
                    );
                    
                    if (findings.length > 0) {
                        const diagnostics = findings.map(finding => {
                            const line = Math.max(0, finding.line - 1);
                            const range = new vscode.Range(line, 0, line, 1000);
                            return new vscode.Diagnostic(
                                range,
                                finding.description,
                                vscode.DiagnosticSeverity.Warning
                            );
                        });
                        
                        diagnosticCollection.set(document.uri, diagnostics);
                    }
                } catch (error) {
                    console.error('Auto-analysis failed:', error);
                }
            }
        });
    }
    
    context.subscriptions.push(
        analyzeWorkspace,
        analyzeCurrentFile,
        securityScan,
        showInsights,
        diagnosticCollection
    );
}

export function deactivate() {
    console.log('Lyra Intel extension deactivated');
}
